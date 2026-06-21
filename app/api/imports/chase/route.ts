import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { parseChaseStagingCsv } from '@/lib/importers/chase-staging-csv';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

type DecodedToken = {
    user_id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
};

type ChaseTransaction = {
    rowNumber: number;
    date: string;
    description: string;
    amount: number;
    displayAmount: number;
    accountLast4: string;
    accountName: string;
    accountType: string;
    importSource: string;
    importHash: string;
    kind: 'expense' | 'income';
    source: string | null;
    category: string | null;
    isTransferLike: boolean;
    selectedByDefault: boolean;
    defaultAction: string;
    notes: string;
    fileName: string;
};

type ParsedChaseFile = {
    transactions: Array<Omit<ChaseTransaction, 'fileName'>>;
    skippedRows: Array<unknown>;
};

type DuplicateStatus = 'new' | 'possible_duplicate' | 'exact_duplicate';

type ExistingMatch = {
    id: number;
    type: 'expense' | 'income';
    date: string;
    amount: number;
    description: string;
    accountName: string | null;
};

type ExpenseImportRow = {
    amount: number;
    category: string;
    date: string;
    description: string;
    importSource: string;
    importHash: string;
    accountName: string;
    accountType: string;
};

type IncomeImportRow = {
    amount: number;
    source: string;
    date: string;
    description: string;
    notes: string;
    importSource: string;
    importHash: string;
    accountName: string;
    accountType: string;
};

type ExpenseCreateInput = Omit<ExpenseImportRow, 'accountName' | 'accountType'>;
type IncomeCreateInput = Omit<IncomeImportRow, 'accountName' | 'accountType'>;

function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as DecodedToken;
    } catch {
        return null;
    }
}

function booleanFormValue(value: FormDataEntryValue | null) {
    return value === 'true' || value === '1' || value === 'on';
}

function parseSelectedImportHashes(value: FormDataEntryValue | null) {
    if (!value) return null;

    try {
        const parsed = JSON.parse(String(value));
        if (!Array.isArray(parsed)) return null;
        return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    } catch {
        return null;
    }
}

function canonicalAccountName(name: string) {
    const aliases: Record<string, string> = {
        'Chase Total Checking': 'Chase',
        'Chase Unlimited Freedom': 'Chase Freedom Unlimited',
    };

    return aliases[name] || name;
}

function omitImportMetadata<T extends { importSource: string; importHash: string }>(row: T) {
    const rest = { ...row } as Omit<T, 'importSource' | 'importHash'> & Partial<Pick<T, 'importSource' | 'importHash'>>;
    delete rest.importSource;
    delete rest.importHash;
    return rest;
}

function toExpenseCreateInput(row: ExpenseImportRow): ExpenseCreateInput {
    return {
        amount: row.amount,
        category: row.category,
        date: row.date,
        description: row.description,
        importSource: row.importSource,
        importHash: row.importHash,
    };
}

function toIncomeCreateInput(row: IncomeImportRow): IncomeCreateInput {
    return {
        amount: row.amount,
        source: row.source,
        date: row.date,
        description: row.description,
        notes: row.notes,
        importSource: row.importSource,
        importHash: row.importHash,
    };
}

function normalizeForMatch(value: string) {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function amountKey(value: number) {
    return Math.abs(value).toFixed(2);
}

function matchKey(type: 'expense' | 'income', date: string, amount: number, accountName: string) {
    return `${type}|${date}|${amountKey(amount)}|${accountName}`;
}

async function ensureCategory(name: string) {
    const existing = await prisma.category.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.category.create({ data: { name } });
}

async function findExistingMatches(transactions: ChaseTransaction[]) {
    const accountNames = [...new Set(transactions.map((transaction) => transaction.accountName))];
    const accounts = await prisma.account.findMany({
        where: { name: { in: accountNames } },
        select: { id: true, name: true },
    });
    const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
    const accountIds = accounts.map((account) => account.id);
    const dates = [...new Set(transactions.map((transaction) => transaction.date))];
    const expenseAmounts = [...new Set(
        transactions
            .filter((transaction) => transaction.kind === 'expense')
            .map((transaction) => transaction.displayAmount)
    )];
    const incomeAmounts = [...new Set(
        transactions
            .filter((transaction) => transaction.kind === 'income')
            .map((transaction) => transaction.displayAmount)
    )];
    const accountFilter = accountIds.length > 0
        ? { OR: [{ accountId: { in: accountIds } }, { accountId: null }] }
        : {};

    const [existingExpenses, existingIncomes] = await Promise.all([
        expenseAmounts.length > 0
            ? prisma.expense.findMany({
                where: {
                    date: { in: dates },
                    amount: { in: expenseAmounts },
                    ...accountFilter,
                },
                select: {
                    id: true,
                    date: true,
                    amount: true,
                    description: true,
                    accountId: true,
                    account: { select: { name: true } },
                },
            })
            : Promise.resolve([]),
        incomeAmounts.length > 0
            ? prisma.income.findMany({
                where: {
                    date: { in: dates },
                    amount: { in: incomeAmounts },
                    ...accountFilter,
                },
                select: {
                    id: true,
                    date: true,
                    amount: true,
                    description: true,
                    accountId: true,
                    account: { select: { name: true } },
                },
            })
            : Promise.resolve([]),
    ]);

    const matchesByKey = new Map<string, ExistingMatch[]>();
    const pushMatch = (match: ExistingMatch) => {
        const key = matchKey(match.type, match.date, match.amount, match.accountName || '');
        const matches = matchesByKey.get(key) || [];
        matches.push(match);
        matchesByKey.set(key, matches);
    };

    for (const expense of existingExpenses) {
        const names = expense.accountId ? [accountNameById.get(expense.accountId)].filter(Boolean) : accountNames;
        for (const accountName of names) {
            pushMatch({
                id: expense.id,
                type: 'expense',
                date: expense.date,
                amount: expense.amount,
                description: expense.description,
                accountName: expense.account?.name || accountName || null,
            });
        }
    }

    for (const income of existingIncomes) {
        const names = income.accountId ? [accountNameById.get(income.accountId)].filter(Boolean) : accountNames;
        for (const accountName of names) {
            pushMatch({
                id: income.id,
                type: 'income',
                date: income.date,
                amount: income.amount,
                description: income.description,
                accountName: income.account?.name || accountName || null,
            });
        }
    }

    return matchesByKey;
}

function buildPreviewRows(transactions: ChaseTransaction[], matchesByKey: Map<string, ExistingMatch[]>) {
    return transactions.map((transaction) => {
        const type = transaction.kind;
        const matches = matchesByKey.get(matchKey(type, transaction.date, transaction.displayAmount, transaction.accountName)) || [];
        const normalizedImportDescription = normalizeForMatch(transaction.description);
        const hasExactDescriptionMatch = matches.some((match) =>
            normalizeForMatch(match.description) === normalizedImportDescription
        );
        const duplicateStatus: DuplicateStatus = hasExactDescriptionMatch
            ? 'exact_duplicate'
            : matches.length > 0
                ? 'possible_duplicate'
                : 'new';

        return {
            id: transaction.importHash,
            date: transaction.date,
            description: `${transaction.accountName}: ${transaction.description}`,
            amount: transaction.displayAmount,
            type,
            category: transaction.category,
            source: transaction.source,
            fileName: transaction.fileName,
            isTransferLike: transaction.isTransferLike,
            duplicateStatus,
            selectedByDefault: transaction.selectedByDefault && duplicateStatus === 'new',
            existingMatches: matches.slice(0, 3),
        };
    });
}

async function getOrCreateAccounts(rows: Array<{ accountName: string; accountType: string }>) {
    const byName = new Map<string, string>();
    rows.forEach((row) => byName.set(row.accountName, row.accountType));

    const accountMap = new Map<string, number>();
    for (const [name, type] of byName) {
        let account = await prisma.account.findFirst({ where: { name } });
        if (!account) {
            account = await prisma.account.create({
                data: {
                    name,
                    type,
                    balance: 0,
                },
            });
        }
        accountMap.set(name, account.id);
    }

    return accountMap;
}

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const formData = await request.formData();
        const files = formData.getAll('files').filter((file): file is File => file instanceof File);
        const commit = booleanFormValue(formData.get('commit'));
        const selectedImportHashes = parseSelectedImportHashes(formData.get('selectedImportHashes'));

        if (files.length === 0) {
            return NextResponse.json({ error: 'At least one Chase staging CSV file is required' }, { status: 400 });
        }

        const parsedFiles = await Promise.all(files.map(async (file) => {
            const text = await file.text();
            return {
                fileName: file.name,
                ...(parseChaseStagingCsv(text) as ParsedChaseFile),
            };
        }));

        const allTransactions: ChaseTransaction[] = parsedFiles.flatMap((file) =>
            file.transactions.map((transaction: Omit<ChaseTransaction, 'fileName'>) => ({
                ...transaction,
                accountName: canonicalAccountName(transaction.accountName),
                fileName: file.fileName,
            }))
        );
        const uniqueTransactions = [...new Map(
            allTransactions.map((transaction) => [transaction.importHash, transaction])
        ).values()];
        const matchesByKey = await findExistingMatches(uniqueTransactions);
        const allPreviewRows = buildPreviewRows(uniqueTransactions, matchesByKey);
        const importHashByStatus = new Map(allPreviewRows.map((row) => [row.id, row.duplicateStatus]));
        const defaultSelectedImportHashes = new Set(
            allPreviewRows
                .filter((row) => row.selectedByDefault)
                .map((row) => row.id)
        );
        const activeSelectedImportHashes = commit ? selectedImportHashes : defaultSelectedImportHashes;
        const transactionsToImport = uniqueTransactions.filter((transaction) =>
            activeSelectedImportHashes?.has(transaction.importHash)
        );

        if (commit && (!selectedImportHashes || selectedImportHashes.size === 0)) {
            return NextResponse.json({ error: 'Select at least one row to import' }, { status: 400 });
        }

        const expenses: ExpenseImportRow[] = transactionsToImport
            .filter((transaction) => transaction.kind === 'expense')
            .map((transaction) => ({
                amount: transaction.displayAmount,
                category: transaction.category || 'Uncategorized',
                date: transaction.date,
                description: transaction.description,
                importSource: transaction.importSource,
                importHash: transaction.importHash,
                accountName: transaction.accountName,
                accountType: transaction.accountType,
            }));

        const incomes: IncomeImportRow[] = transactionsToImport
            .filter((transaction) => transaction.kind === 'income')
            .map((transaction) => ({
                amount: transaction.displayAmount,
                source: transaction.source || 'Credit/Payment',
                date: transaction.date,
                description: transaction.description,
                notes: `Imported from ${transaction.fileName}`,
                importSource: transaction.importSource,
                importHash: transaction.importHash,
                accountName: transaction.accountName,
                accountType: transaction.accountType,
            }));

        const summary = {
            files: files.length,
            parsedTransactions: allTransactions.length,
            skippedParserRows: parsedFiles.reduce((sum, file) => sum + file.skippedRows.length, 0),
            skippedTransfers: uniqueTransactions.filter((transaction) => transaction.isTransferLike).length,
            duplicateRowsInFiles: allTransactions.length - uniqueTransactions.length,
            importableTransactions: uniqueTransactions.length,
            expenses: uniqueTransactions.filter((transaction) => transaction.kind === 'expense').length,
            incomes: uniqueTransactions.filter((transaction) => transaction.kind === 'income').length,
            selectedTransactions: transactionsToImport.length,
            selectedExpenses: expenses.length,
            selectedIncomes: incomes.length,
            possibleDuplicates: allPreviewRows.filter((row) => row.duplicateStatus === 'possible_duplicate').length,
            exactDuplicates: allPreviewRows.filter((row) => row.duplicateStatus === 'exact_duplicate').length,
            selectedDuplicates: transactionsToImport.filter((transaction) => {
                const status = importHashByStatus.get(transaction.importHash);
                return status === 'possible_duplicate' || status === 'exact_duplicate';
            }).length,
            latestEndingBalance: null,
            latestEndingDate: null,
        };
        const previewRows = allPreviewRows.slice(0, 200);

        if (!commit) {
            return NextResponse.json({ summary, rows: previewRows });
        }

        const allRowsForAccounts = [
            ...expenses.map((row) => ({ accountName: row.accountName, accountType: row.accountType })),
            ...incomes.map((row) => ({ accountName: row.accountName, accountType: row.accountType })),
        ];
        const accountIdsByName = await getOrCreateAccounts(allRowsForAccounts);

        const categories = [...new Set(expenses.map((row) => row.category))];
        for (const category of categories) {
            await ensureCategory(category);
        }

        const [expenseResult, incomeResult] = await prisma.$transaction([
            prisma.expense.createMany({
                data: expenses.map((row) => {
                    const rest = toExpenseCreateInput(row);
                    return {
                        ...omitImportMetadata(rest),
                        accountId: accountIdsByName.get(row.accountName) || null,
                    };
                }),
            }),
            prisma.income.createMany({
                data: incomes.map((row) => {
                    const rest = toIncomeCreateInput(row);
                    return {
                        ...omitImportMetadata(rest),
                        accountId: accountIdsByName.get(row.accountName) || null,
                    };
                }),
            }),
        ]);

        return NextResponse.json({
            summary,
            rows: previewRows,
            result: {
                accountId: [...accountIdsByName.values()][0] || 0,
                createdExpenses: expenseResult.count,
                createdIncomes: incomeResult.count,
                accountBalanceSynced: false,
            },
        });
    } catch (error) {
        console.error('Chase import error:', error);
        return NextResponse.json({ error: 'Failed to process Chase staging CSV import' }, { status: 500 });
    }
}

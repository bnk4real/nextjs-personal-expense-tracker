import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { parseBofaCsv } from '@/lib/importers/bofa-csv';
import {
    centsToDollars,
    normalizeTransaction,
    provenanceCreateData,
} from '@/lib/transactions/contract';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

type DecodedToken = {
    user_id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
};

type BofaTransaction = {
    rowNumber: number;
    date: string;
    description: string;
    amount: number;
    runningBalance: number | null;
    importSource: string;
    importHash: string;
    kind: 'expense' | 'income';
    source: string | null;
    category: string | null;
    isTransferLike: boolean;
    fileName: string;
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

type ParsedBofaFile = {
    summary: {
        endingDate: string | null;
        endingBalance: number | null;
    };
    transactions: Array<Omit<BofaTransaction, 'fileName'>>;
    skippedRows: Array<unknown>;
};

type PreviewRow = {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'expense' | 'income';
    category: string | null;
    source: string | null;
    fileName: string;
    isTransferLike: boolean;
    duplicateStatus: DuplicateStatus;
    selectedByDefault: boolean;
    existingMatches: ExistingMatch[];
};

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

function latestEndingBalance(parsedFiles: Array<{
    summary: {
        endingDate: string | null;
        endingBalance: number | null;
    };
}>) {
    return parsedFiles
        .map((file) => file.summary)
        .filter((summary) => summary.endingDate && summary.endingBalance !== null)
        .sort((a, b) => String(a.endingDate).localeCompare(String(b.endingDate)))
        .at(-1);
}

function canonicalAccountName(name: string) {
    const aliases: Record<string, string> = {
        'Bank of America Checking': 'Bank of America',
    };

    return aliases[name] || name;
}

async function ensureCategory(name: string) {
    const existing = await prisma.category.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.category.create({ data: { name } });
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

function amountKeyVariants(value: number) {
    const amount = Math.abs(value);
    return [
        amount,
        amount - 0.01,
        amount + 0.01,
    ].map((candidate) => candidate.toFixed(2));
}

function matchKey(type: 'expense' | 'income', date: string, amount: number) {
    return `${type}|${date}|${amountKey(amount)}`;
}

async function findExistingMatches(transactions: BofaTransaction[], accountName: string) {
    const account = await prisma.account.findFirst({ where: { name: accountName } });
    const dates = [...new Set(transactions.map((transaction) => transaction.date))];
    const expenseAmounts = [...new Set(
        transactions
            .filter((transaction) => transaction.kind === 'expense')
            .flatMap((transaction) => amountKeyVariants(transaction.amount).map(Number))
    )];
    const incomeAmounts = [...new Set(
        transactions
            .filter((transaction) => transaction.kind === 'income')
            .flatMap((transaction) => amountKeyVariants(transaction.amount).map(Number))
    )];
    const accountFilter = account
        ? { OR: [{ accountId: account.id }, { accountId: null }] }
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
                    account: { select: { name: true } },
                },
            })
            : Promise.resolve([]),
    ]);

    const matchesByKey = new Map<string, ExistingMatch[]>();

    for (const expense of existingExpenses) {
        for (const amountVariant of amountKeyVariants(expense.amount)) {
            const key = `expense|${expense.date}|${amountVariant}`;
            const matches = matchesByKey.get(key) || [];
            matches.push({
                id: expense.id,
                type: 'expense',
                date: expense.date,
                amount: expense.amount,
                description: expense.description,
                accountName: expense.account?.name || null,
            });
            matchesByKey.set(key, matches);
        }
    }

    for (const income of existingIncomes) {
        for (const amountVariant of amountKeyVariants(income.amount)) {
            const key = `income|${income.date}|${amountVariant}`;
            const matches = matchesByKey.get(key) || [];
            matches.push({
                id: income.id,
                type: 'income',
                date: income.date,
                amount: income.amount,
                description: income.description,
                accountName: income.account?.name || null,
            });
            matchesByKey.set(key, matches);
        }
    }

    return matchesByKey;
}

function buildPreviewRows(
    transactions: BofaTransaction[],
    matchesByKey: Map<string, ExistingMatch[]>,
    importedHashes: Set<string>
): PreviewRow[] {
    return transactions.map((transaction) => {
        const type = transaction.kind;
        const matches = matchesByKey.get(matchKey(type, transaction.date, transaction.amount)) || [];
        const normalizedImportDescription = normalizeForMatch(transaction.description);
        const hasExactDescriptionMatch = matches.some((match) =>
            normalizeForMatch(match.description) === normalizedImportDescription
        );
        const duplicateStatus: DuplicateStatus = importedHashes.has(transaction.importHash) || hasExactDescriptionMatch
            ? 'exact_duplicate'
            : matches.length > 0
                ? 'possible_duplicate'
                : 'new';

        return {
            id: transaction.importHash,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            type,
            category: transaction.category,
            source: transaction.source,
            fileName: transaction.fileName,
            isTransferLike: transaction.isTransferLike,
            duplicateStatus,
            selectedByDefault: duplicateStatus === 'new' && !transaction.isTransferLike,
            existingMatches: matches.slice(0, 3),
        };
    });
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
        const accountName = canonicalAccountName(String(formData.get('accountName') || 'Bank of America'));
        const accountType = String(formData.get('accountType') || 'Bank Account');
        const includeTransfers = booleanFormValue(formData.get('includeTransfers'));
        const commit = booleanFormValue(formData.get('commit'));
        const syncBalance = !booleanFormValue(formData.get('skipBalanceSync'));
        const selectedImportHashes = parseSelectedImportHashes(formData.get('selectedImportHashes'));

        if (files.length === 0) {
            return NextResponse.json({ error: 'At least one CSV file is required' }, { status: 400 });
        }

        const parsedFiles = await Promise.all(files.map(async (file) => {
            const text = await file.text();
            return {
                fileName: file.name,
                ...(parseBofaCsv(text, { accountName }) as ParsedBofaFile),
            };
        }));

        const allTransactions: BofaTransaction[] = parsedFiles.flatMap((file) =>
            file.transactions.map((transaction: Omit<BofaTransaction, 'fileName'>) => ({
                ...transaction,
                fileName: file.fileName,
            }))
        );
        const filteredTransactions = allTransactions.filter((transaction) =>
            includeTransfers ? true : !transaction.isTransferLike
        );
        const uniqueTransactions = [...new Map(
            filteredTransactions.map((transaction) => [transaction.importHash, transaction])
        ).values()];
        const [matchesByKey, importedProvenance] = await Promise.all([
            findExistingMatches(uniqueTransactions, accountName),
            prisma.transactionProvenance.findMany({
                where: {
                    userId: decoded.user_id,
                    importHash: { in: uniqueTransactions.map((transaction) => transaction.importHash) },
                },
                select: { importHash: true },
            }),
        ]);
        const importedHashes = new Set(
            importedProvenance
                .map((item) => item.importHash)
                .filter((hash): hash is string => Boolean(hash))
        );
        const allPreviewRows = buildPreviewRows(uniqueTransactions, matchesByKey, importedHashes);
        const importHashByStatus = new Map(allPreviewRows.map((row) => [row.id, row.duplicateStatus]));
        const defaultSelectedImportHashes = new Set(
            allPreviewRows
                .filter((row) => row.selectedByDefault)
                .map((row) => row.id)
        );
        const activeSelectedImportHashes = commit ? selectedImportHashes : defaultSelectedImportHashes;
        const transactionsToImport = uniqueTransactions.filter((transaction) =>
            activeSelectedImportHashes?.has(transaction.importHash) &&
            !transaction.isTransferLike &&
            !importedHashes.has(transaction.importHash)
        );

        if (commit && (!selectedImportHashes || selectedImportHashes.size === 0)) {
            return NextResponse.json({ error: 'Select at least one row to import' }, { status: 400 });
        }

        if (commit && transactionsToImport.length === 0) {
            return NextResponse.json({ error: 'Selected rows are transfers or already imported, so nothing can be imported.' }, { status: 400 });
        }

        const normalizedTransactions = transactionsToImport.map((transaction) => ({
            sourceRow: transaction,
            normalized: normalizeTransaction({
                kind: transaction.kind,
                amount: transaction.amount,
                date: transaction.date,
                description: transaction.description,
                originalDescription: transaction.description,
                category: transaction.category,
                incomeSource: transaction.source,
                isTransferLike: transaction.isTransferLike,
                provenance: {
                    sourceType: 'file_import',
                    source: transaction.importSource,
                    importHash: transaction.importHash,
                    rawPayload: {
                        fileName: transaction.fileName,
                        rowNumber: transaction.rowNumber,
                        signedAmount: transaction.amount,
                        runningBalance: transaction.runningBalance,
                    },
                },
            }),
        }));
        const expenses = normalizedTransactions.filter(({ normalized }) => normalized.kind === 'expense');
        const incomes = normalizedTransactions.filter(({ normalized }) => normalized.kind === 'income');

        const ending = latestEndingBalance(parsedFiles);
        const summary = {
            files: files.length,
            parsedTransactions: allTransactions.length,
            skippedParserRows: parsedFiles.reduce((sum, file) => sum + file.skippedRows.length, 0),
            skippedTransfers: allTransactions.length - filteredTransactions.length,
            duplicateRowsInFiles: filteredTransactions.length - uniqueTransactions.length,
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
            latestEndingBalance: ending?.endingBalance ?? null,
            latestEndingDate: ending?.endingDate ?? null,
        };

        const previewRows = allPreviewRows.slice(0, 200);

        if (!commit) {
            return NextResponse.json({ summary, rows: previewRows });
        }

        try {
            let account = await prisma.account.findFirst({ where: { name: accountName } });
            if (!account) {
                account = await prisma.account.create({
                    data: {
                        name: accountName,
                        type: accountType,
                        balance: ending?.endingBalance ?? 0,
                    },
                });
            }

            const categories = [...new Set(expenses.map(({ normalized }) => normalized.category || 'Uncategorized'))];
            for (const category of categories) {
                await ensureCategory(category);
            }

            const result = await prisma.$transaction(async (tx) => {
                let createdExpenses = 0;
                let createdIncomes = 0;

                for (const { sourceRow, normalized } of normalizedTransactions) {
                    const provenance = { create: provenanceCreateData(decoded.user_id, normalized) };

                    if (normalized.kind === 'expense') {
                        await tx.expense.create({
                            data: {
                                amount: centsToDollars(normalized.amountCents),
                                category: normalized.category || 'Uncategorized',
                                date: normalized.date,
                                description: normalized.description,
                                accountId: account.id,
                                provenance,
                            },
                        });
                        createdExpenses++;
                    } else if (normalized.kind === 'income') {
                        await tx.income.create({
                            data: {
                                amount: centsToDollars(normalized.amountCents),
                                source: normalized.incomeSource || 'Other',
                                date: normalized.date,
                                description: normalized.description,
                                notes: `Imported from ${sourceRow.fileName}`,
                                accountId: account.id,
                                provenance,
                            },
                        });
                        createdIncomes++;
                    }
                }

                return { createdExpenses, createdIncomes };
            });

            let accountBalanceSynced = false;
            if (syncBalance && ending?.endingBalance !== null && ending?.endingBalance !== undefined) {
                await prisma.account.update({
                    where: { id: account.id },
                    data: { balance: ending.endingBalance },
                });
                accountBalanceSynced = true;
            }

            return NextResponse.json({
                summary,
                rows: previewRows,
                result: {
                    accountId: account.id,
                    createdExpenses: result.createdExpenses,
                    createdIncomes: result.createdIncomes,
                    accountBalanceSynced,
                },
            });
        } catch (error) {
            throw error;
        }
    } catch (error) {
        console.error('BoFA import error:', error);
        return NextResponse.json({ error: 'Failed to process BoFA CSV import' }, { status: 500 });
    }
}

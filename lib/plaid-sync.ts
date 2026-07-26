import { Prisma, type PlaidItem } from '@prisma/client';
import type { AccountBase, RemovedTransaction, Transaction } from 'plaid';
import { prisma } from '@/lib/prisma';
import { decryptPlaidAccessToken, getPlaidClient, plaidErrorDetails } from '@/lib/plaid';

const TRANSFER_CATEGORIES = new Set(['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS']);

const CATEGORY_MAP: Record<string, string> = {
    BANK_FEES: 'Bank Fee',
    ENTERTAINMENT: 'Entertainment',
    FOOD_AND_DRINK: 'Food',
    GENERAL_MERCHANDISE: 'Shopping',
    GENERAL_SERVICES: 'Services',
    GOVERNMENT_AND_NON_PROFIT: 'Taxes & Fees',
    HOME_IMPROVEMENT: 'Home',
    INCOME: 'Income',
    MEDICAL: 'Medical',
    PERSONAL_CARE: 'Personal Care',
    RENT_AND_UTILITIES: 'Utilities',
    TRANSPORTATION: 'Transportation',
    TRAVEL: 'Travel',
};

type SyncChanges = {
    added: Transaction[];
    modified: Transaction[];
    removed: RemovedTransaction[];
    nextCursor: string;
};

function asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function accountType(account: AccountBase) {
    const type = String(account.type);
    const subtype = String(account.subtype || '');
    if (type === 'credit') return 'Credit Card';
    if (type === 'investment') return 'Investment';
    if (type === 'depository' && subtype === 'savings') return 'Savings';
    if (type === 'depository') return 'Bank Account';
    return 'Other';
}

function localBalance(account: AccountBase) {
    const current = account.balances.current ?? 0;
    return String(account.type) === 'credit' ? current : current;
}

function normalized(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function transactionCategory(transaction: Transaction) {
    const primary = transaction.personal_finance_category?.primary;
    return (primary && CATEGORY_MAP[primary]) || transaction.category?.[0] || 'Other';
}

function projectionKind(transaction: Transaction, linkedAccountType: string) {
    const primary = transaction.personal_finance_category?.primary;
    if (transaction.pending) return 'pending' as const;
    if (primary && TRANSFER_CATEGORIES.has(primary)) return 'review' as const;
    if (linkedAccountType === 'credit' && transaction.amount < 0) return 'review' as const;
    if (transaction.amount > 0) return 'expense' as const;
    if (linkedAccountType === 'depository' && transaction.amount < 0) return 'income' as const;
    return 'review' as const;
}

async function pullChanges(accessToken: string, initialCursor: string | null): Promise<SyncChanges> {
    const client = getPlaidClient();

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const added: Transaction[] = [];
        const modified: Transaction[] = [];
        const removed: RemovedTransaction[] = [];
        let cursor = initialCursor || undefined;

        try {
            let hasMore = true;
            while (hasMore) {
                const response = await client.transactionsSync({
                    access_token: accessToken,
                    cursor,
                    count: 500,
                    options: { include_personal_finance_category: true },
                });
                added.push(...response.data.added);
                modified.push(...response.data.modified);
                removed.push(...response.data.removed);
                cursor = response.data.next_cursor;
                hasMore = response.data.has_more;
            }

            return { added, modified, removed, nextCursor: cursor || '' };
        } catch (error) {
            if (plaidErrorDetails(error).code !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' || attempt === 2) {
                throw error;
            }
        }
    }

    throw new Error('Unable to complete Plaid pagination');
}

export async function upsertPlaidAccounts(plaidItemId: string, accounts: AccountBase[]) {
    const existingLocalAccounts = await prisma.account.findMany();
    const alreadyLinked = await prisma.plaidAccount.findMany({
        where: { plaidItemId },
        select: { localAccountId: true },
    });
    const claimed = new Set(alreadyLinked.flatMap((account) => account.localAccountId ? [account.localAccountId] : []));

    for (const account of accounts) {
        const mappedType = accountType(account);
        const names = [account.name, account.official_name].filter(Boolean).map((name) => normalized(name!));
        let local = existingLocalAccounts.find((candidate) => (
            !claimed.has(candidate.id)
            && candidate.type === mappedType
            && names.some((name) => {
                const candidateName = normalized(candidate.name);
                return candidateName === name || candidateName.includes(name) || name.includes(candidateName);
            })
        ));

        if (!local) {
            local = await prisma.account.create({
                data: {
                    name: account.official_name || account.name,
                    type: mappedType,
                    balance: localBalance(account),
                    creditLimit: account.balances.limit,
                },
            });
            existingLocalAccounts.push(local);
        }
        claimed.add(local.id);

        await prisma.plaidAccount.upsert({
            where: { accountId: account.account_id },
            create: {
                plaidItemId,
                accountId: account.account_id,
                localAccountId: local.id,
                name: account.name,
                officialName: account.official_name,
                mask: account.mask,
                type: String(account.type),
                subtype: account.subtype ? String(account.subtype) : null,
                currentBalance: account.balances.current,
                availableBalance: account.balances.available,
                creditLimit: account.balances.limit,
                currency: account.balances.iso_currency_code || account.balances.unofficial_currency_code,
            },
            update: {
                localAccountId: local.id,
                name: account.name,
                officialName: account.official_name,
                mask: account.mask,
                type: String(account.type),
                subtype: account.subtype ? String(account.subtype) : null,
                currentBalance: account.balances.current,
                availableBalance: account.balances.available,
                creditLimit: account.balances.limit,
                currency: account.balances.iso_currency_code || account.balances.unofficial_currency_code,
            },
        });

        await prisma.account.update({
            where: { id: local.id },
            data: {
                balance: localBalance(account),
                creditLimit: account.balances.limit,
            },
        });
    }
}

async function removeProjectedTransaction(transactionId: string) {
    const staged = await prisma.plaidTransaction.findUnique({
        where: { transactionId },
        include: { provenance: true },
    });
    if (!staged) return;

    await prisma.$transaction(async (tx) => {
        const provenance = staged.provenance;
        if (provenance?.expenseId) await tx.expense.delete({ where: { id: provenance.expenseId } });
        if (provenance?.incomeId) await tx.income.delete({ where: { id: provenance.incomeId } });
        if (provenance?.transferId) await tx.transfer.delete({ where: { id: provenance.transferId } });
        await tx.plaidTransaction.update({
            where: { id: staged.id },
            data: { status: 'removed', removedAt: new Date(), provenanceId: null },
        });
    });
}

async function stageAndProject(transaction: Transaction, item: PlaidItem) {
    const linkedAccount = await prisma.plaidAccount.findUnique({
        where: { accountId: transaction.account_id },
    });
    if (!linkedAccount) return 'skipped';

    const kind = projectionKind(transaction, linkedAccount.type);
    const isInImportWindow = transaction.date >= item.autoImportStartDate;
    const displayName = transaction.merchant_name || transaction.name;
    const amount = Math.abs(transaction.amount);
    const amountCents = Math.round(transaction.amount * 100);
    const currency = transaction.iso_currency_code || transaction.unofficial_currency_code || 'USD';

    const staged = await prisma.plaidTransaction.upsert({
        where: { transactionId: transaction.transaction_id },
        create: {
            plaidAccountId: linkedAccount.id,
            transactionId: transaction.transaction_id,
            pendingTransactionId: transaction.pending_transaction_id,
            date: transaction.date,
            authorizedDate: transaction.authorized_date,
            amountCents,
            currency,
            name: transaction.name,
            merchantName: transaction.merchant_name,
            categoryPrimary: transaction.personal_finance_category?.primary,
            categoryDetailed: transaction.personal_finance_category?.detailed,
            pending: transaction.pending,
            status: isInImportWindow ? kind : 'historical',
            rawPayload: asJson(transaction),
        },
        update: {
            plaidAccountId: linkedAccount.id,
            pendingTransactionId: transaction.pending_transaction_id,
            date: transaction.date,
            authorizedDate: transaction.authorized_date,
            amountCents,
            currency,
            name: transaction.name,
            merchantName: transaction.merchant_name,
            categoryPrimary: transaction.personal_finance_category?.primary,
            categoryDetailed: transaction.personal_finance_category?.detailed,
            pending: transaction.pending,
            status: isInImportWindow ? kind : 'historical',
            rawPayload: asJson(transaction),
            removedAt: null,
        },
        include: { provenance: true },
    });

    if (!isInImportWindow || (kind !== 'expense' && kind !== 'income')) return kind;

    await prisma.$transaction(async (tx) => {
        let provenanceId = staged.provenanceId;

        if (kind === 'expense') {
            const expense = staged.provenance?.expenseId
                ? await tx.expense.update({
                    where: { id: staged.provenance.expenseId },
                    data: {
                        amount,
                        category: transactionCategory(transaction),
                        date: transaction.date,
                        description: displayName,
                        accountId: linkedAccount.localAccountId,
                    },
                })
                : await tx.expense.create({
                    data: {
                        amount,
                        category: transactionCategory(transaction),
                        date: transaction.date,
                        description: displayName,
                        accountId: linkedAccount.localAccountId,
                    },
                });

            if (!provenanceId) {
                const provenance = await tx.transactionProvenance.create({
                    data: {
                        userId: item.userId,
                        sourceType: 'automatic',
                        source: 'plaid:transactions',
                        externalId: transaction.transaction_id,
                        currency,
                        originalDescription: transaction.name,
                        rawPayload: asJson(transaction),
                        lastSyncedAt: new Date(),
                        expenseId: expense.id,
                    },
                });
                provenanceId = provenance.id;
            }
        } else {
            const income = staged.provenance?.incomeId
                ? await tx.income.update({
                    where: { id: staged.provenance.incomeId },
                    data: {
                        amount,
                        source: transactionCategory(transaction),
                        date: transaction.date,
                        description: displayName,
                        accountId: linkedAccount.localAccountId,
                    },
                })
                : await tx.income.create({
                    data: {
                        amount,
                        source: transactionCategory(transaction),
                        date: transaction.date,
                        description: displayName,
                        accountId: linkedAccount.localAccountId,
                    },
                });

            if (!provenanceId) {
                const provenance = await tx.transactionProvenance.create({
                    data: {
                        userId: item.userId,
                        sourceType: 'automatic',
                        source: 'plaid:transactions',
                        externalId: transaction.transaction_id,
                        currency,
                        originalDescription: transaction.name,
                        rawPayload: asJson(transaction),
                        lastSyncedAt: new Date(),
                        incomeId: income.id,
                    },
                });
                provenanceId = provenance.id;
            }
        }

        await tx.plaidTransaction.update({
            where: { id: staged.id },
            data: { provenanceId, status: 'imported' },
        });
    });

    return 'imported';
}

export async function syncPlaidItem(itemId: string) {
    const item = await prisma.plaidItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('Plaid connection not found');

    const accessToken = decryptPlaidAccessToken(item.encryptedAccessToken);

    try {
        const client = getPlaidClient();
        const [changes, accountsResponse] = await Promise.all([
            pullChanges(accessToken, item.cursor),
            client.accountsGet({ access_token: accessToken }),
        ]);

        await upsertPlaidAccounts(item.id, accountsResponse.data.accounts);

        for (const removed of changes.removed) {
            await removeProjectedTransaction(removed.transaction_id);
        }

        let imported = 0;
        let review = 0;
        for (const transaction of [...changes.added, ...changes.modified]) {
            const result = await stageAndProject(transaction, item);
            if (result === 'imported') imported += 1;
            if (result === 'review' || result === 'pending') review += 1;
        }

        await prisma.plaidItem.update({
            where: { id: item.id },
            data: {
                cursor: changes.nextCursor,
                status: 'healthy',
                errorCode: null,
                errorMessage: null,
                lastSyncedAt: new Date(),
            },
        });

        return {
            imported,
            review,
            removed: changes.removed.length,
            received: changes.added.length + changes.modified.length,
        };
    } catch (error) {
        const details = plaidErrorDetails(error);
        await prisma.plaidItem.update({
            where: { id: item.id },
            data: {
                status: details.code === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error',
                errorCode: details.code,
                errorMessage: details.message,
            },
        });
        throw error;
    }
}

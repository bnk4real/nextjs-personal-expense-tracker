import { Prisma } from '@prisma/client';

export function isCreditCardAccount(type: string) {
    return type.trim().toLowerCase() === 'credit card';
}

export async function applyExpenseBalanceChange(
    tx: Prisma.TransactionClient,
    accountId: number,
    amount: number,
    direction: 1 | -1
) {
    const account = await tx.account.findUnique({
        where: { id: accountId },
        select: { id: true, balance: true, creditLimit: true, type: true },
    });

    if (!account) {
        throw new Error('ACCOUNT_NOT_FOUND');
    }

    const isCreditCard = isCreditCardAccount(account.type);
    const nextBalance = isCreditCard
        ? account.balance + amount * direction
        : account.balance - amount * direction;

    if (direction === 1 && !isCreditCard && nextBalance < 0) {
        throw new Error('INSUFFICIENT_ACCOUNT_BALANCE');
    }

    if (
        direction === 1 &&
        isCreditCard &&
        account.creditLimit !== null &&
        nextBalance > account.creditLimit
    ) {
        throw new Error('INSUFFICIENT_AVAILABLE_CREDIT');
    }

    await tx.account.update({
        where: { id: account.id },
        data: { balance: nextBalance },
    });
}

export function expenseBalanceError(error: unknown) {
    if (!(error instanceof Error)) return null;

    if (error.message === 'ACCOUNT_NOT_FOUND') {
        return { error: 'Account not found', status: 404 };
    }
    if (error.message === 'INSUFFICIENT_ACCOUNT_BALANCE') {
        return { error: 'Insufficient account balance', status: 400 };
    }
    if (error.message === 'INSUFFICIENT_AVAILABLE_CREDIT') {
        return { error: 'Insufficient available credit', status: 400 };
    }

    return null;
}

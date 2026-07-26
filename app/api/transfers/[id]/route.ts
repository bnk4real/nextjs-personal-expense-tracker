import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isCreditCardAccount } from '@/lib/account-balances';

function parseOptionalAccountId(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function shouldAffectBalance(value: unknown) {
    return value !== false;
}

async function applyTransferBalanceChanges(
    tx: Prisma.TransactionClient,
    transfer: { amount: number; fromAccountId: number | null; toAccountId: number | null },
    direction: 1 | -1
) {
    const accountIds = [transfer.fromAccountId, transfer.toAccountId].filter((id): id is number => id !== null);
    if (accountIds.length === 0) return;

    const accounts = await tx.account.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, type: true },
    });
    const accountTypeById = new Map(accounts.map((account) => [account.id, account.type]));

    if (transfer.fromAccountId) {
        const type = accountTypeById.get(transfer.fromAccountId);
        const delta = type && isCreditCardAccount(type) ? transfer.amount : -transfer.amount;
        await tx.account.update({
            where: { id: transfer.fromAccountId },
            data: { balance: { increment: delta * direction } },
        });
    }

    if (transfer.toAccountId) {
        const type = accountTypeById.get(transfer.toAccountId);
        const delta = type && isCreditCardAccount(type) ? -transfer.amount : transfer.amount;
        await tx.account.update({
            where: { id: transfer.toAccountId },
            data: { balance: { increment: delta * direction } },
        });
    }
}

async function assertTransferAccounts(
    tx: Prisma.TransactionClient,
    transfer: {
        amount: number;
        fromAccountId: number | null;
        toAccountId: number | null;
        affectsBalance: boolean;
    }
) {
    const uniqueAccountIds = [...new Set(
        [transfer.fromAccountId, transfer.toAccountId].filter((id): id is number => id !== null)
    )];
    if (uniqueAccountIds.length === 0) return;

    const accounts = await tx.account.findMany({
        where: { id: { in: uniqueAccountIds } },
        select: { id: true, type: true, balance: true },
    });

    if (accounts.length !== uniqueAccountIds.length) {
        throw new Error('ACCOUNT_NOT_FOUND');
    }

    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const fromAccount = transfer.fromAccountId ? accountById.get(transfer.fromAccountId) : null;
    const toAccount = transfer.toAccountId ? accountById.get(transfer.toAccountId) : null;
    const fromIsCreditCard = Boolean(fromAccount && isCreditCardAccount(fromAccount.type));
    const toIsCreditCard = Boolean(toAccount && isCreditCardAccount(toAccount.type));

    if (fromIsCreditCard || toIsCreditCard) {
        if (!fromAccount || !toAccount || fromIsCreditCard || !toIsCreditCard) {
            throw new Error('INVALID_CREDIT_CARD_PAYMENT');
        }

        if (transfer.affectsBalance && fromAccount.balance < transfer.amount) {
            throw new Error('INSUFFICIENT_ACCOUNT_BALANCE');
        }

        if (transfer.affectsBalance && toAccount.balance < transfer.amount) {
            throw new Error('PAYMENT_EXCEEDS_CARD_BALANCE');
        }
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { amount, date, description, fromAccountId, toAccountId, affectsBalance } = await request.json();
        const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
        const parsedFromAccountId = parseOptionalAccountId(fromAccountId);
        const parsedToAccountId = parseOptionalAccountId(toAccountId);
        const parsedAffectsBalance = shouldAffectBalance(affectsBalance);

        if (!parsedAmount || parsedAmount <= 0 || !date || !description) {
            return NextResponse.json({ error: 'Amount, date, and description are required' }, { status: 400 });
        }

        if (!parsedFromAccountId && !parsedToAccountId) {
            return NextResponse.json({ error: 'Select at least one account for the transfer' }, { status: 400 });
        }

        if (parsedFromAccountId && parsedToAccountId && parsedFromAccountId === parsedToAccountId) {
            return NextResponse.json({ error: 'From and to accounts must be different' }, { status: 400 });
        }

        const transfer = await prisma.$transaction(async (tx) => {
            const currentTransfer = await tx.transfer.findUnique({
                where: { id: parseInt(id, 10) },
            });

            if (!currentTransfer) {
                throw new Error('TRANSFER_NOT_FOUND');
            }

            if (currentTransfer.affectsBalance) {
                await applyTransferBalanceChanges(tx, currentTransfer, -1);
            }

            await assertTransferAccounts(tx, {
                amount: parsedAmount,
                fromAccountId: parsedFromAccountId,
                toAccountId: parsedToAccountId,
                affectsBalance: parsedAffectsBalance,
            });

            if (parsedAffectsBalance) {
                await applyTransferBalanceChanges(tx, {
                    amount: parsedAmount,
                    fromAccountId: parsedFromAccountId,
                    toAccountId: parsedToAccountId,
                }, 1);
            }

            return tx.transfer.update({
                where: { id: parseInt(id, 10) },
                data: {
                    amount: parsedAmount,
                    date,
                    description,
                    fromAccountId: parsedFromAccountId,
                    toAccountId: parsedToAccountId,
                    affectsBalance: parsedAffectsBalance,
                },
                include: {
                    fromAccount: true,
                    toAccount: true,
                },
            });
        });

        return NextResponse.json(transfer);
    } catch (error) {
        if (error instanceof Error && error.message === 'TRANSFER_NOT_FOUND') {
            return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
        }

        if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (error instanceof Error && error.message === 'INVALID_CREDIT_CARD_PAYMENT') {
            return NextResponse.json({ error: 'Credit card payments must move money from a non-credit account to a credit card.' }, { status: 400 });
        }

        if (error instanceof Error && error.message === 'INSUFFICIENT_ACCOUNT_BALANCE') {
            return NextResponse.json({ error: 'Insufficient balance in the payment account.' }, { status: 400 });
        }

        if (error instanceof Error && error.message === 'PAYMENT_EXCEEDS_CARD_BALANCE') {
            return NextResponse.json({ error: 'Payment cannot exceed the current credit card balance.' }, { status: 400 });
        }

        console.error('Error updating transfer:', error);
        return NextResponse.json({ error: 'Failed to update transfer' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.$transaction(async (tx) => {
            const transfer = await tx.transfer.findUnique({
                where: { id: parseInt(id, 10) },
            });

            if (!transfer) {
                throw new Error('TRANSFER_NOT_FOUND');
            }

            if (transfer.affectsBalance) {
                await applyTransferBalanceChanges(tx, transfer, -1);
            }

            await tx.transfer.delete({
                where: { id: transfer.id },
            });
        });

        return NextResponse.json({ message: 'Transfer deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.message === 'TRANSFER_NOT_FOUND') {
            return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
        }

        console.error('Error deleting transfer:', error);
        return NextResponse.json({ error: 'Failed to delete transfer' }, { status: 500 });
    }
}

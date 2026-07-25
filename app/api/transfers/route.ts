import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function parseOptionalAccountId(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function shouldAffectBalance(value: unknown) {
    return value !== false;
}

function isCreditCard(type: string) {
    return type.toLowerCase() === 'credit card';
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
        const delta = type && isCreditCard(type) ? transfer.amount : -transfer.amount;
        await tx.account.update({
            where: { id: transfer.fromAccountId },
            data: { balance: { increment: delta * direction } },
        });
    }

    if (transfer.toAccountId) {
        const type = accountTypeById.get(transfer.toAccountId);
        const delta = type && isCreditCard(type) ? -transfer.amount : transfer.amount;
        await tx.account.update({
            where: { id: transfer.toAccountId },
            data: { balance: { increment: delta * direction } },
        });
    }
}

async function assertTransferAccounts(
    tx: Prisma.TransactionClient,
    accountIds: number[]
) {
    const uniqueAccountIds = [...new Set(accountIds)];
    if (uniqueAccountIds.length === 0) return;

    const accounts = await tx.account.findMany({
        where: { id: { in: uniqueAccountIds } },
        select: { id: true, type: true },
    });

    if (accounts.length !== uniqueAccountIds.length) {
        throw new Error('ACCOUNT_NOT_FOUND');
    }

    if (accounts.some((account) => isCreditCard(account.type))) {
        throw new Error('CREDIT_CARD_PAYMENT_NOT_TRANSFER');
    }
}

export async function GET() {
    try {
        const transfers = await prisma.transfer.findMany({
            include: {
                fromAccount: true,
                toAccount: true,
            },
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        return NextResponse.json(transfers);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
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
            await assertTransferAccounts(
                tx,
                [parsedFromAccountId, parsedToAccountId].filter((id): id is number => id !== null)
            );

            if (parsedAffectsBalance) {
                await applyTransferBalanceChanges(tx, {
                    amount: parsedAmount,
                    fromAccountId: parsedFromAccountId,
                    toAccountId: parsedToAccountId,
                }, 1);
            }

            return tx.transfer.create({
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

        return NextResponse.json(transfer, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (error instanceof Error && error.message === 'CREDIT_CARD_PAYMENT_NOT_TRANSFER') {
            return NextResponse.json({ error: 'Credit card payments are not transfers. Leave them out of income, expense, and transfer records.' }, { status: 400 });
        }

        console.error('Error creating transfer:', error);
        return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
    }
}

/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyExpenseBalanceChange, expenseBalanceError } from '@/lib/account-balances';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: parseInt(id) },
        });
        if (!expense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }
        return NextResponse.json(expense);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const { amount, category, date, description, accountId } = await request.json();

        const newAmount = parseFloat(amount);
        const expense = await prisma.$transaction(async (tx) => {
            const currentExpense = await tx.expense.findUnique({
                where: { id: parseInt(id, 10) },
            });

            if (!currentExpense) {
                throw new Error('EXPENSE_NOT_FOUND');
            }

            const newAccountId = accountId === undefined
                ? currentExpense.accountId
                : accountId
                    ? parseInt(accountId, 10)
                    : null;

            if (currentExpense.accountId !== newAccountId || currentExpense.amount !== newAmount) {
                if (currentExpense.accountId) {
                    await applyExpenseBalanceChange(
                        tx,
                        currentExpense.accountId,
                        currentExpense.amount,
                        -1
                    );
                }
                if (newAccountId) {
                    await applyExpenseBalanceChange(tx, newAccountId, newAmount, 1);
                }
            }

            const expenseData: Prisma.ExpenseUncheckedUpdateInput = {
                amount: newAmount,
                category,
                date,
                description,
                accountId: newAccountId,
            };

            return tx.expense.update({
                where: { id: currentExpense.id },
                data: expenseData,
                include: { account: true },
            });
        });
        return NextResponse.json(expense);
    } catch (error) {
        if (error instanceof Error && error.message === 'EXPENSE_NOT_FOUND') {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }
        const balanceError = expenseBalanceError(error);
        if (balanceError) {
            return NextResponse.json({ error: balanceError.error }, { status: balanceError.status });
        }
        return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        await prisma.$transaction(async (tx) => {
            const expense = await tx.expense.findUnique({
                where: { id: parseInt(id, 10) },
            });

            if (!expense) {
                throw new Error('EXPENSE_NOT_FOUND');
            }

            if (expense.accountId) {
                await applyExpenseBalanceChange(tx, expense.accountId, expense.amount, -1);
            }

            await tx.expense.delete({ where: { id: expense.id } });
        });
        return NextResponse.json({ message: 'Expense deleted and amount refunded' });
    } catch (error) {
        if (error instanceof Error && error.message === 'EXPENSE_NOT_FOUND') {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }
        const balanceError = expenseBalanceError(error);
        if (balanceError) {
            return NextResponse.json({ error: balanceError.error }, { status: balanceError.status });
        }
        return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
    }
}

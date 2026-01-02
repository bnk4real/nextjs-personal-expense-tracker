/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

        // Get the current expense to compare changes
        const currentExpense = await prisma.expense.findUnique({
            where: { id: parseInt(id) },
            include: { account: true }
        });

        if (!currentExpense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        const newAmount = parseFloat(amount);
        const expenseData: any = {
            amount: newAmount,
            category,
            date,
            description
        };

        // Handle account changes
        if (accountId !== undefined) {
            const newAccountId = accountId ? parseInt(accountId) : null;

            // If account changed or amount changed, we need to adjust balances
            if (currentExpense.accountId !== newAccountId || currentExpense.amount !== newAmount) {

                // Refund amount to old account if it existed
                if (currentExpense.accountId) {
                    const oldAccount = await prisma.account.findUnique({
                        where: { id: currentExpense.accountId }
                    });
                    if (oldAccount) {
                        await prisma.account.update({
                            where: { id: currentExpense.accountId },
                            data: { balance: oldAccount.balance + currentExpense.amount }
                        });
                    }
                }

                // Deduct from new account if specified
                if (newAccountId) {
                    const newAccount = await prisma.account.findUnique({
                        where: { id: newAccountId }
                    });
                    if (!newAccount) {
                        return NextResponse.json({ error: 'New account not found' }, { status: 404 });
                    }
                    if (newAccount.balance < newAmount) {
                        return NextResponse.json({ error: 'Insufficient account balance' }, { status: 400 });
                    }
                    await prisma.account.update({
                        where: { id: newAccountId },
                        data: { balance: newAccount.balance - newAmount }
                    });
                }
            }

            expenseData.accountId = newAccountId;
        }

        const expense = await prisma.expense.update({
            where: { id: parseInt(id) },
            data: expenseData,
            include: { account: true }
        });
        return NextResponse.json(expense);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        // Get the expense before deleting to refund the amount
        const expense = await prisma.expense.findUnique({
            where: { id: parseInt(id) },
            include: { account: true }
        });

        if (!expense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        // Refund amount to account if it was linked to one
        if (expense.accountId) {
            await prisma.account.update({
                where: { id: expense.accountId },
                data: { balance: expense.account.balance + expense.amount }
            });
        }

        await prisma.expense.delete({
            where: { id: parseInt(id) },
        });
        return NextResponse.json({ message: 'Expense deleted and amount refunded' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
    }
}
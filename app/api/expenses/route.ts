/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyExpenseBalanceChange, expenseBalanceError } from '@/lib/account-balances';

export async function GET() {
    try {
        const expenses = await prisma.expense.findMany({
            include: { account: true },
            orderBy: { date: 'desc' },
        });
        return NextResponse.json(expenses);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { amount, category, date, description, accountId } = await request.json();
        if (!amount || !category || !date || !description) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        const expenseData: Prisma.ExpenseUncheckedCreateInput = {
            amount: parseFloat(amount),
            category,
            date,
            description
        };

        const parsedAccountId = accountId ? parseInt(accountId, 10) : null;
        if (parsedAccountId) expenseData.accountId = parsedAccountId;

        const expense = await prisma.$transaction(async (tx) => {
            if (parsedAccountId) {
                await applyExpenseBalanceChange(tx, parsedAccountId, parseFloat(amount), 1);
            }

            return tx.expense.create({
                data: expenseData,
                include: { account: true },
            });
        });
        return NextResponse.json(expense, { status: 201 });
    } catch (error) {
        const balanceError = expenseBalanceError(error);
        if (balanceError) {
            return NextResponse.json({ error: balanceError.error }, { status: balanceError.status });
        }
        return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
    }
}

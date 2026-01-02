/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

        const expenseData: any = {
            amount: parseFloat(amount),
            category,
            date,
            description
        };

        // If accountId is provided, link the expense to the account and deduct from balance
        if (accountId) {
            expenseData.accountId = parseInt(accountId);

            // Check if account has sufficient balance
            const account = await prisma.account.findUnique({
                where: { id: parseInt(accountId) }
            });

            if (!account) {
                return NextResponse.json({ error: 'Account not found' }, { status: 404 });
            }

            if (account.balance < parseFloat(amount)) {
                return NextResponse.json({ error: 'Insufficient account balance' }, { status: 400 });
            }

            // Deduct from account balance
            await prisma.account.update({
                where: { id: parseInt(accountId) },
                data: { balance: account.balance - parseFloat(amount) }
            });
        }

        const expense = await prisma.expense.create({
            data: expenseData,
            include: { account: true }
        });
        return NextResponse.json(expense, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
    }
}
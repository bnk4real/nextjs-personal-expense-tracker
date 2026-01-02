import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/incomes - Get all incomes
export async function GET() {
    try {
        const incomes = await prisma.income.findMany({
            include: {
                account: true
            },
            orderBy: {
                date: 'desc'
            }
        });

        return NextResponse.json(incomes);
    } catch (error) {
        console.error('Error fetching incomes:', error);
        return NextResponse.json(
            { error: 'Failed to fetch incomes' },
            { status: 500 }
        );
    }
}

// POST /api/incomes - Create a new income
export async function POST(request: NextRequest) {
    try {
        const { amount, source, date, description, notes, accountId, state, filingStatus } = await request.json();

        if (!amount || !source || !date || !description) {
            return NextResponse.json(
                { error: 'Amount, source, date, and description are required' },
                { status: 400 }
            );
        }

        // Create the income
        const income = await prisma.income.create({
            data: {
                amount: parseFloat(amount),
                source,
                date,
                description,
                notes,
                state,
                filingStatus,
                accountId: accountId ? parseInt(accountId) : null,
            },
            include: {
                account: true
            }
        });

        // Update account balance if account is specified
        if (accountId) {
            await prisma.account.update({
                where: { id: parseInt(accountId) },
                data: {
                    balance: {
                        increment: parseFloat(amount)
                    },
                    updatedAt: new Date()
                }
            });
        }

        return NextResponse.json(income, { status: 201 });
    } catch (error) {
        console.error('Error creating income:', error);
        return NextResponse.json(
            { error: 'Failed to create income' },
            { status: 500 }
        );
    }
}
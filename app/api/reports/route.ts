import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface IncomeWithAccount {
    id: number;
    amount: number;
    source: string;
    date: string;
    description: string;
    accountId: number | null;
    account: { name: string } | null;
}

interface ExpenseWithAccount {
    id: number;
    amount: number;
    category: string;
    date: string;
    description: string;
    accountId: number | null;
    account: { name: string } | null;
}

type TransactionWithAccount = IncomeWithAccount | ExpenseWithAccount;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'incomes' or 'expenses'
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!type || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'Missing required parameters: type, startDate, endDate' },
                { status: 400 }
            );
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        let transactions: TransactionWithAccount[];

        if (type === 'incomes') {
            transactions = await prisma.income.findMany({
                where: {
                    date: {
                        gte: start.toISOString().split('T')[0],
                        lte: end.toISOString().split('T')[0],
                    },
                },
                include: {
                    account: true,
                },
                orderBy: {
                    date: 'desc',
                },
            }) as IncomeWithAccount[];
        } else if (type === 'expenses') {
            transactions = await prisma.expense.findMany({
                where: {
                    date: {
                        gte: start.toISOString().split('T')[0],
                        lte: end.toISOString().split('T')[0],
                    },
                },
                include: {
                    account: true,
                },
                orderBy: {
                    date: 'desc',
                },
            }) as ExpenseWithAccount[];
        } else {
            return NextResponse.json(
                { error: 'Invalid type. Must be "incomes" or "expenses"' },
                { status: 400 }
            );
        }

        // Transform data for the report
        const reportData = transactions.map((transaction: TransactionWithAccount) => ({
            id: transaction.id,
            amount: transaction.amount,
            description: transaction.description,
            date: transaction.date,
            category: 'source' in transaction ? transaction.source : transaction.category,
            account: transaction.account?.name || 'Unknown Account',
        }));

        return NextResponse.json({
            transactions: reportData,
            total: reportData.reduce((sum, t) => sum + t.amount, 0),
            count: reportData.length,
        });

    } catch (error) {
        console.error('Error fetching report data:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
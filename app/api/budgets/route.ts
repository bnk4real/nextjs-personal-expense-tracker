import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    BUDGET_MONTH_PATTERN,
    dollarsToCents,
    getMonthlyBudgetSummary,
    summarizeBudget,
} from '@/lib/budget';
import { getRequestUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const month = request.nextUrl.searchParams.get('month');

    try {
        if (month) {
            if (!BUDGET_MONTH_PATTERN.test(month)) {
                return NextResponse.json({ error: 'Month must use YYYY-MM format' }, { status: 400 });
            }

            const result = await getMonthlyBudgetSummary(user.user_id, month);
            if (result) {
                return NextResponse.json({ ...result, unbudgeted: null });
            }

            const expenses = await prisma.expense.findMany({
                where: { date: { startsWith: month } },
                select: { amount: true, category: true },
            });
            const spentByCategory = expenses.reduce<Record<string, number>>((totals, expense) => {
                totals[expense.category] = (totals[expense.category] || 0) + dollarsToCents(expense.amount);
                return totals;
            }, {});

            return NextResponse.json({
                budget: null,
                summary: null,
                unbudgeted: {
                    spentCents: expenses.reduce((total, expense) => total + dollarsToCents(expense.amount), 0),
                    transactionCount: expenses.length,
                    categoryBreakdown: Object.entries(spentByCategory)
                        .map(([category, spentCents]) => ({ category, spentCents }))
                        .sort((a, b) => b.spentCents - a.spentCents),
                },
            });
        }

        const budgets = await prisma.monthlyBudget.findMany({
            where: { userId: user.user_id },
            include: { categoryLimits: true },
            orderBy: { month: 'desc' },
            take: 24,
        });

        const history = await Promise.all(budgets.map(async (budget) => {
            const expenses = await prisma.expense.findMany({
                where: { date: { startsWith: budget.month } },
                select: { amount: true, category: true },
            });
            return { budget, summary: summarizeBudget(budget, expenses) };
        }));

        return NextResponse.json({ history });
    } catch (error) {
        console.error('Error fetching budgets:', error);
        return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const month = String(body.month || '');
        const amount = Number(body.amount);
        const warningThreshold = Number(body.warningThreshold ?? 90);
        const categoryLimits = Array.isArray(body.categoryLimits) ? body.categoryLimits : [];

        if (!BUDGET_MONTH_PATTERN.test(month)) {
            return NextResponse.json({ error: 'Month must use YYYY-MM format' }, { status: 400 });
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'Budget amount must be greater than zero' }, { status: 400 });
        }
        if (!Number.isInteger(warningThreshold) || warningThreshold < 50 || warningThreshold > 100) {
            return NextResponse.json({ error: 'Warning threshold must be between 50 and 100' }, { status: 400 });
        }

        const normalizedLimits = categoryLimits
            .map((limit: { category?: unknown; amount?: unknown }) => ({
                category: String(limit.category || '').trim(),
                amount: Number(limit.amount),
            }))
            .filter((limit: { category: string; amount: number }) => (
                limit.category && Number.isFinite(limit.amount) && limit.amount > 0
            ));
        const uniqueCategories = new Set(normalizedLimits.map((limit: { category: string }) => limit.category));
        if (uniqueCategories.size !== normalizedLimits.length) {
            return NextResponse.json({ error: 'Each category can only have one limit' }, { status: 400 });
        }
        const allocatedCents = normalizedLimits.reduce(
            (total: number, limit: { amount: number }) => total + dollarsToCents(limit.amount),
            0
        );
        if (allocatedCents > dollarsToCents(amount)) {
            return NextResponse.json(
                { error: 'Category allocations cannot exceed the monthly budget' },
                { status: 400 }
            );
        }

        await prisma.$transaction(async (tx) => {
            const budget = await tx.monthlyBudget.upsert({
                where: { userId_month: { userId: user.user_id, month } },
                create: {
                    userId: user.user_id,
                    month,
                    amountCents: dollarsToCents(amount),
                    warningThreshold,
                },
                update: {
                    amountCents: dollarsToCents(amount),
                    warningThreshold,
                },
            });

            await tx.budgetCategoryLimit.deleteMany({ where: { budgetId: budget.id } });
            if (normalizedLimits.length > 0) {
                await tx.budgetCategoryLimit.createMany({
                    data: normalizedLimits.map((limit: { category: string; amount: number }) => ({
                        budgetId: budget.id,
                        category: limit.category,
                        amountCents: dollarsToCents(limit.amount),
                    })),
                });
            }
        });

        const result = await getMonthlyBudgetSummary(user.user_id, month);
        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error('Error saving budget:', error);
        return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const month = request.nextUrl.searchParams.get('month') || '';
    if (!BUDGET_MONTH_PATTERN.test(month)) {
        return NextResponse.json({ error: 'Month must use YYYY-MM format' }, { status: 400 });
    }

    try {
        const budget = await prisma.monthlyBudget.findUnique({
            where: { userId_month: { userId: user.user_id, month } },
            select: { id: true },
        });
        if (!budget) {
            return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
        }

        await prisma.monthlyBudget.delete({ where: { id: budget.id } });
        return NextResponse.json({ message: `Budget deleted for ${month}` });
    } catch (error) {
        console.error('Error deleting budget:', error);
        return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
    }
}

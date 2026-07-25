import { prisma } from '@/lib/prisma';

export const BUDGET_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type BudgetWithLimits = {
    id: number;
    month: string;
    amountCents: number;
    warningThreshold: number;
    categoryLimits: Array<{
        id: number;
        category: string;
        amountCents: number;
    }>;
};

type ExpenseAmount = {
    amount: number;
    category: string;
};

export function dollarsToCents(value: number) {
    return Math.round(value * 100);
}

export function centsToDollars(value: number) {
    return value / 100;
}

export function getBudgetMonth(date: string) {
    const month = date.slice(0, 7);
    return BUDGET_MONTH_PATTERN.test(month) ? month : null;
}

export function getPreviousMonth(month: string) {
    if (!BUDGET_MONTH_PATTERN.test(month)) return null;
    const [year, monthNumber] = month.split('-').map(Number);
    const previous = new Date(year, monthNumber - 2, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

function getStatus(percentUsed: number, warningThreshold: number) {
    if (percentUsed >= 100) return 'over' as const;
    if (percentUsed >= warningThreshold) return 'near' as const;
    return 'on-track' as const;
}

export function summarizeBudget(budget: BudgetWithLimits, expenses: ExpenseAmount[]) {
    const spentCents = expenses.reduce((total, expense) => total + dollarsToCents(expense.amount), 0);
    const remainingCents = budget.amountCents - spentCents;
    const percentUsed = budget.amountCents > 0
        ? (spentCents / budget.amountCents) * 100
        : 0;

    const spentByCategory = expenses.reduce<Record<string, number>>((totals, expense) => {
        totals[expense.category] = (totals[expense.category] || 0) + dollarsToCents(expense.amount);
        return totals;
    }, {});

    const limitsByCategory = new Map(
        budget.categoryLimits.map((limit) => [limit.category, limit])
    );
    const categories = new Set([
        ...Object.keys(spentByCategory),
        ...budget.categoryLimits.map((limit) => limit.category),
    ]);

    const categoryBreakdown = Array.from(categories)
        .map((category) => {
            const spent = spentByCategory[category] || 0;
            const limit = limitsByCategory.get(category);
            const categoryPercent = limit && limit.amountCents > 0
                ? (spent / limit.amountCents) * 100
                : null;

            return {
                category,
                spentCents: spent,
                limitCents: limit?.amountCents ?? null,
                remainingCents: limit ? limit.amountCents - spent : null,
                percentUsed: categoryPercent,
                status: categoryPercent === null
                    ? 'unlimited'
                    : getStatus(categoryPercent, budget.warningThreshold),
            };
        })
        .sort((a, b) => b.spentCents - a.spentCents);

    return {
        spentCents,
        remainingCents,
        percentUsed,
        status: getStatus(percentUsed, budget.warningThreshold),
        categoryBreakdown,
    };
}

export async function getMonthlyBudgetSummary(
    userId: string,
    month: string,
    excludeExpenseId?: number
) {
    const budget = await prisma.monthlyBudget.findUnique({
        where: { userId_month: { userId, month } },
        include: { categoryLimits: true },
    });

    if (!budget) return null;

    const expenses = await prisma.expense.findMany({
        where: {
            date: { startsWith: month },
            ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
        },
        select: { amount: true, category: true },
    });

    return {
        budget,
        summary: summarizeBudget(budget, expenses),
    };
}

export async function getBudgetWarning(input: {
    userId: string;
    date: string;
    amount: number;
    category: string;
    excludeExpenseId?: number;
}) {
    const month = getBudgetMonth(input.date);
    if (!month || !Number.isFinite(input.amount) || input.amount <= 0) return null;

    const result = await getMonthlyBudgetSummary(input.userId, month, input.excludeExpenseId);
    if (!result) return null;

    const amountCents = dollarsToCents(input.amount);
    const projectedSpentCents = result.summary.spentCents + amountCents;
    const projectedPercent = result.budget.amountCents > 0
        ? (projectedSpentCents / result.budget.amountCents) * 100
        : 0;
    const overallStatus = getStatus(projectedPercent, result.budget.warningThreshold);
    const categoryLimit = result.budget.categoryLimits.find(
        (limit) => limit.category === input.category
    );
    const categorySpentCents = result.summary.categoryBreakdown.find(
        (category) => category.category === input.category
    )?.spentCents || 0;
    const projectedCategorySpentCents = categorySpentCents + amountCents;
    const categoryPercent = categoryLimit && categoryLimit.amountCents > 0
        ? (projectedCategorySpentCents / categoryLimit.amountCents) * 100
        : null;
    const categoryStatus = categoryPercent === null
        ? null
        : getStatus(categoryPercent, result.budget.warningThreshold);

    if (overallStatus === 'on-track' && (!categoryStatus || categoryStatus === 'on-track')) {
        return null;
    }

    return {
        month,
        level: overallStatus === 'over' || categoryStatus === 'over' ? 'over' : 'near',
        budgetCents: result.budget.amountCents,
        currentSpentCents: result.summary.spentCents,
        projectedSpentCents,
        remainingAfterCents: result.budget.amountCents - projectedSpentCents,
        percentUsed: projectedPercent,
        category: categoryLimit ? {
            name: input.category,
            limitCents: categoryLimit.amountCents,
            projectedSpentCents: projectedCategorySpentCents,
            remainingAfterCents: categoryLimit.amountCents - projectedCategorySpentCents,
            percentUsed: categoryPercent,
            level: categoryStatus,
        } : null,
    };
}

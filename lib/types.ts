export interface Expense {
    id: string;
    amount: number;
    category: string;
    date: string;
    description: string;
    accountId?: number;
    account?: Account;
}

export interface Category {
    id: string;
    name: string;
}

export interface Account {
    id: string;
    name: string;
    type: string;
    balance: number;
    creditLimit?: number | null;
}

export interface Transfer {
    id: string;
    amount: number;
    date: string;
    description: string;
    fromAccountId?: number;
    toAccountId?: number;
    affectsBalance: boolean;
    fromAccount?: Account | null;
    toAccount?: Account | null;
    createdAt: string;
    updatedAt: string;
}

export interface Subscription {
    id: string;
    user_id: string;
    name: string;
    provider?: string;
    price_cents: number;
    currency: string;
    billing_cycle: string;
    company_coverage_percent: number;
    start_date: string;
    next_payment_date?: string;
    status: string;
    website_url?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export type BudgetStatus = 'on-track' | 'near' | 'over';

export interface BudgetCategoryLimit {
    id: number;
    category: string;
    amountCents: number;
}

export interface MonthlyBudget {
    id: number;
    month: string;
    amountCents: number;
    warningThreshold: number;
    categoryLimits: BudgetCategoryLimit[];
}

export interface BudgetCategoryBreakdown {
    category: string;
    spentCents: number;
    limitCents: number | null;
    remainingCents: number | null;
    percentUsed: number | null;
    status: BudgetStatus | 'unlimited';
}

export interface BudgetSummary {
    spentCents: number;
    remainingCents: number;
    percentUsed: number;
    status: BudgetStatus;
    categoryBreakdown: BudgetCategoryBreakdown[];
}

export interface BudgetWarning {
    month: string;
    level: 'near' | 'over';
    budgetCents: number;
    currentSpentCents: number;
    projectedSpentCents: number;
    remainingAfterCents: number;
    percentUsed: number;
    category: {
        name: string;
        limitCents: number;
        projectedSpentCents: number;
        remainingAfterCents: number;
        percentUsed: number;
        level: 'on-track' | 'near' | 'over';
    } | null;
}

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
    creditLimit?: number;
}

export interface Subscription {
    id: string;
    user_id: string;
    name: string;
    provider?: string;
    price_cents: number;
    currency: string;
    billing_cycle: string;
    next_payment_date?: string;
    website_url?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}
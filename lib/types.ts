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
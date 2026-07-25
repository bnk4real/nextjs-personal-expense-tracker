'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Account, Category, Expense, Subscription, Transfer } from '@/lib/types';
import Calendar from '@/lib/Calendar';
import { doesDateStringMatchUTC, formatDateForDisplay, parseUTCDate } from '@/lib/format_date';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AccountBadge,
    AmountText,
    EmptyState,
    MetricTile,
    PageHeader,
    TransactionTypeBadge,
} from '@/components/app/WorkspaceUI';
import { AddTransactionButton } from '@/components/app/TransactionFormDialog';

type IncomeRow = {
    id: number;
    amount: number;
    source: string;
    date: string;
    description: string;
    notes?: string | null;
    accountId?: number | null;
    account?: Account | null;
};

type DashboardTransaction = {
    uid: string;
    type: 'expense' | 'income' | 'transfer';
    date: string;
    description: string;
    amount: number;
    detail: string;
    accountLabel: string;
};

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function currentMonthMatch(date: string) {
    const parsed = parseUTCDate(date);
    const now = new Date();
    return parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
}

function normalizeDashboardTransactions(
    expenses: Expense[],
    incomes: IncomeRow[],
    transfers: Transfer[]
): DashboardTransaction[] {
    const expenseRows = expenses.map((expense) => ({
        uid: `expense-${expense.id}`,
        type: 'expense' as const,
        date: expense.date,
        description: expense.description,
        amount: expense.amount,
        detail: expense.category,
        accountLabel: expense.account?.name || 'No account',
    }));

    const incomeRows = incomes.map((income) => ({
        uid: `income-${income.id}`,
        type: 'income' as const,
        date: income.date,
        description: income.description,
        amount: income.amount,
        detail: income.source,
        accountLabel: income.account?.name || 'No account',
    }));

    const transferRows = transfers.map((transfer) => ({
        uid: `transfer-${transfer.id}`,
        type: 'transfer' as const,
        date: transfer.date,
        description: transfer.description,
        amount: transfer.amount,
        detail: transfer.affectsBalance ? 'Balance adjusted' : 'Historical',
        accountLabel: `${transfer.fromAccount?.name || 'No account'} -> ${transfer.toAccount?.name || 'No account'}`,
    }));

    return [...expenseRows, ...incomeRows, ...transferRows].sort((a, b) => {
        const dateDiff = parseUTCDate(b.date).getTime() - parseUTCDate(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.uid.localeCompare(a.uid);
    });
}

export default function Dashboard() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [incomes, setIncomes] = useState<IncomeRow[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [loading, setLoading] = useState(true);

    const refreshDashboardData = () => {
        Promise.all([
            fetch('/api/expenses').then((response) => response.json()),
            fetch('/api/incomes').then((response) => response.json()),
            fetch('/api/transfers').then((response) => response.json()),
            fetch('/api/accounts').then((response) => response.json()),
            fetch('/api/categories').then((response) => response.json()),
            fetch('/api/subscriptions').then((response) => response.json()),
        ])
            .then(([expenseData, incomeData, transferData, accountData, categoryData, subscriptionData]) => {
                setExpenses(Array.isArray(expenseData) ? expenseData : []);
                setIncomes(Array.isArray(incomeData) ? incomeData : []);
                setTransfers(Array.isArray(transferData) ? transferData : []);
                setAccounts(Array.isArray(accountData) ? accountData : []);
                setCategories(Array.isArray(categoryData) ? categoryData : []);
                setSubscriptions(Array.isArray(subscriptionData) ? subscriptionData : []);
                setLoading(false);
            })
            .catch(() => {
                toast.error('Failed to load dashboard');
                setLoading(false);
            });
    };

    useEffect(() => {
        refreshDashboardData();
    }, []);

    const transactions = useMemo(
        () => normalizeDashboardTransactions(expenses, incomes, transfers),
        [expenses, incomes, transfers]
    );

    const expenseDates = expenses
        .map((expense) => parseUTCDate(expense.date))
        .filter((date) => !Number.isNaN(date.getTime()));
    const subscriptionDates = subscriptions
        .filter((subscription) => subscription.next_payment_date)
        .map((subscription) => parseUTCDate(subscription.next_payment_date!))
        .filter((date) => !Number.isNaN(date.getTime()));

    const currentMonthExpenses = expenses
        .filter((expense) => currentMonthMatch(expense.date))
        .reduce((total, expense) => total + expense.amount, 0);
    const currentMonthIncome = incomes
        .filter((income) => currentMonthMatch(income.date))
        .reduce((total, income) => total + income.amount, 0);
    const netCashflow = currentMonthIncome - currentMonthExpenses;
    const totalAssets = accounts.reduce((sum, account) => sum + account.balance, 0);

    const recentTransactions = transactions.slice(0, 8);
    const selectedDateTransactions = selectedDate
        ? transactions.filter((transaction) => doesDateStringMatchUTC(transaction.date, selectedDate))
        : [];
    const selectedDateSubscriptions = selectedDate
        ? subscriptions.filter((subscription) =>
            subscription.next_payment_date &&
            doesDateStringMatchUTC(subscription.next_payment_date, selectedDate)
        )
        : [];

    const upcomingPayments = subscriptions
        .filter((subscription) => {
            if (!subscription.next_payment_date) return false;
            const paymentDate = parseUTCDate(subscription.next_payment_date);
            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);
            return paymentDate >= today && paymentDate <= thirtyDaysFromNow;
        })
        .sort((a, b) => parseUTCDate(a.next_payment_date!).getTime() - parseUTCDate(b.next_payment_date!).getTime())
        .slice(0, 5);

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
            <PageHeader
                title="Dashboard"
                description="A compact command center for cashflow, quick entry, and recent activity."
                actions={(
                    <>
                        <AddTransactionButton type="expense" accounts={accounts} categories={categories} onSaved={refreshDashboardData} />
                        <AddTransactionButton type="income" accounts={accounts} categories={categories} onSaved={refreshDashboardData} />
                        <AddTransactionButton type="transfer" accounts={accounts} categories={categories} onSaved={refreshDashboardData} />
                    </>
                )}
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label="This Month Spend" value={money(currentMonthExpenses)} tone="expense" />
                <MetricTile label="This Month Income" value={money(currentMonthIncome)} tone="income" />
                <MetricTile label="Net Cashflow" value={money(netCashflow)} tone={netCashflow >= 0 ? 'income' : 'expense'} />
                <MetricTile label="Current Assets" value={money(totalAssets)} tone="neutral" />
            </div>

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
                <Card className="min-w-0 rounded-md">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                        <CardTitle>Recent Transactions</CardTitle>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/transactions" className="gap-2">
                                View All
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {recentTransactions.length === 0 ? (
                            <EmptyState title="No transactions yet" description="Use quick actions to add your first transaction." />
                        ) : (
                            <div className="rounded-md border">
                                <table className="w-full table-fixed text-sm">
                                    <thead className="border-b bg-muted/50 text-left">
                                        <tr>
                                            <th className="w-24 px-3 py-2 font-medium">Date</th>
                                            <th className="w-24 px-3 py-2 font-medium">Type</th>
                                            <th className="px-3 py-2 font-medium">Description</th>
                                            <th className="hidden w-44 px-3 py-2 font-medium lg:table-cell">Account</th>
                                            <th className="w-28 px-3 py-2 text-right font-medium">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentTransactions.map((transaction) => (
                                            <tr key={transaction.uid} className="border-b last:border-b-0 hover:bg-muted/30">
                                                <td className="whitespace-nowrap px-3 py-2">{formatDateForDisplay(transaction.date)}</td>
                                                <td className="px-3 py-2"><TransactionTypeBadge type={transaction.type} /></td>
                                                <td className="min-w-0 px-3 py-2">
                                                    <p className="truncate font-medium">{transaction.description}</p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {transaction.detail}
                                                        <span className="lg:hidden"> · {transaction.accountLabel}</span>
                                                    </p>
                                                </td>
                                                <td className="hidden px-3 py-2 lg:table-cell"><AccountBadge>{transaction.accountLabel}</AccountBadge></td>
                                                <td className="px-3 py-2 text-right"><AmountText amount={transaction.amount} type={transaction.type} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="min-w-0 rounded-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Activity Calendar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Calendar
                            onSelect={(date) => setSelectedDate(date)}
                            modifiers={{ hasExpense: expenseDates, hasSubscription: subscriptionDates }}
                        />
                        <div className="rounded-md border p-3">
                            <p className="text-sm font-medium">
                                {selectedDate ? formatDateForDisplay(selectedDate.toISOString()) : 'Select a date'}
                            </p>
                            {selectedDate ? (
                                <div className="mt-3 space-y-3">
                                    {selectedDateTransactions.length === 0 && selectedDateSubscriptions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No activity on this date.</p>
                                    ) : (
                                        <>
                                            {selectedDateTransactions.map((transaction) => (
                                                <div key={transaction.uid} className="flex items-start justify-between gap-3 text-sm">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <TransactionTypeBadge type={transaction.type} />
                                                            <span className="font-medium">{transaction.description}</span>
                                                        </div>
                                                        <p className="mt-1 text-xs text-muted-foreground">{transaction.accountLabel}</p>
                                                    </div>
                                                    <AmountText amount={transaction.amount} type={transaction.type} />
                                                </div>
                                            ))}
                                            {selectedDateSubscriptions.map((subscription) => (
                                                <div key={subscription.id} className="flex items-start justify-between gap-3 text-sm">
                                                    <div>
                                                        <p className="font-medium">{subscription.name}</p>
                                                        <p className="text-xs text-muted-foreground">{subscription.provider || 'Subscription'}</p>
                                                    </div>
                                                    <span className="font-semibold text-blue-600">{money(subscription.price_cents / 100)}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Expense and subscription dates are marked on the calendar.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-md">
                <CardHeader>
                    <CardTitle>Upcoming Payments</CardTitle>
                </CardHeader>
                <CardContent>
                    {upcomingPayments.length === 0 ? (
                        <EmptyState title="No upcoming payments" description="Nothing due in the next 30 days." />
                    ) : (
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {upcomingPayments.map((subscription) => (
                                <div key={subscription.id} className="flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <p className="font-medium">{subscription.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {subscription.next_payment_date ? formatDateForDisplay(subscription.next_payment_date) : 'No date'}
                                        </p>
                                    </div>
                                    <span className="font-semibold text-red-600">{money(subscription.price_cents / 100)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

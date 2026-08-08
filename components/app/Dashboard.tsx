'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    ArrowRightLeft,
    CalendarDays,
    Clock3,
    ListFilter,
    Repeat,
    TrendingDown,
    TrendingUp,
    WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { Account, Category, Expense, Subscription, Transfer } from '@/lib/types';
import Calendar from '@/lib/Calendar';
import { doesDateStringMatchUTC, formatDateForDisplay, parseUTCDate } from '@/lib/format_date';
import {
    companySubscriptionContributionCents,
    personalSubscriptionCostCents,
} from '@/lib/recurring-payments';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AccountBadge,
    AmountText,
    EmptyState,
    TransactionTypeBadge,
} from '@/components/app/WorkspaceUI';
import { TransactionFormDialog } from '@/components/app/TransactionFormDialog';

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

type CategoryPressure = {
    category: string;
    amount: number;
    count: number;
};

type HomeDetailItem =
    | { kind: 'transaction'; transaction: DashboardTransaction }
    | { kind: 'category'; category: CategoryPressure }
    | { kind: 'account'; account: Account }
    | { kind: 'subscription'; subscription: Subscription };

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function monthLabel(date: Date) {
    return date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });
}

function dateKey(date: string) {
    return parseUTCDate(date).toISOString().slice(0, 10);
}

function currentMonthMatch(date: string, referenceDate: Date) {
    const parsed = parseUTCDate(date);
    return parsed.getMonth() === referenceDate.getMonth() && parsed.getFullYear() === referenceDate.getFullYear();
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

function SummaryStat({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    tone?: 'neutral' | 'expense' | 'income' | 'transfer';
}) {
    const toneClass = {
        neutral: 'text-zinc-950',
        expense: 'text-red-600',
        income: 'text-emerald-600',
        transfer: 'text-sky-600',
    }[tone];

    return (
        <div className="min-w-0 border-l px-4 first:border-l-0 first:pl-0 max-sm:border-l-0 max-sm:border-t max-sm:px-0 max-sm:pt-3 max-sm:first:border-t-0 max-sm:first:pt-0">
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
            <p className={cn('mt-1 truncate text-xl font-semibold tabular-nums', toneClass)}>{value}</p>
        </div>
    );
}

function Panel({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-md border bg-white/85 shadow-xs">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                {icon}
                <h2 className="text-sm font-semibold">{title}</h2>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function detailDialogTitle(item: HomeDetailItem | null) {
    if (!item) return '';
    if (item.kind === 'transaction') return 'Transaction Detail';
    if (item.kind === 'category') return 'Category Detail';
    if (item.kind === 'account') return 'Account Detail';
    return 'Upcoming Payment Detail';
}

function detailDialogDescription(item: HomeDetailItem | null) {
    if (!item) return '';
    if (item.kind === 'transaction') return 'Review this ledger row.';
    if (item.kind === 'category') return 'Review this month category summary.';
    if (item.kind === 'account') return 'Review this account snapshot.';
    return 'Review this scheduled payment.';
}

export default function Dashboard() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [incomes, setIncomes] = useState<IncomeRow[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [selectedItem, setSelectedItem] = useState<HomeDetailItem | null>(null);
    const [loading, setLoading] = useState(true);

    const today = useMemo(() => new Date(), []);

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
                toast.error('Failed to load month workspace');
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

    const monthTransactions = useMemo(
        () => transactions.filter((transaction) => currentMonthMatch(transaction.date, today)),
        [today, transactions]
    );

    const monthExpenseRows = useMemo(
        () => expenses.filter((expense) => currentMonthMatch(expense.date, today)),
        [expenses, today]
    );

    const currentMonthExpenses = monthExpenseRows.reduce((total, expense) => total + expense.amount, 0);
    const currentMonthIncome = incomes
        .filter((income) => currentMonthMatch(income.date, today))
        .reduce((total, income) => total + income.amount, 0);
    const currentMonthTransfers = transfers
        .filter((transfer) => currentMonthMatch(transfer.date, today))
        .reduce((total, transfer) => total + transfer.amount, 0);
    const netCashflow = currentMonthIncome - currentMonthExpenses;
    const totalAssets = accounts.reduce((sum, account) => sum + account.balance, 0);
    const averageDailySpend = currentMonthExpenses / Math.max(today.getDate(), 1);

    const categoryPressure = useMemo(() => {
        const groups = new Map<string, CategoryPressure>();

        monthExpenseRows.forEach((expense) => {
            const existing = groups.get(expense.category) || {
                category: expense.category || 'Other',
                amount: 0,
                count: 0,
            };
            existing.amount += expense.amount;
            existing.count += 1;
            groups.set(existing.category, existing);
        });

        return [...groups.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
    }, [monthExpenseRows]);

    const maxCategoryAmount = Math.max(...categoryPressure.map((category) => category.amount), 1);

    const groupedMonthTransactions = useMemo(() => {
        const groups = new Map<string, DashboardTransaction[]>();

        monthTransactions.forEach((transaction) => {
            const key = dateKey(transaction.date);
            groups.set(key, [...(groups.get(key) || []), transaction]);
        });

        return [...groups.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([key, rows]) => ({
                key,
                label: formatDateForDisplay(key),
                total: rows.reduce((sum, row) => {
                    if (row.type === 'expense') return sum - row.amount;
                    if (row.type === 'income') return sum + row.amount;
                    return sum;
                }, 0),
                rows,
            }));
    }, [monthTransactions]);

    const expenseDates = expenses
        .map((expense) => parseUTCDate(expense.date))
        .filter((date) => !Number.isNaN(date.getTime()));
    const subscriptionDates = subscriptions
        .filter((subscription) => subscription.next_payment_date)
        .map((subscription) => parseUTCDate(subscription.next_payment_date!))
        .filter((date) => !Number.isNaN(date.getTime()));

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
            return subscription.status === 'active' && Boolean(subscription.next_payment_date);
        })
        .sort((a, b) => parseUTCDate(a.next_payment_date!).getTime() - parseUTCDate(b.next_payment_date!).getTime())
        .slice(0, 4);

    const visibleAccounts = accounts
        .slice()
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, 5);

    if (loading) {
        return (
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center p-6">
                <div className="rounded-md border bg-white px-4 py-3 text-sm text-muted-foreground shadow-xs">Loading month workspace...</div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
            <section className="rounded-md border bg-white shadow-xs">
                <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                        <Badge variant="outline" className="mb-3 border-zinc-300 bg-zinc-50 text-zinc-700">
                            Month Workspace
                        </Badge>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h1 className="text-3xl font-semibold tracking-normal text-zinc-950">{monthLabel(today)}</h1>
                                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                                    Review the month as one ledger: expenses, income, transfers, subscriptions, and account movement.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4 xl:w-[720px]">
                        <SummaryStat label="Spend" value={money(currentMonthExpenses)} tone="expense" />
                        <SummaryStat label="Income" value={money(currentMonthIncome)} tone="income" />
                        <SummaryStat label="Net" value={money(netCashflow)} tone={netCashflow >= 0 ? 'income' : 'expense'} />
                        <SummaryStat label="Assets" value={money(totalAssets)} />
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t bg-zinc-50/70 px-5 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <TransactionFormDialog
                            type="expense"
                            accounts={accounts}
                            categories={categories}
                            onSaved={refreshDashboardData}
                            trigger={(
                                <Button size="sm">
                                    <TrendingDown className="h-4 w-4" />
                                    Expense
                                </Button>
                            )}
                        />
                        <TransactionFormDialog
                            type="income"
                            accounts={accounts}
                            categories={categories}
                            onSaved={refreshDashboardData}
                            trigger={(
                                <Button size="sm" variant="outline">
                                    <TrendingUp className="h-4 w-4" />
                                    Income
                                </Button>
                            )}
                        />
                        <TransactionFormDialog
                            type="transfer"
                            accounts={accounts}
                            categories={categories}
                            onSaved={refreshDashboardData}
                            trigger={(
                                <Button size="sm" variant="outline">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    Transfer
                                </Button>
                            )}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        <span>{monthTransactions.length} rows this month · {money(averageDailySpend)} daily spend avg · {money(currentMonthTransfers)} transfers</span>
                    </div>
                </div>
            </section>

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="min-w-0 rounded-md border bg-white shadow-xs">
                    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="flex items-center gap-2 text-base font-semibold">
                                <ListFilter className="h-4 w-4" />
                                Monthly Ledger
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">Grouped by posting date so the month reads like a real statement.</p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/transactions">
                                Open Ledger
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>

                    {groupedMonthTransactions.length === 0 ? (
                        <div className="p-4">
                            <EmptyState title="No rows in this month" description="Add a transaction or import a statement to start the ledger." />
                        </div>
                    ) : (
                        <div className="overflow-hidden">
                            <div className="hidden border-b bg-zinc-50/80 px-4 py-2 text-xs font-medium uppercase tracking-normal text-muted-foreground md:grid md:grid-cols-[140px_96px_minmax(0,1fr)_minmax(140px,180px)_120px] md:gap-3">
                                <span>Date</span>
                                <span>Type</span>
                                <span>Description</span>
                                <span>Account</span>
                                <span className="text-right">Amount</span>
                            </div>
                            {groupedMonthTransactions.map((group) => (
                                <div key={group.key} className="grid gap-0 border-b last:border-b-0 md:grid-cols-[140px_minmax(0,1fr)]">
                                    <div className="border-b bg-zinc-50/70 px-4 py-3 md:border-b-0 md:border-r">
                                        <p className="text-sm font-semibold text-zinc-950">{group.label}</p>
                                        <p className={cn(
                                            'mt-1 text-xs font-semibold tabular-nums',
                                            group.total >= 0 ? 'text-emerald-600' : 'text-red-600'
                                        )}>
                                            {money(group.total)}
                                        </p>
                                    </div>
                                    <div className="min-w-0 divide-y">
                                        {group.rows.map((transaction) => (
                                            <button
                                                key={transaction.uid}
                                                type="button"
                                                onClick={() => setSelectedItem({ kind: 'transaction', transaction })}
                                                className="grid w-full min-w-0 gap-2 px-4 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[96px_minmax(0,1fr)] md:grid-cols-[96px_minmax(0,1fr)_minmax(140px,180px)_120px] md:gap-3 md:items-center"
                                            >
                                                <div className="min-w-0">
                                                    <TransactionTypeBadge type={transaction.type} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">{transaction.description}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{transaction.detail}</p>
                                                </div>
                                                <div className="min-w-0">
                                                    <AccountBadge>{transaction.accountLabel}</AccountBadge>
                                                </div>
                                                <div className="justify-self-start md:justify-self-end md:text-right">
                                                    <AmountText amount={transaction.amount} type={transaction.type} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <aside className="space-y-5">
                    <Panel title="Category Pressure" icon={<TrendingDown className="h-4 w-4 text-red-600" />}>
                        {categoryPressure.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No spending categories in this month yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {categoryPressure.map((category) => (
                                    <button
                                        key={category.category}
                                        type="button"
                                        onClick={() => setSelectedItem({ kind: 'category', category })}
                                        className="w-full space-y-2 rounded-md p-2 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="truncate font-medium">{category.category}</span>
                                            <span className="shrink-0 tabular-nums text-muted-foreground">{money(category.amount)}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-zinc-100">
                                            <div
                                                className="h-2 rounded-full bg-red-500"
                                                style={{ width: `${Math.max((category.amount / maxCategoryAmount) * 100, 4)}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">{category.count} transaction{category.count === 1 ? '' : 's'}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Panel>

                    <Panel title="Accounts Snapshot" icon={<WalletCards className="h-4 w-4 text-emerald-600" />}>
                        {visibleAccounts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {visibleAccounts.map((account) => {
                                    const isCredit = account.type === 'Credit Card';
                                    return (
                                        <button
                                            key={account.id}
                                            type="button"
                                            onClick={() => setSelectedItem({ kind: 'account', account })}
                                            className="flex w-full items-center justify-between gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">{account.name}</p>
                                                <p className="text-xs text-muted-foreground">{account.type}</p>
                                            </div>
                                            <span className={cn(
                                                'shrink-0 font-semibold tabular-nums',
                                                isCredit && account.balance > 0 ? 'text-red-600' : 'text-emerald-600'
                                            )}>
                                                {money(account.balance)}
                                            </span>
                                        </button>
                                    );
                                })}
                                <Button variant="outline" size="sm" className="w-full" asChild>
                                    <Link href="/accounts">
                                        Audit Accounts
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Recurring Payments" icon={<Repeat className="h-4 w-4 text-sky-600" />}>
                        {upcomingPayments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No active recurring payments.</p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingPayments.map((subscription) => (
                                    <button
                                        key={subscription.id}
                                        type="button"
                                        onClick={() => setSelectedItem({ kind: 'subscription', subscription })}
                                        className="flex w-full items-center justify-between gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <p className="truncate font-medium">{subscription.name}</p>
                                                <Badge variant="outline" className="shrink-0 capitalize">
                                                    {subscription.billing_cycle}
                                                </Badge>
                                                {subscription.company_coverage_percent > 0 && (
                                                    <Badge variant="outline" className="shrink-0 border-sky-200 bg-sky-50 text-sky-700">
                                                        Company {subscription.company_coverage_percent}%
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Next payment {subscription.next_payment_date ? formatDateForDisplay(subscription.next_payment_date) : 'not scheduled'}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className={cn(
                                                'font-semibold tabular-nums',
                                                subscription.company_coverage_percent > 0 ? 'text-sky-700' : 'text-red-600'
                                            )}>
                                                {money(personalSubscriptionCostCents(
                                                    subscription.price_cents,
                                                    subscription.company_coverage_percent
                                                ) / 100)}
                                            </p>
                                            {subscription.company_coverage_percent > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    of {money(subscription.price_cents / 100)}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                                <Button variant="outline" size="sm" className="w-full" asChild>
                                    <Link href="/subscriptions">
                                        Open Subscriptions
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Day Inspector" icon={<CalendarDays className="h-4 w-4 text-zinc-700" />}>
                        <div className="space-y-4">
                            <Calendar
                                onSelect={(date) => setSelectedDate(date)}
                                modifiers={{ hasExpense: expenseDates, hasSubscription: subscriptionDates }}
                            />
                            <div className="border-t pt-3">
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
                                                    <button
                                                        key={transaction.uid}
                                                        type="button"
                                                        onClick={() => setSelectedItem({ kind: 'transaction', transaction })}
                                                        className="flex w-full items-start justify-between gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">{transaction.description}</p>
                                                            <p className="text-xs text-muted-foreground">{transaction.accountLabel}</p>
                                                        </div>
                                                        <AmountText amount={transaction.amount} type={transaction.type} />
                                                    </button>
                                                ))}
                                                {selectedDateSubscriptions.map((subscription) => (
                                                    <button
                                                        key={subscription.id}
                                                        type="button"
                                                        onClick={() => setSelectedItem({ kind: 'subscription', subscription })}
                                                        className="flex w-full items-start justify-between gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">{subscription.name}</p>
                                                            <p className="text-xs capitalize text-muted-foreground">Recurring · {subscription.billing_cycle}</p>
                                                        </div>
                                                        <span className={cn(
                                                            'font-semibold',
                                                            subscription.company_coverage_percent > 0 ? 'text-sky-700' : 'text-red-600'
                                                        )}>
                                                            {money(personalSubscriptionCostCents(
                                                                subscription.price_cents,
                                                                subscription.company_coverage_percent
                                                            ) / 100)}
                                                        </span>
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-muted-foreground">Calendar marks expense and subscription dates.</p>
                                )}
                            </div>
                        </div>
                    </Panel>
                </aside>
            </div>

            <Dialog
                open={Boolean(selectedItem)}
                onOpenChange={(open) => {
                    if (!open) setSelectedItem(null);
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{detailDialogTitle(selectedItem)}</DialogTitle>
                        <DialogDescription>
                            {detailDialogDescription(selectedItem)}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedItem?.kind === 'transaction' && (
                        <div className="space-y-5">
                            <div className="rounded-md border bg-zinc-50 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <TransactionTypeBadge type={selectedItem.transaction.type} />
                                        <h3 className="mt-3 break-words text-xl font-semibold text-zinc-950">
                                            {selectedItem.transaction.description}
                                        </h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {formatDateForDisplay(selectedItem.transaction.date)}
                                        </p>
                                    </div>
                                    <div className="shrink-0 sm:text-right">
                                        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Amount</p>
                                        <p className="mt-1 text-2xl font-semibold">
                                            <AmountText amount={selectedItem.transaction.amount} type={selectedItem.transaction.type} />
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                                        {selectedItem.transaction.type === 'income' ? 'Source' : selectedItem.transaction.type === 'expense' ? 'Category' : 'Status'}
                                    </p>
                                    <p className="mt-1 font-medium">{selectedItem.transaction.detail}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Account</p>
                                    <p className="mt-1 break-words font-medium">{selectedItem.transaction.accountLabel}</p>
                                </div>
                            </div>

                        </div>
                    )}
                    {selectedItem?.kind === 'category' && (
                        <div className="space-y-5">
                            <div className="rounded-md border bg-zinc-50 p-4">
                                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Category</p>
                                <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950">{selectedItem.category.category}</h3>
                            </div>
                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Month Spend</p>
                                    <p className="mt-1 text-lg font-semibold tabular-nums text-red-600">{money(selectedItem.category.amount)}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Transactions</p>
                                    <p className="mt-1 text-lg font-semibold tabular-nums">{selectedItem.category.count}</p>
                                </div>
                            </div>
                            <Button variant="outline" asChild>
                                <Link href="/transactions">
                                    Open Ledger
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    )}
                    {selectedItem?.kind === 'account' && (
                        <div className="space-y-5">
                            <div className="rounded-md border bg-zinc-50 p-4">
                                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Account</p>
                                <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950">{selectedItem.account.name}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">{selectedItem.account.type}</p>
                            </div>
                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Balance</p>
                                    <p className={cn(
                                        'mt-1 text-lg font-semibold tabular-nums',
                                        selectedItem.account.type === 'Credit Card' && selectedItem.account.balance > 0 ? 'text-red-600' : 'text-emerald-600'
                                    )}>
                                        {money(selectedItem.account.balance)}
                                    </p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Credit Limit</p>
                                    <p className="mt-1 text-lg font-semibold tabular-nums">
                                        {selectedItem.account.creditLimit ? money(selectedItem.account.creditLimit) : 'Not credit-backed'}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" asChild>
                                <Link href="/accounts">
                                    Open Accounts
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    )}
                    {selectedItem?.kind === 'subscription' && (
                        <div className="space-y-5">
                            <div className="rounded-md border bg-zinc-50 p-4">
                                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Recurring Payment</p>
                                <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950">{selectedItem.subscription.name}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">{selectedItem.subscription.provider || 'Subscription'}</p>
                            </div>
                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Full Charge</p>
                                    <p className="mt-1 text-lg font-semibold tabular-nums">
                                        {money(selectedItem.subscription.price_cents / 100)}
                                    </p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Next Payment</p>
                                    <p className="mt-1 text-lg font-semibold">
                                        {selectedItem.subscription.next_payment_date ? formatDateForDisplay(selectedItem.subscription.next_payment_date) : 'No date'}
                                    </p>
                                </div>
                                {selectedItem.subscription.company_coverage_percent > 0 && (
                                    <>
                                        <div className="rounded-md border border-sky-200 bg-sky-50/50 p-3">
                                            <p className="text-xs font-medium uppercase tracking-normal text-sky-700">Company Covers</p>
                                            <p className="mt-1 text-lg font-semibold tabular-nums text-sky-700">
                                                {money(companySubscriptionContributionCents(
                                                    selectedItem.subscription.price_cents,
                                                    selectedItem.subscription.company_coverage_percent
                                                ) / 100)}
                                            </p>
                                            <p className="mt-1 text-xs text-sky-700">{selectedItem.subscription.company_coverage_percent}% of full charge</p>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">You Pay</p>
                                            <p className="mt-1 text-lg font-semibold tabular-nums text-red-600">
                                                {money(personalSubscriptionCostCents(
                                                    selectedItem.subscription.price_cents,
                                                    selectedItem.subscription.company_coverage_percent
                                                ) / 100)}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">Counted in personal spend</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="rounded-md border p-3 text-sm">
                                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Billing Cycle</p>
                                <p className="mt-1 font-medium">{selectedItem.subscription.billing_cycle}</p>
                            </div>
                            <Button variant="outline" asChild>
                                <Link href="/subscriptions">
                                    Open Subscriptions
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

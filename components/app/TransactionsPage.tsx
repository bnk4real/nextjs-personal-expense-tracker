'use client';

import { useEffect, useMemo, useState } from 'react';
import { Edit, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Account, Category, Expense, Transfer } from '@/lib/types';
import { formatDateForDisplay, parseUTCDate } from '@/lib/format_date';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
    AccountBadge,
    AmountText,
    EmptyState,
    MetricTile,
    PageHeader,
    TransactionTypeBadge,
} from '@/components/app/WorkspaceUI';
import { AddTransactionButton, TransactionFormDialog } from '@/components/app/TransactionFormDialog';

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

type TransactionType = 'expense' | 'income' | 'transfer';

type UnifiedTransaction = {
    uid: string;
    id: string | number;
    type: TransactionType;
    date: string;
    description: string;
    amount: number;
    categoryOrSource: string;
    accountLabel: string;
    searchText: string;
    raw: Expense | IncomeRow | Transfer;
};

const ALL = 'all';

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function normalizeTransactions(expenses: Expense[], incomes: IncomeRow[], transfers: Transfer[]): UnifiedTransaction[] {
    const expenseRows = expenses.map((expense) => {
        const accountLabel = expense.account?.name || 'No account';
        return {
            uid: `expense-${expense.id}`,
            id: expense.id,
            type: 'expense' as const,
            date: expense.date,
            description: expense.description,
            amount: expense.amount,
            categoryOrSource: expense.category,
            accountLabel,
            searchText: `${expense.description} ${expense.category} ${accountLabel}`.toLowerCase(),
            raw: expense,
        };
    });

    const incomeRows = incomes.map((income) => {
        const accountLabel = income.account?.name || 'No account';
        return {
            uid: `income-${income.id}`,
            id: income.id,
            type: 'income' as const,
            date: income.date,
            description: income.description,
            amount: income.amount,
            categoryOrSource: income.source,
            accountLabel,
            searchText: `${income.description} ${income.source} ${accountLabel}`.toLowerCase(),
            raw: income,
        };
    });

    const transferRows = transfers.map((transfer) => {
        const from = transfer.fromAccount?.name || 'No account';
        const to = transfer.toAccount?.name || 'No account';
        return {
            uid: `transfer-${transfer.id}`,
            id: transfer.id,
            type: 'transfer' as const,
            date: transfer.date,
            description: transfer.description,
            amount: transfer.amount,
            categoryOrSource: transfer.affectsBalance ? 'Balance adjusted' : 'Historical',
            accountLabel: `${from} -> ${to}`,
            searchText: `${transfer.description} ${from} ${to}`.toLowerCase(),
            raw: transfer,
        };
    });

    return [...expenseRows, ...incomeRows, ...transferRows].sort((a, b) => {
        const dateDiff = parseUTCDate(b.date).getTime() - parseUTCDate(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.uid.localeCompare(a.uid);
    });
}

export default function TransactionsPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [incomes, setIncomes] = useState<IncomeRow[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState(ALL);
    const [accountFilter, setAccountFilter] = useState(ALL);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [editingTransaction, setEditingTransaction] = useState<UnifiedTransaction | null>(null);

    const refreshData = () => {
        Promise.all([
            fetch('/api/expenses').then((response) => response.json()),
            fetch('/api/incomes').then((response) => response.json()),
            fetch('/api/transfers').then((response) => response.json()),
            fetch('/api/accounts').then((response) => response.json()),
            fetch('/api/categories').then((response) => response.json()),
        ])
            .then(([expenseData, incomeData, transferData, accountData, categoryData]) => {
                setExpenses(Array.isArray(expenseData) ? expenseData : []);
                setIncomes(Array.isArray(incomeData) ? incomeData : []);
                setTransfers(Array.isArray(transferData) ? transferData : []);
                setAccounts(Array.isArray(accountData) ? accountData : []);
                setCategories(Array.isArray(categoryData) ? categoryData : []);
                setLoading(false);
            })
            .catch(() => {
                toast.error('Failed to load transactions');
                setLoading(false);
            });
    };

    useEffect(() => {
        refreshData();
    }, []);

    const transactions = useMemo(
        () => normalizeTransactions(expenses, incomes, transfers),
        [expenses, incomes, transfers]
    );

    const accountOptions = [
        { value: ALL, label: 'All accounts' },
        ...accounts.map((account) => ({
            value: account.name,
            label: `${account.name} (${account.type})`,
            searchText: `${account.name} ${account.type}`,
        })),
    ];

    const typeOptions = [
        { value: ALL, label: 'All types' },
        { value: 'expense', label: 'Expenses' },
        { value: 'income', label: 'Income' },
        { value: 'transfer', label: 'Transfers' },
    ];

    const filteredTransactions = transactions.filter((transaction) => {
        if (typeFilter !== ALL && transaction.type !== typeFilter) return false;
        if (accountFilter !== ALL && !transaction.accountLabel.toLowerCase().includes(accountFilter.toLowerCase())) return false;
        if (query && !transaction.searchText.includes(query.toLowerCase())) return false;

        const transactionTime = parseUTCDate(transaction.date).getTime();
        if (startDate && transactionTime < parseUTCDate(startDate).getTime()) return false;
        if (endDate && transactionTime > parseUTCDate(endDate).getTime()) return false;

        return true;
    });

    const totals = filteredTransactions.reduce(
        (acc, transaction) => {
            if (transaction.type === 'expense') acc.expense += transaction.amount;
            if (transaction.type === 'income') acc.income += transaction.amount;
            if (transaction.type === 'transfer') acc.transfer += transaction.amount;
            return acc;
        },
        { expense: 0, income: 0, transfer: 0 }
    );
    const netCashflow = totals.income - totals.expense;

    const handleDelete = async (transaction: UnifiedTransaction) => {
        const label = transaction.type === 'transfer'
            ? 'Delete this transfer? Balance changes may be reversed depending on its settings.'
            : `Delete this ${transaction.type}?`;
        if (!confirm(label)) return;

        const response = await fetch(`/api/${transaction.type === 'income' ? 'incomes' : `${transaction.type}s`}/${transaction.id}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            toast.success('Transaction deleted');
            refreshData();
        } else {
            const data = await response.json().catch(() => ({}));
            toast.error(data.error || 'Failed to delete transaction');
        }
    };

    const editType = editingTransaction?.type;

    if (loading) {
        return <div className="p-6">Loading...</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <PageHeader
                title="Transactions"
                description="Review expenses, income, and transfers in one place."
                actions={(
                    <>
                        <AddTransactionButton type="expense" accounts={accounts} categories={categories} onSaved={refreshData} />
                        <AddTransactionButton type="income" accounts={accounts} categories={categories} onSaved={refreshData} />
                        <AddTransactionButton type="transfer" accounts={accounts} categories={categories} onSaved={refreshData} />
                    </>
                )}
            />

            <div className="grid gap-3 md:grid-cols-4">
                <MetricTile label="Expenses" value={money(totals.expense)} tone="expense" />
                <MetricTile label="Income" value={money(totals.income)} tone="income" />
                <MetricTile label="Net Cashflow" value={money(netCashflow)} tone={netCashflow >= 0 ? 'income' : 'expense'} />
                <MetricTile label="Transfers" value={money(totals.transfer)} tone="transfer" />
            </div>

            <Card className="rounded-md">
                <CardContent className="space-y-4 p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px_150px_150px]">
                        <div className="space-y-2">
                            <Label htmlFor="transaction-search">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="transaction-search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Merchant, category, account..."
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <SearchableSelect
                                value={typeFilter}
                                onValueChange={setTypeFilter}
                                options={typeOptions}
                                searchPlaceholder="Search types..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Account</Label>
                            <SearchableSelect
                                value={accountFilter}
                                onValueChange={setAccountFilter}
                                options={accountOptions}
                                searchPlaceholder="Search accounts..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="transaction-start">Start</Label>
                            <Input
                                id="transaction-start"
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="transaction-end">End</Label>
                            <Input
                                id="transaction-end"
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                            />
                        </div>
                    </div>

                    {filteredTransactions.length === 0 ? (
                        <EmptyState title="No transactions found" description="Adjust filters or add a transaction." />
                    ) : (
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-250 text-sm">
                                <thead className="border-b bg-muted/50 text-left">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Date</th>
                                        <th className="px-3 py-2 font-medium">Type</th>
                                        <th className="px-3 py-2 font-medium">Description</th>
                                        <th className="px-3 py-2 font-medium">Category / Source</th>
                                        <th className="px-3 py-2 font-medium">Account</th>
                                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                                        <th className="px-3 py-2 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransactions.map((transaction) => (
                                        <tr key={transaction.uid} className="border-b last:border-b-0 hover:bg-muted/30">
                                            <td className="whitespace-nowrap px-3 py-2">{formatDateForDisplay(transaction.date)}</td>
                                            <td className="px-3 py-2"><TransactionTypeBadge type={transaction.type} /></td>
                                            <td className="max-w-80 truncate px-3 py-2 font-medium">{transaction.description}</td>
                                            <td className="px-3 py-2">{transaction.categoryOrSource}</td>
                                            <td className="px-3 py-2"><AccountBadge>{transaction.accountLabel}</AccountBadge></td>
                                            <td className="px-3 py-2 text-right"><AmountText amount={transaction.amount} type={transaction.type} /></td>
                                            <td className="px-3 py-2">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setEditingTransaction(transaction)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-600 hover:text-red-700"
                                                        onClick={() => handleDelete(transaction)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {editingTransaction && editType && (
                <TransactionFormDialog
                    type={editType}
                    accounts={accounts}
                    categories={categories}
                    initialData={editingTransaction.raw}
                    open={Boolean(editingTransaction)}
                    onOpenChange={(nextOpen) => {
                        if (!nextOpen) setEditingTransaction(null);
                    }}
                    onSaved={() => {
                        setEditingTransaction(null);
                        refreshData();
                    }}
                />
            )}
        </div>
    );
}

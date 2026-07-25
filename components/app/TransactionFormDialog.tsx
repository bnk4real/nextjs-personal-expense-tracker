'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Account, BudgetWarning, Category, Transfer } from '@/lib/types';
import { getTodayString, localDateToUTCString } from '@/lib/format_date';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AiTransactionDraftInput } from '@/components/app/AiTransactionDraftInput';

const NO_ACCOUNT = '__none__';

const incomeSources = [
    'Salary',
    'Freelance',
    'Investment',
    'Business',
    'Gift',
    'Other',
];

type TransactionKind = 'expense' | 'income' | 'transfer';

type ExpenseInitial = {
    id?: string | number;
    amount: number;
    category: string;
    date: string;
    description: string;
    accountId?: number | null;
};

type IncomeInitial = {
    id?: string | number;
    amount: number;
    source: string;
    date: string;
    description: string;
    notes?: string | null;
    accountId?: number | null;
};

type TransactionFormDialogProps = {
    type: TransactionKind;
    accounts: Account[];
    categories: Category[];
    initialData?: ExpenseInitial | IncomeInitial | Transfer | null;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSaved: () => void;
};

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function monthName(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });
}

function moneyFromCents(value: number) {
    return money(value / 100);
}

function isTransferAccount(account: Account) {
    return account.type !== 'Credit Card';
}

function getTitle(type: TransactionKind, editing: boolean) {
    const action = editing ? 'Edit' : 'Add';
    const label = type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : 'Transfer';
    return `${action} ${label}`;
}

function defaultForm(type: TransactionKind) {
    if (type === 'transfer') {
        return {
            amount: '',
            date: getTodayString(),
            description: '',
            category: '',
            source: '',
            notes: '',
            accountId: '',
            fromAccountId: NO_ACCOUNT,
            toAccountId: NO_ACCOUNT,
            affectsBalance: true,
        };
    }

    return {
        amount: '',
        date: getTodayString(),
        description: '',
        category: '',
        source: '',
        notes: '',
        accountId: '',
        fromAccountId: NO_ACCOUNT,
        toAccountId: NO_ACCOUNT,
        affectsBalance: true,
    };
}

function formFromInitialData(
    type: TransactionKind,
    initialData?: ExpenseInitial | IncomeInitial | Transfer | null
) {
    if (!initialData) return defaultForm(type);

    if (type === 'expense') {
        const expense = initialData as ExpenseInitial;
        return {
            ...defaultForm(type),
            amount: expense.amount.toString(),
            category: expense.category,
            date: expense.date,
            description: expense.description,
            accountId: expense.accountId ? expense.accountId.toString() : '',
        };
    }

    if (type === 'income') {
        const income = initialData as IncomeInitial;
        return {
            ...defaultForm(type),
            amount: income.amount.toString(),
            source: income.source,
            date: income.date,
            description: income.description,
            notes: income.notes || '',
            accountId: income.accountId ? income.accountId.toString() : '',
        };
    }

    const transfer = initialData as Transfer;
    return {
        ...defaultForm(type),
        amount: transfer.amount.toString(),
        date: transfer.date,
        description: transfer.description,
        fromAccountId: transfer.fromAccountId ? transfer.fromAccountId.toString() : NO_ACCOUNT,
        toAccountId: transfer.toAccountId ? transfer.toAccountId.toString() : NO_ACCOUNT,
        affectsBalance: transfer.affectsBalance,
    };
}

export function TransactionFormDialog({
    type,
    accounts,
    categories,
    initialData,
    trigger,
    open,
    onOpenChange,
    onSaved,
}: TransactionFormDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open ?? internalOpen;
    const setOpen = onOpenChange ?? setInternalOpen;
    const [form, setForm] = useState(() => formFromInitialData(type, initialData));
    const [budgetWarning, setBudgetWarning] = useState<BudgetWarning | null>(null);
    const [checkingBudget, setCheckingBudget] = useState(false);
    const isEditing = Boolean(initialData && 'id' in initialData && initialData.id !== undefined);

    const categoryOptions = useMemo(() => {
        const options = categories.map((category) => ({
            value: category.name,
            label: category.name,
        }));
        if (form.category && !options.some((option) => option.value === form.category)) {
            return [{ value: form.category, label: form.category }, ...options];
        }
        return options;
    }, [categories, form.category]);

    const accountOptions = useMemo(() => accounts.map((account) => ({
        value: account.id.toString(),
        label: `${account.name} (${money(account.balance)})`,
        searchText: `${account.name} ${account.type}`,
    })), [accounts]);

    const transferAccountOptions = useMemo(() => [
        { value: NO_ACCOUNT, label: 'No account' },
        ...accounts.filter(isTransferAccount).map((account) => ({
            value: account.id.toString(),
            label: `${account.name} (${money(account.balance)})`,
            searchText: `${account.name} ${account.type}`,
        })),
    ], [accounts]);

    const sourceOptions = incomeSources.map((source) => ({ value: source, label: source }));

    useEffect(() => {
        if (
            type !== 'expense'
            || !isOpen
            || !form.date
            || !form.category
            || !Number.isFinite(Number(form.amount))
            || Number(form.amount) <= 0
        ) {
            setBudgetWarning(null);
            setCheckingBudget(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setCheckingBudget(true);
            try {
                const response = await fetch('/api/budgets/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: Number(form.amount),
                        category: form.category,
                        date: localDateToUTCString(form.date),
                        expenseId: isEditing ? (initialData as ExpenseInitial).id : undefined,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    setBudgetWarning(null);
                    return;
                }

                const data = await response.json();
                setBudgetWarning(data.warning || null);
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    setBudgetWarning(null);
                }
            } finally {
                if (!controller.signal.aborted) setCheckingBudget(false);
            }
        }, 350);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [
        form.amount,
        form.category,
        form.date,
        initialData,
        isEditing,
        isOpen,
        type,
    ]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setForm(defaultForm(type));
            setBudgetWarning(null);
        }
    };

    const applyExpenseDraft = (draft: {
        amount: number;
        category?: string;
        date: string;
        description: string;
        accountId: number | null;
    }) => {
        setForm((current) => ({
            ...current,
            amount: draft.amount.toString(),
            category: draft.category || '',
            date: draft.date,
            description: draft.description,
            accountId: draft.accountId ? draft.accountId.toString() : '',
        }));
    };

    const applyIncomeDraft = (draft: {
        amount: number;
        source?: string;
        date: string;
        description: string;
        notes?: string;
        accountId: number | null;
    }) => {
        setForm((current) => ({
            ...current,
            amount: draft.amount.toString(),
            source: draft.source || 'Other',
            date: draft.date,
            description: draft.description,
            notes: draft.notes || '',
            accountId: draft.accountId ? draft.accountId.toString() : '',
        }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const endpoint = type === 'expense'
            ? `/api/expenses${isEditing ? `/${(initialData as ExpenseInitial).id}` : ''}`
            : type === 'income'
                ? `/api/incomes${isEditing ? `/${(initialData as IncomeInitial).id}` : ''}`
                : `/api/transfers${isEditing ? `/${(initialData as Transfer).id}` : ''}`;

        const payload = type === 'expense'
            ? {
                amount: parseFloat(form.amount),
                category: form.category,
                date: localDateToUTCString(form.date),
                description: form.description,
                accountId: form.accountId ? parseInt(form.accountId, 10) : null,
            }
            : type === 'income'
                ? {
                    amount: parseFloat(form.amount),
                    source: form.source,
                    date: localDateToUTCString(form.date),
                    description: form.description,
                    notes: form.notes,
                    accountId: form.accountId ? parseInt(form.accountId, 10) : null,
                }
                : {
                    amount: parseFloat(form.amount),
                    date: localDateToUTCString(form.date),
                    description: form.description,
                    fromAccountId: form.fromAccountId === NO_ACCOUNT ? null : parseInt(form.fromAccountId, 10),
                    toAccountId: form.toAccountId === NO_ACCOUNT ? null : parseInt(form.toAccountId, 10),
                    affectsBalance: form.affectsBalance,
                };

        const response = await fetch(endpoint, {
            method: isEditing ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            toast.success(`${isEditing ? 'Updated' : 'Added'} ${type}`);
            handleOpenChange(false);
            onSaved();
        } else {
            const data = await response.json().catch(() => ({}));
            toast.error(data.error || `Failed to save ${type}`);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{getTitle(type, isEditing)}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isEditing && type === 'expense' && (
                        <AiTransactionDraftInput type="expense" onApply={applyExpenseDraft} />
                    )}
                    {!isEditing && type === 'income' && (
                        <AiTransactionDraftInput type="income" onApply={applyIncomeDraft} />
                    )}

                    <div className="space-y-2">
                        <Label htmlFor={`${type}-description`}>Description</Label>
                        <Input
                            id={`${type}-description`}
                            value={form.description}
                            onChange={(event) => setForm({ ...form, description: event.target.value })}
                            placeholder={type === 'transfer' ? 'Move to savings, Zelle...' : 'Description'}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor={`${type}-amount`}>Amount</Label>
                            <Input
                                id={`${type}-amount`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.amount}
                                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${type}-date`}>Date</Label>
                            <Input
                                id={`${type}-date`}
                                type="date"
                                value={form.date}
                                onChange={(event) => setForm({ ...form, date: event.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {type === 'expense' && (
                        <>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <SearchableSelect
                                    value={form.category}
                                    onValueChange={(value) => setForm({ ...form, category: value })}
                                    options={categoryOptions}
                                    placeholder="Select a category"
                                    searchPlaceholder="Search categories..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Account</Label>
                                <SearchableSelect
                                    value={form.accountId}
                                    onValueChange={(value) => setForm({ ...form, accountId: value })}
                                    options={accountOptions}
                                    placeholder="No account selected"
                                    searchPlaceholder="Search accounts..."
                                />
                            </div>
                        </>
                    )}

                    {type === 'income' && (
                        <>
                            <div className="space-y-2">
                                <Label>Source</Label>
                                <SearchableSelect
                                    value={form.source}
                                    onValueChange={(value) => setForm({ ...form, source: value })}
                                    options={sourceOptions}
                                    placeholder="Select a source"
                                    searchPlaceholder="Search sources..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Account</Label>
                                <SearchableSelect
                                    value={form.accountId}
                                    onValueChange={(value) => setForm({ ...form, accountId: value })}
                                    options={accountOptions}
                                    placeholder="No account selected"
                                    searchPlaceholder="Search accounts..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="income-notes">Notes</Label>
                                <Textarea
                                    id="income-notes"
                                    value={form.notes}
                                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                                    rows={3}
                                />
                            </div>
                        </>
                    )}

                    {type === 'transfer' && (
                        <>
                            <div className="space-y-2">
                                <Label>From Account</Label>
                                <SearchableSelect
                                    value={form.fromAccountId}
                                    onValueChange={(value) => setForm({ ...form, fromAccountId: value })}
                                    options={transferAccountOptions}
                                    searchPlaceholder="Search accounts..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>To Account</Label>
                                <SearchableSelect
                                    value={form.toAccountId}
                                    onValueChange={(value) => setForm({ ...form, toAccountId: value })}
                                    options={transferAccountOptions}
                                    searchPlaceholder="Search accounts..."
                                />
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                <div>
                                    <Label htmlFor="transfer-affects-balance">Adjust Balances</Label>
                                    <p className="text-sm text-muted-foreground">Turn off for historical entries already reflected in balances.</p>
                                </div>
                                <Switch
                                    id="transfer-affects-balance"
                                    checked={form.affectsBalance}
                                    onCheckedChange={(checked) => setForm({ ...form, affectsBalance: checked })}
                                />
                            </div>
                        </>
                    )}

                    {type === 'expense' && budgetWarning && (
                        <div className={cn(
                            'flex gap-3 rounded-md border p-3',
                            budgetWarning.level === 'over'
                                ? 'border-red-200 bg-red-50 text-red-900'
                                : 'border-amber-200 bg-amber-50 text-amber-950'
                        )}>
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    {budgetWarning.level === 'over'
                                        ? `This expense will exceed the ${monthName(budgetWarning.month)} budget by ${moneyFromCents(Math.abs(budgetWarning.remainingAfterCents))}.`
                                        : `This expense will bring ${monthName(budgetWarning.month)} spending to ${budgetWarning.percentUsed.toFixed(1)}%.`}
                                </p>
                                <p className={cn(
                                    'mt-1 text-xs leading-5',
                                    budgetWarning.level === 'over' ? 'text-red-700' : 'text-amber-800'
                                )}>
                                    Projected total: {moneyFromCents(budgetWarning.projectedSpentCents)} of {moneyFromCents(budgetWarning.budgetCents)}.
                                    {budgetWarning.remainingAfterCents >= 0
                                        ? ` ${moneyFromCents(budgetWarning.remainingAfterCents)} will remain.`
                                        : ' You can still save this expense.'}
                                </p>
                                {budgetWarning.category && budgetWarning.category.level !== 'on-track' && (
                                    <p className={cn(
                                        'mt-1 text-xs leading-5',
                                        budgetWarning.level === 'over' ? 'text-red-700' : 'text-amber-800'
                                    )}>
                                        {budgetWarning.category.name} will be at {budgetWarning.category.percentUsed.toFixed(1)}% of its category limit.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={checkingBudget}>
                            {type === 'expense' && budgetWarning ? (
                                <>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Continue & Save
                                </>
                            ) : isEditing ? 'Save Changes' : type === 'expense' ? (
                                <>
                                    <TrendingDown className="mr-2 h-4 w-4" />
                                    Add Expense
                                </>
                            ) : type === 'income' ? (
                                <>
                                    <TrendingUp className="mr-2 h-4 w-4" />
                                    Add Income
                                </>
                            ) : (
                                <>
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    Add Transfer
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function AddTransactionButton({
    type,
    accounts,
    categories,
    onSaved,
}: {
    type: TransactionKind;
    accounts: Account[];
    categories: Category[];
    onSaved: () => void;
}) {
    const label = type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : 'Transfer';
    const icon = type === 'expense'
        ? <TrendingDown className="h-4 w-4" />
        : type === 'income'
            ? <TrendingUp className="h-4 w-4" />
            : <ArrowRightLeft className="h-4 w-4" />;

    return (
        <TransactionFormDialog
            type={type}
            accounts={accounts}
            categories={categories}
            onSaved={onSaved}
            trigger={(
                <Button variant={type === 'expense' ? 'default' : 'outline'} className="gap-2">
                    {icon}
                    <Plus className="h-4 w-4" />
                    {label}
                </Button>
            )}
        />
    );
}

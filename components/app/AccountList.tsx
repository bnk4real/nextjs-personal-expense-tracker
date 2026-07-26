'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CreditCard, Landmark, LayoutGrid, List, Pencil, Plus, Trash2, WalletCards } from 'lucide-react';
import { Account } from '@/lib/types';
import { AccountBadge, EmptyState, MetricTile, PageHeader } from '@/components/app/WorkspaceUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AddTransactionButton } from '@/components/app/TransactionFormDialog';

const ACCOUNT_TYPES = [
    'Cash',
    'Bank Account',
    'Credit Card',
    'Investment',
    'Savings',
    'Other',
];

const accountTypeOptions = ACCOUNT_TYPES.map((type) => ({ value: type, label: type }));

type AccountWithDates = Account & {
    createdAt?: string;
    updatedAt?: string;
};

const blankForm = {
    name: '',
    type: 'Bank Account',
    balance: '',
    creditLimit: '',
};

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(value?: string) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function accountTone(account: AccountWithDates) {
    if (account.type === 'Credit Card') return 'border-red-200 bg-red-50 text-red-700';
    if (account.type === 'Bank Account' || account.type === 'Savings' || account.type === 'Cash') {
        return 'border-green-200 bg-green-50 text-green-700';
    }
    return 'border-blue-200 bg-blue-50 text-blue-700';
}

function normalizeName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function AccountForm({
    formData,
    setFormData,
    onSubmit,
    onCancel,
    submitLabel,
}: {
    formData: typeof blankForm;
    setFormData: (value: typeof blankForm) => void;
    onSubmit: (event: React.FormEvent) => void;
    onCancel: () => void;
    submitLabel: string;
}) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="account-name">Account name</Label>
                <Input
                    id="account-name"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    placeholder="Main checking, Sapphire, Cash"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label>Account type</Label>
                <SearchableSelect
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                    options={accountTypeOptions}
                    placeholder="Select account type"
                    searchPlaceholder="Search account types..."
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="account-balance">Balance</Label>
                    <Input
                        id="account-balance"
                        type="number"
                        step="0.01"
                        value={formData.balance}
                        onChange={(event) => setFormData({ ...formData, balance: event.target.value })}
                        placeholder="0.00"
                    />
                </div>

                {formData.type === 'Credit Card' && (
                    <div className="space-y-2">
                        <Label htmlFor="account-credit-limit">Credit limit</Label>
                        <Input
                            id="account-credit-limit"
                            type="number"
                            step="0.01"
                            value={formData.creditLimit}
                            onChange={(event) => setFormData({ ...formData, creditLimit: event.target.value })}
                            placeholder="5000.00"
                        />
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit">{submitLabel}</Button>
            </div>
        </form>
    );
}

export default function AccountList() {
    const [accounts, setAccounts] = useState<AccountWithDates[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<AccountWithDates | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ACCOUNT_TYPES));
    const [formData, setFormData] = useState(blankForm);

    const fetchAccounts = () => {
        fetch('/api/accounts')
            .then((res) => res.json())
            .then((data) => {
                setAccounts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setAccounts([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const filteredAccounts = useMemo(
        () => accounts.filter((account) => selectedTypes.has(account.type)),
        [accounts, selectedTypes]
    );

    const duplicateGroups = useMemo(() => {
        const groups = new Map<string, AccountWithDates[]>();
        accounts.forEach((account) => {
            const key = `${normalizeName(account.name)}::${account.type}`;
            groups.set(key, [...(groups.get(key) || []), account]);
        });
        return [...groups.values()].filter((group) => group.length > 1);
    }, [accounts]);

    const totals = useMemo(() => {
        const assets = accounts
            .filter((account) => account.type !== 'Credit Card')
            .reduce((sum, account) => sum + account.balance, 0);
        const creditDebt = accounts
            .filter((account) => account.type === 'Credit Card')
            .reduce((sum, account) => sum + account.balance, 0);
        const creditLimit = accounts
            .filter((account) => account.type === 'Credit Card')
            .reduce((sum, account) => sum + (account.creditLimit || 0), 0);

        return {
            assets,
            creditDebt,
            creditLimit,
            netWorth: assets - creditDebt,
        };
    }, [accounts]);

    const resetForm = () => {
        setFormData(blankForm);
        setEditingAccount(null);
    };

    const handleTypeFilterChange = (type: string, checked: boolean) => {
        setSelectedTypes((current) => {
            const next = new Set(current);
            if (checked) {
                next.add(type);
            } else {
                next.delete(type);
            }
            return next;
        });
    };

    const handleEdit = (account: AccountWithDates) => {
        setEditingAccount(account);
        setFormData({
            name: account.name,
            type: account.type,
            balance: account.balance.toString(),
            creditLimit: account.creditLimit?.toString() || '',
        });
        setEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this account? Existing transactions will keep their historical data.')) return;

        const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
        if (response.ok) {
            toast.success('Account deleted');
            fetchAccounts();
        } else {
            toast.error('Failed to delete account');
        }
    };

    const handleAddSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const response = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...formData,
                balance: parseFloat(formData.balance) || 0,
                creditLimit: formData.type === 'Credit Card' ? parseFloat(formData.creditLimit) || 0 : undefined,
            }),
        });

        if (response.ok) {
            toast.success('Account added');
            setAddModalOpen(false);
            resetForm();
            fetchAccounts();
        } else {
            toast.error('Failed to add account');
        }
    };

    const handleEditSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editingAccount) return;

        const response = await fetch(`/api/accounts/${editingAccount.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...formData,
                balance: parseFloat(formData.balance) || 0,
                creditLimit: formData.type === 'Credit Card' ? parseFloat(formData.creditLimit) || 0 : undefined,
            }),
        });

        if (response.ok) {
            toast.success('Account updated');
            setEditModalOpen(false);
            resetForm();
            fetchAccounts();
        } else {
            toast.error('Failed to update account');
        }
    };

    if (loading) {
        return (
            <div className="mx-auto flex min-h-80 max-w-7xl items-center justify-center p-6">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
            <PageHeader
                title="Accounts"
                description="Audit balances, credit cards, and duplicate accounts before transactions get messy."
                actions={(
                    <>
                        {accounts.some((account) => account.type === 'Credit Card') && (
                            <AddTransactionButton
                                type="payment"
                                accounts={accounts}
                                categories={[]}
                                onSaved={fetchAccounts}
                            />
                        )}
                        <Dialog open={addModalOpen} onOpenChange={(open) => {
                            setAddModalOpen(open);
                            if (!open) resetForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4" />
                                    Add Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Add Account</DialogTitle>
                                </DialogHeader>
                                <AccountForm
                                    formData={formData}
                                    setFormData={setFormData}
                                    onSubmit={handleAddSubmit}
                                    onCancel={() => setAddModalOpen(false)}
                                    submitLabel="Add Account"
                                />
                            </DialogContent>
                        </Dialog>
                    </>
                )}
            />

            {duplicateGroups.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-2 text-sm">
                            <p className="font-medium">{duplicateGroups.length} possible duplicate account group{duplicateGroups.length === 1 ? '' : 's'}</p>
                            <div className="flex flex-wrap gap-2">
                                {duplicateGroups.map((group) => (
                                    <Badge key={`${group[0].name}-${group[0].type}`} variant="secondary">
                                        {group[0].name} x{group.length}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <MetricTile label="Current Assets" value={money(totals.assets)} tone="income" />
                <MetricTile label="Credit Card Debt" value={money(totals.creditDebt)} tone="expense" />
                <MetricTile label="Net Worth" value={money(totals.netWorth)} tone={totals.netWorth >= 0 ? 'income' : 'expense'} />
                <MetricTile label="Credit Limit" value={money(totals.creditLimit)} />
            </div>

            <Card className="rounded-md">
                <CardContent className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="font-medium">Account type filters</p>
                            <p className="text-sm text-muted-foreground">Showing {filteredAccounts.length} of {accounts.length} accounts</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {ACCOUNT_TYPES.map((type) => (
                                <label key={type} className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm">
                                    <Checkbox
                                        checked={selectedTypes.has(type)}
                                        onCheckedChange={(checked) => handleTypeFilterChange(type, checked === true)}
                                    />
                                    {type}
                                </label>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {filteredAccounts.length === 0 ? (
                <EmptyState
                    title={accounts.length === 0 ? 'No accounts yet' : 'No accounts match the selected filters'}
                    description={accounts.length === 0 ? 'Add your bank accounts and credit cards to start tracking balances.' : 'Adjust account type filters to see more accounts.'}
                />
            ) : (
                <section className="min-w-0 space-y-4">
                    <div className="rounded-md border bg-background p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-semibold">
                                    <WalletCards className="h-5 w-5" />
                                    Account Ledger
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">Card view is default. Switch to list when you want a tighter audit pass.</p>
                            </div>
                            <div className="flex w-fit rounded-md border bg-background p-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                                    className="h-8 gap-2"
                                    onClick={() => setViewMode('card')}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                    Cards
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    className="h-8 gap-2"
                                    onClick={() => setViewMode('list')}
                                >
                                    <List className="h-4 w-4" />
                                    List
                                </Button>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'card' ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {filteredAccounts.map((account) => {
                                const utilization = account.creditLimit
                                    ? Math.min((account.balance / account.creditLimit) * 100, 100)
                                    : 0;
                                const isCreditCard = account.type === 'Credit Card';

                                return (
                                    <Card key={account.id} className="rounded-md transition-shadow hover:shadow-md">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <CardTitle className="break-words text-lg">{account.name}</CardTitle>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className={accountTone(account)}>{account.type}</Badge>
                                                        <span className="text-xs text-muted-foreground">Updated {formatDate(account.updatedAt)}</span>
                                                    </div>
                                                </div>
                                                {isCreditCard ? (
                                                    <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <Landmark className="h-5 w-5 shrink-0 text-muted-foreground" />
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Current Balance</p>
                                                    <p className={cn(
                                                        'mt-1 text-2xl font-semibold tabular-nums',
                                                        isCreditCard
                                                            ? account.balance > 0 ? 'text-red-600' : 'text-green-600'
                                                            : account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                                                    )}>
                                                        {money(account.balance)}
                                                    </p>
                                                </div>

                                                {isCreditCard && account.creditLimit ? (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between gap-3 text-sm">
                                                            <span className="text-muted-foreground">Available Credit</span>
                                                            <span className="font-semibold tabular-nums">{money(account.creditLimit - account.balance)}</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Progress value={utilization} />
                                                            <p className="text-xs text-muted-foreground">{utilization.toFixed(1)}% used of {money(account.creditLimit)}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <AccountBadge>Not credit-backed</AccountBadge>
                                                )}

                                                <div className="flex gap-2 pt-1">
                                                    <Button variant="outline" size="sm" onClick={() => handleEdit(account)} className="flex-1">
                                                        <Pencil className="h-4 w-4" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDelete(account.id)}
                                                        className="flex-1 text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAccounts.map((account) => {
                                const utilization = account.creditLimit
                                    ? Math.min((account.balance / account.creditLimit) * 100, 100)
                                    : 0;
                                const isCreditCard = account.type === 'Credit Card';

                                return (
                                    <div key={account.id} className="rounded-md border bg-background p-4">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        {isCreditCard ? (
                                                            <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        ) : (
                                                            <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        )}
                                                        <p className="break-words font-semibold">{account.name}</p>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className={accountTone(account)}>{account.type}</Badge>
                                                        <span className="text-xs text-muted-foreground">Updated {formatDate(account.updatedAt)}</span>
                                                    </div>
                                                </div>

                                                <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:w-[520px]">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Balance</p>
                                                        <p className={cn(
                                                            'mt-1 text-xl font-semibold tabular-nums',
                                                            isCreditCard
                                                                ? account.balance > 0 ? 'text-red-600' : 'text-green-600'
                                                                : account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                                                        )}>
                                                            {money(account.balance)}
                                                        </p>
                                                    </div>

                                                    {isCreditCard && account.creditLimit ? (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between gap-3 text-sm">
                                                                <span className="text-muted-foreground">Available</span>
                                                                <span className="font-medium tabular-nums">{money(account.creditLimit - account.balance)}</span>
                                                            </div>
                                                            <Progress value={utilization} />
                                                            <p className="text-xs text-muted-foreground">{utilization.toFixed(1)}% used of {money(account.creditLimit)}</p>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Credit</p>
                                                            <p className="mt-1 text-sm">Not credit-backed</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex shrink-0 justify-end gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(account)} aria-label={`Edit ${account.name}`}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(account.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                        aria-label={`Delete ${account.name}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            <Dialog open={editModalOpen} onOpenChange={(open) => {
                setEditModalOpen(open);
                if (!open) resetForm();
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Account</DialogTitle>
                    </DialogHeader>
                    <AccountForm
                        formData={formData}
                        setFormData={setFormData}
                        onSubmit={handleEditSubmit}
                        onCancel={() => setEditModalOpen(false)}
                        submitLabel="Update Account"
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

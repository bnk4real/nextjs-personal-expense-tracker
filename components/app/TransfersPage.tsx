'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Account, Transfer } from '@/lib/types';
import { formatDateForDisplay, getTodayString, localDateToUTCString } from '@/lib/format_date';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { EmptyState, MetricTile, PageHeader } from '@/components/app/WorkspaceUI';

const NO_ACCOUNT = '__none__';

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function isTransferAccount(account: Account) {
    return account.type !== 'Credit Card';
}

export default function TransfersPage() {
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
    const [formData, setFormData] = useState({
        amount: '',
        date: getTodayString(),
        description: '',
        fromAccountId: NO_ACCOUNT,
        toAccountId: NO_ACCOUNT,
        affectsBalance: true,
    });
    const editingAccountIds = new Set(
        [editingTransfer?.fromAccountId, editingTransfer?.toAccountId]
            .filter((id): id is number => id !== null && id !== undefined)
    );
    const transferAccounts = accounts.filter(
        (account) => isTransferAccount(account) || editingAccountIds.has(Number(account.id))
    );
    const transferTotal = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    const balanceAffectingTransfers = transfers.filter((transfer) => transfer.affectsBalance).length;
    const historicalTransfers = transfers.length - balanceAffectingTransfers;
    const transferAccountOptions = [
        { value: NO_ACCOUNT, label: 'No account' },
        ...transferAccounts.map((account) => ({
            value: account.id.toString(),
            label: `${account.name} (${money(account.balance)})`,
            searchText: `${account.name} ${account.type}`,
        })),
    ];

    const refreshData = () => {
        Promise.all([
            fetch('/api/transfers').then((response) => response.json()),
            fetch('/api/accounts').then((response) => response.json()),
        ])
            .then(([transferData, accountData]) => {
                setTransfers(Array.isArray(transferData) ? transferData : []);
                setAccounts(Array.isArray(accountData) ? accountData : []);
                setLoading(false);
            })
            .catch(() => {
                setTransfers([]);
                setAccounts([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        refreshData();
    }, []);

    const resetForm = () => {
        setFormData({
            amount: '',
            date: getTodayString(),
            description: '',
            fromAccountId: NO_ACCOUNT,
            toAccountId: NO_ACCOUNT,
            affectsBalance: true,
        });
        setEditingTransfer(null);
    };

    const openAddDialog = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEditDialog = (transfer: Transfer) => {
        setEditingTransfer(transfer);
        setFormData({
            amount: transfer.amount.toString(),
            date: transfer.date,
            description: transfer.description,
            fromAccountId: transfer.fromAccountId ? transfer.fromAccountId.toString() : NO_ACCOUNT,
            toAccountId: transfer.toAccountId ? transfer.toAccountId.toString() : NO_ACCOUNT,
            affectsBalance: transfer.affectsBalance,
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const response = await fetch(editingTransfer ? `/api/transfers/${editingTransfer.id}` : '/api/transfers', {
            method: editingTransfer ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: parseFloat(formData.amount),
                date: localDateToUTCString(formData.date),
                description: formData.description,
                fromAccountId: formData.fromAccountId === NO_ACCOUNT ? null : parseInt(formData.fromAccountId, 10),
                toAccountId: formData.toAccountId === NO_ACCOUNT ? null : parseInt(formData.toAccountId, 10),
                affectsBalance: formData.affectsBalance,
            }),
        });

        if (response.ok) {
            toast.success(editingTransfer ? 'Transfer updated' : 'Transfer added');
            setDialogOpen(false);
            resetForm();
            refreshData();
        } else {
            const data = await response.json().catch(() => ({}));
            toast.error(data.error || 'Failed to add transfer');
        }
    };

    const handleDelete = async (transfer: Transfer) => {
        const message = transfer.affectsBalance
            ? 'Delete this transfer and reverse its balance changes?'
            : 'Delete this historical transfer? Account balances will not change.';
        if (!confirm(message)) return;

        const response = await fetch(`/api/transfers/${transfer.id}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            toast.success('Transfer deleted');
            refreshData();
        } else {
            toast.error('Failed to delete transfer');
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
                title="Transfers"
                description="Move money between accounts without counting it as income or expense."
                actions={(
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2" onClick={openAddDialog}>
                            <ArrowRightLeft className="h-4 w-4" />
                            Add Transfer
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editingTransfer ? 'Edit Transfer' : 'Add Transfer'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="transfer-description">Description</Label>
                                <Input
                                    id="transfer-description"
                                    value={formData.description}
                                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                                    placeholder="Zelle between accounts, move to savings..."
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="transfer-amount">Amount</Label>
                                    <Input
                                        id="transfer-amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="transfer-date">Date</Label>
                                    <Input
                                        id="transfer-date"
                                        type="date"
                                        value={formData.date}
                                        onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>From Account</Label>
                                <SearchableSelect
                                    value={formData.fromAccountId}
                                    onValueChange={(value) => setFormData({ ...formData, fromAccountId: value })}
                                    options={transferAccountOptions}
                                    searchPlaceholder="Search accounts..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>To Account</Label>
                                <SearchableSelect
                                    value={formData.toAccountId}
                                    onValueChange={(value) => setFormData({ ...formData, toAccountId: value })}
                                    options={transferAccountOptions}
                                    searchPlaceholder="Search accounts..."
                                />
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                <div>
                                    <Label htmlFor="transfer-affects-balance">Adjust Balances</Label>
                                    <p className="text-sm text-muted-foreground">Historical converted transfers should usually stay off.</p>
                                </div>
                                <Switch
                                    id="transfer-affects-balance"
                                    checked={formData.affectsBalance}
                                    onCheckedChange={(checked) => setFormData({ ...formData, affectsBalance: checked })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">{editingTransfer ? 'Update Transfer' : 'Add Transfer'}</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
                )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
                <MetricTile label="Transfers" value={transfers.length.toString()} tone="transfer" />
                <MetricTile label="Total Movement" value={money(transferTotal)} tone="transfer" />
                <MetricTile label="Historical" value={historicalTransfers.toString()} />
            </div>

            <Card className="min-w-0 rounded-md">
                <CardHeader>
                    <CardTitle>Recent Transfers</CardTitle>
                    <CardDescription>Transfers do not affect income or expense reports.</CardDescription>
                </CardHeader>
                <CardContent>
                    {transfers.length > 0 ? (
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-[860px] table-fixed text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="border-b">
                                        <th className="w-32 px-3 py-3 text-left font-medium">Date</th>
                                        <th className="px-3 py-3 text-left font-medium">Description</th>
                                        <th className="w-44 px-3 py-3 text-left font-medium">From</th>
                                        <th className="w-44 px-3 py-3 text-left font-medium">To</th>
                                        <th className="w-32 px-3 py-3 text-right font-medium">Amount</th>
                                        <th className="w-32 px-3 py-3 text-left font-medium">Balance</th>
                                        <th className="w-24 px-3 py-3 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transfers.map((transfer) => (
                                        <tr key={transfer.id} className="border-b last:border-0">
                                            <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums">{formatDateForDisplay(transfer.date)}</td>
                                            <td className="px-3 py-3 align-top">
                                                <p className="break-words font-medium">{transfer.description}</p>
                                            </td>
                                            <td className="px-3 py-3 align-top text-muted-foreground">{transfer.fromAccount?.name || '-'}</td>
                                            <td className="px-3 py-3 align-top text-muted-foreground">{transfer.toAccount?.name || '-'}</td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right align-top font-semibold tabular-nums text-blue-600">{money(transfer.amount)}</td>
                                            <td className="px-3 py-3 align-top">
                                                <Badge variant={transfer.affectsBalance ? 'default' : 'outline'}>
                                                    {transfer.toAccount?.type === 'Credit Card'
                                                        ? 'Card payment'
                                                        : transfer.affectsBalance
                                                            ? 'Adjusts'
                                                            : 'Historical'}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3 text-right align-top">
                                                <div className="flex justify-end gap-1">
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(transfer)} aria-label={`Edit ${transfer.description}`}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(transfer)} className="text-red-600 hover:text-red-700" aria-label={`Delete ${transfer.description}`}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            title="No transfers yet"
                            description="Add transfers for account movement that should stay out of income and expense totals."
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

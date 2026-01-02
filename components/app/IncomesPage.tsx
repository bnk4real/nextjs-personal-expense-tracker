'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateForDisplay, getTodayString } from '@/lib/format_date';
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { toast } from "sonner";

interface Income {
    id: number;
    amount: number;
    source: string;
    date: string;
    description: string;
    notes?: string;
    accountId?: number;
    account?: {
        id: number;
        name: string;
        type: string;
    };
    createdAt: string;
    updatedAt: string;
}

interface Account {
    id: number;
    name: string;
    type: string;
    balance: number;
}

const incomeSources = [
    'Salary',
    'Freelance',
    'Investment',
    'Business',
    'Gift',
    'Other'
];

export default function IncomesPage() {
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingIncome, setEditingIncome] = useState<Income | null>(null);
    const [formData, setFormData] = useState({
        amount: '',
        source: '',
        date: getTodayString(),
        description: '',
        notes: '',
        accountId: ''
    });

    const fetchIncomes = () => {
        fetch('/api/incomes')
            .then((res) => res.json())
            .then((data) => {
                setIncomes(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setIncomes([]);
                setLoading(false);
            });
    };

    const fetchAccounts = () => {
        fetch('/api/accounts')
            .then((res) => res.json())
            .then((data) => setAccounts(data))
            .catch(() => {});
    };

    useEffect(() => {
        fetchIncomes();
        fetchAccounts();
    }, []);

    const handleEdit = (income: Income) => {
        setEditingIncome(income);
        setFormData({
            amount: income.amount.toString(),
            source: income.source,
            date: income.date,
            description: income.description,
            notes: income.notes || '',
            accountId: income.accountId ? income.accountId.toString() : ''
        });
        setEditModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this income?')) {
            const response = await fetch(`/api/incomes/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                toast.success("Income deleted successfully!");
                fetchIncomes(); // Refresh list
                fetchAccounts(); // Refresh account balances
            } else {
                toast.error("Failed to delete income");
            }
        }
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const response = await fetch('/api/incomes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                amount: parseFloat(formData.amount),
                accountId: formData.accountId ? parseInt(formData.accountId) : null
            }),
        });
        if (response.ok) {
            toast.success("Income added successfully!");
            setAddModalOpen(false);
            setFormData({
                amount: '',
                source: '',
                date: getTodayString(),
                description: '',
                notes: '',
                accountId: ''
            });
            fetchIncomes(); // Refresh list
            fetchAccounts(); // Refresh account balances
        } else {
            toast.error("Failed to add income");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingIncome) return;

        const response = await fetch(`/api/incomes/${editingIncome.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                amount: parseFloat(formData.amount),
                accountId: formData.accountId ? parseInt(formData.accountId) : null
            }),
        });
        if (response.ok) {
            toast.success("Income updated successfully!");
            setEditModalOpen(false);
            setEditingIncome(null);
            setFormData({
                amount: '',
                source: '',
                date: getTodayString(),
                description: '',
                notes: '',
                accountId: ''
            });
            fetchIncomes(); // Refresh list
            fetchAccounts(); // Refresh account balances
        } else {
            toast.error("Failed to update income");
        }
    };

    const handleModalClose = () => {
        setAddModalOpen(false);
        setEditModalOpen(false);
        setEditingIncome(null);
        setFormData({
            amount: '',
            source: '',
            date: getTodayString(),
            description: '',
            notes: '',
            accountId: ''
        });
    };

    const totalIncome = Array.isArray(incomes) ? incomes.reduce((sum, income) => sum + income.amount, 0) : 0;

    if (loading) {
        return (
            <div className="p-6 max-w-6xl mx-auto">
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Incomes</h1>
                    <p className="text-muted-foreground mt-2">
                        Track your income sources and manage your earnings
                    </p>
                </div>
                <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Income
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add New Income</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount ($)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="source">Source</Label>
                                <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select income source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {incomeSources.map((source) => (
                                            <SelectItem key={source} value={source}>
                                                {source}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Income description"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Additional notes about this income"
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="account">Account (Optional)</Label>
                                <Select value={formData.accountId} onValueChange={(value) => setFormData({ ...formData, accountId: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account to deposit to" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.name} ({account.type}) - ${account.balance.toFixed(2)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex justify-end space-x-2 pt-4">
                                <Button type="button" variant="outline" onClick={handleModalClose}>
                                    Cancel
                                </Button>
                                <Button type="submit">Add Income</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Summary Card */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span>Income Summary</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                        ${totalIncome.toFixed(2)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Total income from {incomes.length} entries
                    </p>
                </CardContent>
            </Card>

            {/* Income List */}
            <div className="grid gap-4">
                {incomes.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <DollarSign className="w-12 h-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No incomes yet</h3>
                            <p className="text-gray-500 text-center mb-4">
                                Start tracking your income by adding your first entry.
                            </p>
                            <Button onClick={() => setAddModalOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Your First Income
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    incomes.map((income) => (
                        <Card key={income.id}>
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h3 className="text-lg font-semibold">{income.description}</h3>
                                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                                {income.source}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p>Date: {formatDateForDisplay(income.date)}</p>
                                            {income.account && (
                                                <p>Account: {income.account.name} ({income.account.type})</p>
                                            )}
                                            {income.notes && (
                                                <p>Notes: {income.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-green-600 mb-2">
                                            +${income.amount.toFixed(2)}
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEdit(income)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDelete(income.id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Income</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-amount">Amount ($)</Label>
                            <Input
                                id="edit-amount"
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-source">Source</Label>
                            <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select income source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {incomeSources.map((source) => (
                                        <SelectItem key={source} value={source}>
                                            {source}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-date">Date</Label>
                            <Input
                                id="edit-date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Input
                                id="edit-description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Income description"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-notes">Notes (Optional)</Label>
                            <Textarea
                                id="edit-notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Additional notes about this income"
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-account">Account (Optional)</Label>
                            <Select value={formData.accountId} onValueChange={(value) => setFormData({ ...formData, accountId: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select account to deposit to" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id.toString()}>
                                            {account.name} ({account.type}) - ${account.balance.toFixed(2)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={handleModalClose}>
                                Cancel
                            </Button>
                            <Button type="submit">Update Income</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
'use client';

import { useEffect, useState } from 'react';
import { Account } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from "sonner";

const ACCOUNT_TYPES = [
    'Cash',
    'Bank Account',
    'Credit Card',
    'Investment',
    'Savings',
    'Other'
];

export default function AccountList() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ACCOUNT_TYPES));
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        balance: '',
        creditLimit: ''
    });

    const fetchAccounts = () => {
        fetch('/api/accounts')
            .then((res) => res.json())
            .then((data) => {
                setAccounts(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleTypeFilterChange = (type: string, checked: boolean) => {
        const newSelectedTypes = new Set(selectedTypes);
        if (checked) {
            newSelectedTypes.add(type);
        } else {
            newSelectedTypes.delete(type);
        }
        setSelectedTypes(newSelectedTypes);
    };

    const handleSelectAll = () => {
        setSelectedTypes(new Set(ACCOUNT_TYPES));
    };

    const handleSelectNone = () => {
        setSelectedTypes(new Set());
    };

    const filteredAccounts = accounts.filter(account =>
        selectedTypes.has(account.type)
    );

    const handleEdit = (account: Account) => {
        setEditingAccount(account);
        setFormData({
            name: account.name,
            type: account.type,
            balance: account.balance.toString(),
            creditLimit: account.creditLimit?.toString() || ''
        });
        setEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this account? This will not affect any expenses linked to it.')) {
            const response = await fetch(`/api/accounts/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                toast.success("Account deleted successfully!");
                fetchAccounts(); // Refresh list
            } else {
                toast.error("Failed to delete account");
            }
        }
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const response = await fetch('/api/accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                balance: parseFloat(formData.balance) || 0,
                creditLimit: formData.type === 'Credit Card' ? parseFloat(formData.creditLimit) || 0 : undefined
            }),
        });
        if (response.ok) {
            toast.success("Account added successfully!");
            setAddModalOpen(false);
            setFormData({ name: '', type: '', balance: '', creditLimit: '' });
            fetchAccounts(); // Refresh list
        } else {
            toast.error("Failed to add account");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount) return;

        const response = await fetch(`/api/accounts/${editingAccount.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                balance: parseFloat(formData.balance) || 0,
                creditLimit: formData.type === 'Credit Card' ? parseFloat(formData.creditLimit) || 0 : undefined
            }),
        });
        if (response.ok) {
            toast.success("Account updated successfully!");
            setEditModalOpen(false);
            setEditingAccount(null);
            setFormData({ name: '', type: '', balance: '', creditLimit: '' });
            fetchAccounts();
        } else {
            toast.error("Failed to update account");
        }
    };

    const handleModalClose = () => {
        setAddModalOpen(false);
        setEditModalOpen(false);
        setEditingAccount(null);
        setFormData({ name: '', type: '', balance: '', creditLimit: '' });
    };

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
                    <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your financial accounts and track balances
                    </p>
                </div>
                <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Add Account</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-106.25">
                        <DialogHeader>
                            <DialogTitle>Add New Account</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="account-name">Account Name</Label>
                                <Input
                                    id="account-name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Main Checking, Savings Account"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="account-type">Account Type</Label>
                                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACCOUNT_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="account-balance">Initial Balance</Label>
                                <Input
                                    id="account-balance"
                                    type="number"
                                    step="0.01"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            {formData.type === 'Credit Card' && (
                                <div className="space-y-2">
                                    <Label htmlFor="account-credit-limit">Credit Limit</Label>
                                    <Input
                                        id="account-credit-limit"
                                        type="number"
                                        step="0.01"
                                        value={formData.creditLimit}
                                        onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                                        placeholder="5000.00"
                                        required
                                    />
                                </div>
                            )}
                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={handleModalClose}>
                                    Cancel
                                </Button>
                                <Button type="submit">Add Account</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                    <DialogContent className="sm:max-w-106.25">
                        <DialogHeader>
                            <DialogTitle>Edit Account</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-account-name">Account Name</Label>
                                <Input
                                    id="edit-account-name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Main Checking, Savings Account"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-account-type">Account Type</Label>
                                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACCOUNT_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-account-balance">Balance</Label>
                                <Input
                                    id="edit-account-balance"
                                    type="number"
                                    step="0.01"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            {formData.type === 'Credit Card' && (
                                <div className="space-y-2">
                                    <Label htmlFor="edit-account-credit-limit">Credit Limit</Label>
                                    <Input
                                        id="edit-account-credit-limit"
                                        type="number"
                                        step="0.01"
                                        value={formData.creditLimit}
                                        onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                                        placeholder="5000.00"
                                        required
                                    />
                                </div>
                            )}
                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={handleModalClose}>
                                    Cancel
                                </Button>
                                <Button type="submit">Update Account</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Account Type Filter */}
            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Filter Account Type</h3>
                            <div className="flex space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectAll}
                                    className="text-xs"
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectNone}
                                    className="text-xs"
                                >
                                    Select None
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {ACCOUNT_TYPES.map((type) => (
                                <div key={type} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`filter-${type}`}
                                        checked={selectedTypes.has(type)}
                                        onCheckedChange={(checked) =>
                                            handleTypeFilterChange(type, checked as boolean)
                                        }
                                    />
                                    <Label
                                        htmlFor={`filter-${type}`}
                                        className="text-sm font-medium cursor-pointer"
                                    >
                                        {type}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Showing {filteredAccounts.length} of {accounts.length} accounts
                        </div>
                    </div>
                </CardContent>
            </Card>

            {filteredAccounts.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                            {accounts.length === 0 ? 'No accounts yet' : 'No accounts match your filters'}
                        </h3>
                        <p className="text-muted-foreground text-center mb-4">
                            {accounts.length === 0
                                ? 'Get started by adding your first financial account.'
                                : 'Try adjusting your account type filters to see more accounts.'
                            }
                        </p>
                        {accounts.length === 0 && (
                            <Button onClick={() => setAddModalOpen(true)}>Add Account</Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAccounts.map((account: Account) => (
                        <Card key={account.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">{account.name}</CardTitle>
                                    <Badge variant="secondary" className="text-xs">
                                        {account.type}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {account.type === 'Credit Card' ? (
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Current Balance</p>
                                                <p className={`text-xl font-bold ${account.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            {account.creditLimit && (
                                                <>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Available Credit</p>
                                                        <p className="text-lg font-semibold text-green-600">
                                                            ${(account.creditLimit - account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Credit Utilization</p>
                                                        <div className="flex items-center space-x-2">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className={`h-2 rounded-full ${account.balance / account.creditLimit > 0.7 ? 'bg-red-500' : account.balance / account.creditLimit > 0.3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                                    style={{ width: `${Math.min((account.balance / account.creditLimit) * 100, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-sm font-medium">
                                                                {((account.balance / account.creditLimit) * 100).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Current Balance</p>
                                            <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEdit(account)}
                                            className="flex-1"
                                        >
                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(account.id)}
                                            className="flex-1 text-destructive hover:text-destructive"
                                        >
                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
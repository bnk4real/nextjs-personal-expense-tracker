'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { formatDateForDisplay } from '@/lib/format_date';
import { Plus, Edit, Trash2, CreditCard, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";

interface Debt {
    id: number;
    type: string;
    lender: string;
    accountNumber?: string;
    totalAmount: number;
    currentBalance: number;
    interestRate?: number;
    minimumPayment?: number;
    dueDate?: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

const debtTypes = [
    'Credit Card',
    'Car Loan',
    'Student Loan',
    'Personal Loan',
    'Mortgage',
    'Home Equity Loan',
    'Business Loan',
    'Medical Debt',
    'Other'
];

export default function DebtTracker() {
    const [debts, setDebts] = useState<Debt[]>([]);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        type: '',
        lender: '',
        accountNumber: '',
        totalAmount: '',
        currentBalance: '',
        interestRate: '',
        minimumPayment: '',
        dueDate: '',
        description: '',
        isActive: true
    });

    useEffect(() => {
        fetchDebts();
    }, []);

    const fetchDebts = async () => {
        try {
            const response = await fetch('/api/debts');
            if (response.ok) {
                const data = await response.json();
                setDebts(data);
            }
        } catch (error) {
            console.error('Error fetching debts:', error);
            toast.error('Failed to load debts');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const url = editingDebt ? '/api/debts' : '/api/debts';
            const method = editingDebt ? 'PUT' : 'POST';

            const data = {
                ...formData,
                id: editingDebt?.id,
                totalAmount: parseFloat(formData.totalAmount),
                currentBalance: parseFloat(formData.currentBalance),
                interestRate: formData.interestRate ? parseFloat(formData.interestRate) : null,
                minimumPayment: formData.minimumPayment ? parseFloat(formData.minimumPayment) : null,
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                toast.success(editingDebt ? 'Debt updated successfully' : 'Debt added successfully');
                fetchDebts();
                resetForm();
                setAddModalOpen(false);
                setEditModalOpen(false);
                setEditingDebt(null);
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to save debt');
            }
        } catch (error) {
            console.error('Error saving debt:', error);
            toast.error('Failed to save debt');
        }
    };

    const handleEdit = (debt: Debt) => {
        setEditingDebt(debt);
        setFormData({
            type: debt.type,
            lender: debt.lender,
            accountNumber: debt.accountNumber || '',
            totalAmount: debt.totalAmount.toString(),
            currentBalance: debt.currentBalance.toString(),
            interestRate: debt.interestRate?.toString() || '',
            minimumPayment: debt.minimumPayment?.toString() || '',
            dueDate: debt.dueDate || '',
            description: debt.description || '',
            isActive: debt.isActive
        });
        setEditModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this debt?')) return;

        try {
            const response = await fetch(`/api/debts?id=${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Debt deleted successfully');
                fetchDebts();
            } else {
                toast.error('Failed to delete debt');
            }
        } catch (error) {
            console.error('Error deleting debt:', error);
            toast.error('Failed to delete debt');
        }
    };

    const resetForm = () => {
        setFormData({
            type: '',
            lender: '',
            accountNumber: '',
            totalAmount: '',
            currentBalance: '',
            interestRate: '',
            minimumPayment: '',
            dueDate: '',
            description: '',
            isActive: true
        });
    };

    const getDebtTypeIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'credit card':
                return <CreditCard className="w-4 h-4" />;
            case 'car loan':
                return <TrendingUp className="w-4 h-4" />;
            default:
                return <DollarSign className="w-4 h-4" />;
        }
    };

    const totalDebt = debts.reduce((sum, debt) => sum + debt.currentBalance, 0);
    const activeDebts = debts.filter(debt => debt.isActive);
    const totalActiveDebt = activeDebts.reduce((sum, debt) => sum + debt.currentBalance, 0);

    if (loading) {
        return <div className="p-6">Loading debts...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header with Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center">
                            <DollarSign className="w-8 h-8 text-red-500 mr-3" />
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Debt</p>
                                <p className="text-2xl font-bold text-red-600">
                                    ${totalDebt.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center">
                            <AlertTriangle className="w-8 h-8 text-orange-500 mr-3" />
                            <div>
                                <p className="text-sm font-medium text-gray-600">Active Debts</p>
                                <p className="text-2xl font-bold text-orange-600">
                                    ${totalActiveDebt.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center">
                            <CreditCard className="w-8 h-8 text-blue-500 mr-3" />
                            <div>
                                <p className="text-sm font-medium text-gray-600">Debt Accounts</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {activeDebts.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Add Debt Button */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Personal Debt Tracker</h1>
                <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Debt
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add New Debt</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Debt Type</Label>
                                    <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select debt type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {debtTypes.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="lender">Lender/Bank</Label>
                                    <Input
                                        id="lender"
                                        value={formData.lender}
                                        onChange={(e) => setFormData({...formData, lender: e.target.value})}
                                        placeholder="Chase, Bank of America, etc."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="totalAmount">Total Amount</Label>
                                    <Input
                                        id="totalAmount"
                                        type="number"
                                        step="0.01"
                                        value={formData.totalAmount}
                                        onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                                        placeholder="10000.00"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="currentBalance">Current Balance</Label>
                                    <Input
                                        id="currentBalance"
                                        type="number"
                                        step="0.01"
                                        value={formData.currentBalance}
                                        onChange={(e) => setFormData({...formData, currentBalance: e.target.value})}
                                        placeholder="8500.00"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="interestRate">Interest Rate (%)</Label>
                                    <Input
                                        id="interestRate"
                                        type="number"
                                        step="0.01"
                                        value={formData.interestRate}
                                        onChange={(e) => setFormData({...formData, interestRate: e.target.value})}
                                        placeholder="15.99"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="minimumPayment">Min. Payment</Label>
                                    <Input
                                        id="minimumPayment"
                                        type="number"
                                        step="0.01"
                                        value={formData.minimumPayment}
                                        onChange={(e) => setFormData({...formData, minimumPayment: e.target.value})}
                                        placeholder="150.00"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="dueDate">Due Date</Label>
                                    <Input
                                        id="dueDate"
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="accountNumber">Account Number (Last 4)</Label>
                                <Input
                                    id="accountNumber"
                                    value={formData.accountNumber}
                                    onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                                    placeholder="****1234"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description/Notes</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Additional notes about this debt..."
                                    rows={3}
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="isActive"
                                    checked={formData.isActive}
                                    onCheckedChange={(checked: boolean) => setFormData({...formData, isActive: checked})}
                                />
                                <Label htmlFor="isActive">Active Debt</Label>
                            </div>

                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Add Debt</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Debt List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {debts.map((debt) => (
                    <Card key={debt.id} className={`relative ${!debt.isActive ? 'opacity-60' : ''}`}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    {getDebtTypeIcon(debt.type)}
                                    <CardTitle className="ml-2 text-lg">{debt.type}</CardTitle>
                                </div>
                                <div className="flex space-x-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(debt)}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(debt.id)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-600">Lender</p>
                                <p className="font-medium">{debt.lender}</p>
                                {debt.accountNumber && (
                                    <p className="text-sm text-gray-500">****{debt.accountNumber}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Current Balance</p>
                                    <p className="text-xl font-bold text-red-600">
                                        ${debt.currentBalance.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Total Amount</p>
                                    <p className="text-lg font-semibold">
                                        ${debt.totalAmount.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {debt.interestRate && (
                                <div>
                                    <p className="text-sm text-gray-600">Interest Rate</p>
                                    <p className="font-medium">{debt.interestRate}% APR</p>
                                </div>
                            )}

                            {debt.minimumPayment && (
                                <div>
                                    <p className="text-sm text-gray-600">Min. Payment</p>
                                    <p className="font-medium">${debt.minimumPayment.toLocaleString()}</p>
                                </div>
                            )}

                            {debt.dueDate && (
                                <div>
                                    <p className="text-sm text-gray-600">Due Date</p>
                                    <p className="font-medium">{formatDateForDisplay(debt.dueDate)}</p>
                                </div>
                            )}

                            {debt.description && (
                                <div>
                                    <p className="text-sm text-gray-600">Notes</p>
                                    <p className="text-sm">{debt.description}</p>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                <Badge variant={debt.isActive ? "default" : "secondary"}>
                                    {debt.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                    Added {formatDateForDisplay(debt.createdAt)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {debts.length === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No debts recorded</h3>
                        <p className="text-gray-600 mb-4">Start tracking your debts to get a clear picture of your financial obligations.</p>
                        <Button onClick={() => setAddModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Your First Debt
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Debt</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-type">Debt Type</Label>
                                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select debt type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {debtTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-lender">Lender/Bank</Label>
                                <Input
                                    id="edit-lender"
                                    value={formData.lender}
                                    onChange={(e) => setFormData({...formData, lender: e.target.value})}
                                    placeholder="Chase, Bank of America, etc."
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-totalAmount">Total Amount</Label>
                                <Input
                                    id="edit-totalAmount"
                                    type="number"
                                    step="0.01"
                                    value={formData.totalAmount}
                                    onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                                    placeholder="10000.00"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-currentBalance">Current Balance</Label>
                                <Input
                                    id="edit-currentBalance"
                                    type="number"
                                    step="0.01"
                                    value={formData.currentBalance}
                                    onChange={(e) => setFormData({...formData, currentBalance: e.target.value})}
                                    placeholder="8500.00"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-interestRate">Interest Rate (%)</Label>
                                <Input
                                    id="edit-interestRate"
                                    type="number"
                                    step="0.01"
                                    value={formData.interestRate}
                                    onChange={(e) => setFormData({...formData, interestRate: e.target.value})}
                                    placeholder="15.99"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-minimumPayment">Min. Payment</Label>
                                <Input
                                    id="edit-minimumPayment"
                                    type="number"
                                    step="0.01"
                                    value={formData.minimumPayment}
                                    onChange={(e) => setFormData({...formData, minimumPayment: e.target.value})}
                                    placeholder="150.00"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-dueDate">Due Date</Label>
                                <Input
                                    id="edit-dueDate"
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-accountNumber">Account Number (Last 4)</Label>
                            <Input
                                id="edit-accountNumber"
                                value={formData.accountNumber}
                                onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                                placeholder="****1234"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description/Notes</Label>
                            <Textarea
                                id="edit-description"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="Additional notes about this debt..."
                                rows={3}
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="edit-isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked: boolean) => setFormData({...formData, isActive: checked})}
                            />
                            <Label htmlFor="edit-isActive">Active Debt</Label>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Update Debt</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
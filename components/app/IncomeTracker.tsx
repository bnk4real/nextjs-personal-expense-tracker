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
import { Plus, Edit, Trash2, DollarSign, Calculator, MapPin, Info } from 'lucide-react';
import { toast } from "sonner";

interface Income {
    id: number;
    amount: number;
    source: string;
    date: string;
    description: string;
    notes?: string;
    accountId?: number;
    state?: string;
    filingStatus?: string;
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

interface TaxCalculation {
    source: string;
    federalTax: number;
    stateTax: number;
    totalTax: number;
    effectiveRate: number;
    takeHome: number;
    breakdown: {
        federal: {
            brackets: Array<{
                rate: number;
                taxableAmount: number;
                tax: number;
            }>;
        };
        state: {
            rate: number;
            tax: number;
        };
    };
}

const incomeSources = [
    'Salary',
    'Freelance',
    'Investment',
    'Business',
    'Gift',
    'Other'
];

const usStates = [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' }
];

const filingStatuses = [
    { value: 'single', label: 'Single' },
    { value: 'married_filing_jointly', label: 'Married Filing Jointly' },
    { value: 'married_filing_separately', label: 'Married Filing Separately' },
    { value: 'head_of_household', label: 'Head of Household' }
];

export default function IncomeTracker() {
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingIncome, setEditingIncome] = useState<Income | null>(null);
    const [taxModalOpen, setTaxModalOpen] = useState(false);
    const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
    const [taxCalculation, setTaxCalculation] = useState<TaxCalculation | null>(null);
    const [loading, setLoading] = useState(true);
    const [calculatingTax, setCalculatingTax] = useState(false);

    const [formData, setFormData] = useState({
        amount: '',
        source: '',
        date: getTodayString(),
        description: '',
        notes: '',
        accountId: '',
        state: '',
        filingStatus: 'single'
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
            .then((data) => {
                setAccounts(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                setAccounts([]);
            });
    };

    useEffect(() => {
        fetchIncomes();
        fetchAccounts();
    }, []);

    const calculateTax = async (income: Income) => {
        if (!income.state || !income.filingStatus) {
            toast.error("State and filing status are required for tax calculation");
            return;
        }

        setCalculatingTax(true);
        try {
            const response = await fetch('/api/tax/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    income: income.amount,
                    state: income.state,
                    filingStatus: income.filingStatus,
                    year: 2024 // Using 2024 tax rates
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setTaxCalculation(data);
                setSelectedIncome(income);
                setTaxModalOpen(true);
            } else {
                toast.error("Failed to calculate taxes");
            }
        } catch (error) {
            console.error('Tax calculation error:', error);
            toast.error("Failed to calculate taxes");
        } finally {
            setCalculatingTax(false);
        }
    };

    const handleEdit = (income: Income) => {
        setEditingIncome(income);
        setFormData({
            amount: income.amount.toString(),
            source: income.source,
            date: income.date,
            description: income.description,
            notes: income.notes || '',
            accountId: income.accountId?.toString() || '',
            state: income.state || '',
            filingStatus: income.filingStatus || 'single'
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
                fetchIncomes();
                fetchAccounts();
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
                accountId: '',
                state: '',
                filingStatus: 'single'
            });
            fetchIncomes();
            fetchAccounts();
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
                accountId: '',
                state: '',
                filingStatus: 'single'
            });
            fetchIncomes();
            fetchAccounts();
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
            accountId: '',
            state: '',
            filingStatus: 'single'
        });
    };

    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg">Loading incomes...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Income Tracker</h1>
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
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="1000.00"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="source">Source</Label>
                                <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select source" />
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
                                <Label htmlFor="state">State (for tax calculations)</Label>
                                <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select state" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {usStates.map((state) => (
                                            <SelectItem key={state.code} value={state.code}>
                                                {state.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="filingStatus">Filing Status</Label>
                                <Select value={formData.filingStatus} onValueChange={(value) => setFormData({ ...formData, filingStatus: value })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filingStatuses.map((status) => (
                                            <SelectItem key={status.value} value={status.value}>
                                                {status.label}
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
                                    placeholder="Monthly salary, etc."
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="account">Account (Optional)</Label>
                                <Select value={formData.accountId} onValueChange={(value) => setFormData({ ...formData, accountId: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.name} ({account.type})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Additional notes"
                                    rows={3}
                                />
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalIncome.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            All time income
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Income Entries</CardTitle>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{incomes.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Total entries
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Income</CardTitle>
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${incomes.length > 0 ? (totalIncome / incomes.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Per entry
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Income List */}
            <Card>
                <CardHeader>
                    <CardTitle>Income History</CardTitle>
                </CardHeader>
                <CardContent>
                    {incomes.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No income entries yet. Add your first income above.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {incomes.map((income) => (
                                <div key={income.id} className="flex justify-between items-center p-4 border rounded-lg">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h3 className="text-lg font-semibold">${income.amount.toLocaleString()}</h3>
                                            <span className="text-sm text-gray-600">{income.source}</span>
                                            {income.state && (
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center">
                                                    <MapPin className="w-3 h-3 mr-1" />
                                                    {income.state}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p>{income.description}</p>
                                            <p>Date: {formatDateForDisplay(income.date)}</p>
                                            {income.account && (
                                                <p>Account: {income.account.name}</p>
                                            )}
                                            {income.notes && (
                                                <p>Notes: {income.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        {income.state && income.filingStatus && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => calculateTax(income)}
                                                disabled={calculatingTax}
                                            >
                                                <Calculator className="w-4 h-4 mr-1" />
                                                {calculatingTax ? 'Calculating...' : 'Calculate Tax'}
                                            </Button>
                                        )}
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
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tax Calculation Modal */}
            <Dialog open={taxModalOpen} onOpenChange={setTaxModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Tax Calculation</DialogTitle>
                    </DialogHeader>
                    {taxCalculation && selectedIncome && (
                        <div className="space-y-6">
                            {taxCalculation.source === 'local_calculation' && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="flex items-center">
                                        <Info className="w-4 h-4 mr-2 text-yellow-600" />
                                        <span className="text-sm text-yellow-800">
                                            Using local tax calculation (API unavailable). Results are estimates based on 2024 tax brackets.
                                        </span>
                                    </div>
                                </div>
                            )}                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <h3 className="font-semibold text-lg">Income Details</h3>
                                    <p>Amount: ${selectedIncome.amount.toLocaleString()}</p>
                                    <p>State: {selectedIncome.state}</p>
                                    <p>Filing Status: {selectedIncome.filingStatus}</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <h3 className="font-semibold text-lg">Take Home Pay</h3>
                                    <p className="text-2xl font-bold text-green-600">
                                        ${taxCalculation.takeHome.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Effective Rate: {(taxCalculation.effectiveRate * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg">
                                    <h3 className="font-semibold">Federal Tax</h3>
                                    <p className="text-xl font-bold text-red-600">
                                        ${taxCalculation.federalTax.toLocaleString()}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        {taxCalculation.breakdown.federal.brackets.map((bracket, index) => (
                                            <div key={index} className="text-sm">
                                                {bracket.rate * 100}% on ${bracket.taxableAmount.toLocaleString()}: ${bracket.tax.toLocaleString()}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg">
                                    <h3 className="font-semibold">State Tax</h3>
                                    <p className="text-xl font-bold text-red-600">
                                        ${taxCalculation.stateTax.toLocaleString()}
                                    </p>
                                    <p className="text-sm">
                                        Rate: {(taxCalculation.breakdown.state.rate * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg">
                                <h3 className="font-semibold">Total Tax</h3>
                                <p className="text-2xl font-bold text-blue-600">
                                    ${taxCalculation.totalTax.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Income</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        {/* Same form fields as add modal */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-amount">Amount</Label>
                            <Input
                                id="edit-amount"
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="1000.00"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-source">Source</Label>
                            <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select source" />
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
                            <Label htmlFor="edit-state">State (for tax calculations)</Label>
                            <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                    {usStates.map((state) => (
                                        <SelectItem key={state.code} value={state.code}>
                                            {state.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-filingStatus">Filing Status</Label>
                            <Select value={formData.filingStatus} onValueChange={(value) => setFormData({ ...formData, filingStatus: value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {filingStatuses.map((status) => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
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
                                placeholder="Monthly salary, etc."
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-account">Account (Optional)</Label>
                            <Select value={formData.accountId} onValueChange={(value) => setFormData({ ...formData, accountId: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id.toString()}>
                                            {account.name} ({account.type})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-notes">Notes (Optional)</Label>
                            <Textarea
                                id="edit-notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Additional notes"
                                rows={3}
                            />
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
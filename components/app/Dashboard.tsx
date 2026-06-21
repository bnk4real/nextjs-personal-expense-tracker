'use client';

import { useEffect, useState } from 'react';
import { Expense, Account, Category, Subscription } from '@/lib/types';
import Calendar from '@/lib/Calendar';
import { doesDateStringMatchUTC, parseUTCDate, formatDateForDisplay, getTodayString, localDateToUTCString } from '@/lib/format_date';
import { DollarSign, Wallet, Tag, CreditCard, Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const incomeSources = [
    'Salary',
    'Freelance',
    'Investment',
    'Business',
    'Gift',
    'Other',
];

export default function Dashboard() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
    const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: '',
        date: getTodayString(),
        description: '',
        accountId: '',
    });
    const [incomeForm, setIncomeForm] = useState({
        amount: '',
        source: '',
        date: getTodayString(),
        description: '',
        accountId: '',
    });

    const requestDashboardData = () => {
        return Promise.all([
            fetch('/api/expenses').then(res => res.json()),
            fetch('/api/accounts').then(res => res.json()),
            fetch('/api/categories').then(res => res.json()),
            fetch('/api/subscriptions').then(res => res.json())
        ]);
    };

    const applyDashboardData = ([expensesData, accountsData, categoriesData, subscriptionsData]: unknown[]) => {
        setExpenses(Array.isArray(expensesData) ? expensesData : []);
        setAccounts(Array.isArray(accountsData) ? accountsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setSubscriptions(Array.isArray(subscriptionsData) ? subscriptionsData : []);
        setLoading(false);
    };

    const refreshDashboardData = () => {
        requestDashboardData()
            .then(applyDashboardData)
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        requestDashboardData()
            .then(applyDashboardData)
            .catch(() => setLoading(false));
    }, []);

    const getMonthValue = (date: Date) => (date.getMonth() + 1).toString().padStart(2, '0');

    const resetExpenseForm = () => {
        setExpenseForm({
            amount: '',
            category: '',
            date: getTodayString(),
            description: '',
            accountId: '',
        });
    };

    const resetIncomeForm = () => {
        setIncomeForm({
            amount: '',
            source: '',
            date: getTodayString(),
            description: '',
            accountId: '',
        });
    };

    const handleExpenseSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...expenseForm,
                amount: parseFloat(expenseForm.amount),
                date: localDateToUTCString(expenseForm.date),
                accountId: expenseForm.accountId ? parseInt(expenseForm.accountId) : null,
            }),
        });

        if (response.ok) {
            toast.success('Expense added');
            setExpenseDialogOpen(false);
            resetExpenseForm();
            refreshDashboardData();
        } else {
            const data = await response.json().catch(() => ({}));
            toast.error(data.error || 'Failed to add expense');
        }
    };

    const handleIncomeSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const response = await fetch('/api/incomes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...incomeForm,
                amount: parseFloat(incomeForm.amount),
                date: localDateToUTCString(incomeForm.date),
                accountId: incomeForm.accountId ? parseInt(incomeForm.accountId) : null,
            }),
        });

        if (response.ok) {
            toast.success('Income added');
            setIncomeDialogOpen(false);
            resetIncomeForm();
            refreshDashboardData();
        } else {
            const data = await response.json().catch(() => ({}));
            toast.error(data.error || 'Failed to add income');
        }
    };

    const currentMonthExpenses = (() => {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        return expenses
            .filter(expense => {
                const expenseDate = parseUTCDate(expense.date);
                return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
            })
            .reduce((total, expense) => total + expense.amount, 0);
    })();
    const totalAssets = accounts.reduce((sum, account) => sum + account.balance, 0);
    const totalCategories = categories.length;
    const totalAccounts = accounts.length;

    // Get upcoming subscription payments (next 30 days)
    const upcomingPayments = subscriptions
        .filter(sub => {
            if (!sub.next_payment_date) return false;
            const paymentDate = new Date(sub.next_payment_date);
            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);
            return paymentDate >= today && paymentDate <= thirtyDaysFromNow;
        })
        .sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime())
        .slice(0, 5); // Show next 5 upcoming payments

    const filteredExpenses = (() => {
        let filtered = expenses;

        // Filter by month if not 'all'
        if (selectedMonth !== 'all') {
            filtered = filtered.filter(expense => {
                const expenseDate = parseUTCDate(expense.date);
                const month = getMonthValue(expenseDate);
                return month === selectedMonth;
            });
        }

        // Filter by selected date if present
        if (selectedDate) {
            filtered = filtered.filter(expense => doesDateStringMatchUTC(expense.date, selectedDate));
        } else if (selectedMonth === 'all') {
            // If no date selected and no month filter, show first 5
            filtered = filtered.slice(0, 5);
        }

        return filtered;
    })();

    const expenseDates = expenses
        .map(expense => parseUTCDate(expense.date))
        .filter(date => !isNaN(date.getTime()));
    const subscriptionDates = subscriptions
        .filter(sub => sub.next_payment_date)
        .map(sub => parseUTCDate(sub.next_payment_date!))
        .filter(date => !isNaN(date.getTime()));

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date);
        if (date) {
            setDialogOpen(true);
        }
    };

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setExpenseDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Expense
                    </Button>
                    <Button onClick={() => setIncomeDialogOpen(true)} variant="outline" className="gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Income
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="w-5 h-5 text-red-600" />
                        <h2 className="text-xl font-semibold">This Month</h2>
                    </div>
                    <p className="text-2xl font-bold text-red-600">${currentMonthExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <Wallet className="w-5 h-5 text-green-600" />
                        <h2 className="text-xl font-semibold">Current Assets</h2>
                    </div>
                    <p className="text-2xl font-bold text-green-600">${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <Tag className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold">Categories</h2>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{totalCategories}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        <h2 className="text-xl font-semibold">Bank Accounts</h2>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{totalAccounts}</p>
                </div>
            </div>

            <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Expense</DialogTitle>
                        <DialogDescription>Record a quick expense from the dashboard.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleExpenseSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="quick-expense-description">Description</Label>
                            <Input
                                id="quick-expense-description"
                                value={expenseForm.description}
                                onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
                                placeholder="Coffee, groceries, rent..."
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="quick-expense-amount">Amount</Label>
                                <Input
                                    id="quick-expense-amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={expenseForm.amount}
                                    onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quick-expense-date">Date</Label>
                                <Input
                                    id="quick-expense-date"
                                    type="date"
                                    value={expenseForm.date}
                                    onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.name}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Account</Label>
                            <Select value={expenseForm.accountId} onValueChange={(value) => setExpenseForm({ ...expenseForm, accountId: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No account selected" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id.toString()}>
                                            {account.name} (${account.balance.toFixed(2)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Add Expense</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Income</DialogTitle>
                        <DialogDescription>Record money coming in and optionally update an account.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleIncomeSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="quick-income-description">Description</Label>
                            <Input
                                id="quick-income-description"
                                value={incomeForm.description}
                                onChange={(event) => setIncomeForm({ ...incomeForm, description: event.target.value })}
                                placeholder="Paycheck, refund, transfer..."
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="quick-income-amount">Amount</Label>
                                <Input
                                    id="quick-income-amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={incomeForm.amount}
                                    onChange={(event) => setIncomeForm({ ...incomeForm, amount: event.target.value })}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quick-income-date">Date</Label>
                                <Input
                                    id="quick-income-date"
                                    type="date"
                                    value={incomeForm.date}
                                    onChange={(event) => setIncomeForm({ ...incomeForm, date: event.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Source</Label>
                            <Select value={incomeForm.source} onValueChange={(value) => setIncomeForm({ ...incomeForm, source: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a source" />
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
                            <Label>Account</Label>
                            <Select value={incomeForm.accountId} onValueChange={(value) => setIncomeForm({ ...incomeForm, accountId: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No account selected" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id.toString()}>
                                            {account.name} (${account.balance.toFixed(2)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIncomeDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Add Income</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">
                            {selectedDate ? `Expenses on ${selectedDate.toLocaleDateString()}` : 
                             selectedMonth !== 'all' ? `Expenses in ${new Date(2000, parseInt(selectedMonth) - 1, 1).toLocaleDateString('en-US', { month: 'long' })}` : 
                             'Recent Expenses'}
                        </h2>
                        {!selectedDate && (
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setSelectedMonth('all')}
                                    className={`px-3 py-1 text-sm rounded ${selectedMonth === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setSelectedMonth(getMonthValue(new Date()))}
                                    className={`px-3 py-1 text-sm rounded ${selectedMonth === getMonthValue(new Date()) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    This Month
                                </button>
                                <button
                                    onClick={() => {
                                        const now = new Date();
                                        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                        setSelectedMonth(getMonthValue(lastMonth));
                                    }}
                                    className={`px-3 py-1 text-sm rounded ${(() => {
                                        const now = new Date();
                                        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                        return selectedMonth === getMonthValue(lastMonth);
                                    })() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    Last Month
                                </button>
                            </div>
                        )}
                    </div>
                    <ul className="space-y-2">
                        {filteredExpenses.map((expense: Expense) => (
                            <li key={expense.id} className="flex justify-between p-2 border-b">
                                <div>
                                    <p className="font-medium">{expense.description}</p>
                                    <p className="text-sm text-gray-600">
                                        {expense.category} - {formatDateForDisplay(expense.date)}
                                    </p>
                                </div>
                                <p className="font-bold">${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </li>
                        ))}
                    </ul>
                    {selectedDate && filteredExpenses.length === 0 && (
                        <p className="text-gray-500 mt-4">No expenses on this date.</p>
                    )}
                    {!selectedDate && selectedMonth !== 'all' && filteredExpenses.length === 0 && (
                        <p className="text-gray-500 mt-4">No expenses in selected month.</p>
                    )}
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Calendar</h2>
                    <Calendar onSelect={handleDateSelect} modifiers={{ hasExpense: expenseDates, hasSubscription: subscriptionDates }} />
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h2 className="text-xl font-semibold mb-4">Upcoming Payments</h2>
                {upcomingPayments.length > 0 ? (
                    <ul className="space-y-2">
                        {upcomingPayments.map((subscription: Subscription) => (
                            <li key={subscription.id} className="flex justify-between p-2 border-b">
                                <div>
                                    <p className="font-medium">{subscription.name}</p>
                                    <p className="text-sm text-gray-600">
                                        {subscription.provider} - {subscription.next_payment_date ? formatDateForDisplay(subscription.next_payment_date) : 'N/A'}
                                    </p>
                                </div>
                                <p className="font-bold text-red-600">
                                    ${(subscription.price_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No upcoming payments in the next 30 days.</p>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDate ? `Details for ${selectedDate.toLocaleDateString()}` : 'Date Details'}
                        </DialogTitle>
                        <DialogDescription>
                            Expenses and subscription payments for this date
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                        {/* Expenses Section */}
                        <div>
                            <h3 className="text-lg font-semibold mb-3 text-red-600">Expenses</h3>
                            {filteredExpenses.length > 0 ? (
                                <ul className="space-y-2">
                                    {filteredExpenses.map((expense: Expense) => (
                                        <li key={expense.id} className="flex justify-between p-3 border rounded-lg">
                                            <div>
                                                <p className="font-medium">{expense.description}</p>
                                                <p className="text-sm text-gray-600">
                                                    {expense.category} • {formatDateForDisplay(expense.date)}
                                                </p>
                                            </div>
                                            <p className="font-bold text-red-600">
                                                ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">No expenses on this date.</p>
                            )}
                        </div>

                        {/* Subscriptions Section */}
                        <div>
                            <h3 className="text-lg font-semibold mb-3 text-blue-600">Subscription Payments</h3>
                            {selectedDate && (() => {
                                const daySubscriptions = subscriptions.filter(sub =>
                                    sub.next_payment_date &&
                                    doesDateStringMatchUTC(sub.next_payment_date, selectedDate)
                                );
                                return daySubscriptions.length > 0 ? (
                                    <ul className="space-y-2">
                                        {daySubscriptions.map((subscription: Subscription) => (
                                            <li key={subscription.id} className="flex justify-between p-3 border rounded-lg">
                                                <div>
                                                    <p className="font-medium">{subscription.name}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {subscription.provider} • {subscription.billing_cycle} • {subscription.next_payment_date ? formatDateForDisplay(subscription.next_payment_date) : 'N/A'}
                                                    </p>
                                                </div>
                                                <p className="font-bold text-blue-600">
                                                    ${(subscription.price_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500">No subscription payments on this date.</p>
                                );
                            })()}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

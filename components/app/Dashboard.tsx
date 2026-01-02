'use client';

import { useEffect, useState } from 'react';
import { Expense, Account, Category } from '@/lib/types';
import Calendar from '@/lib/Calendar';
import { doesDateStringMatchUTC, parseUTCDate, formatDateForDisplay } from '@/lib/format_date';
import { DollarSign, Wallet, Tag, CreditCard } from 'lucide-react';

export default function Dashboard() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();

    useEffect(() => {
        Promise.all([
            fetch('/api/expenses').then(res => res.json()),
            fetch('/api/accounts').then(res => res.json()),
            fetch('/api/categories').then(res => res.json())
        ]).then(([expensesData, accountsData, categoriesData]) => {
            setExpenses(expensesData);
            setAccounts(accountsData);
            setCategories(categoriesData);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalAssets = accounts.reduce((sum, account) => sum + account.balance, 0);
    const totalCategories = categories.length;
    const totalAccounts = accounts.length;

    const filteredExpenses = selectedDate
        ? expenses.filter(expense => doesDateStringMatchUTC(expense.date, selectedDate))
        : expenses.slice(0, 5);

    const expenseDates = expenses.map(expense => parseUTCDate(expense.date));

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="w-5 h-5 text-red-600" />
                        <h2 className="text-xl font-semibold">Total Expenses</h2>
                    </div>
                    <p className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <Wallet className="w-5 h-5 text-green-600" />
                        <h2 className="text-xl font-semibold">Total Assets</h2>
                    </div>
                    <p className="text-2xl font-bold text-green-600">${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <Tag className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold">Total Categories</h2>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{totalCategories}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center space-x-2 mb-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        <h2 className="text-xl font-semibold">Total Accounts</h2>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{totalAccounts}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">
                        {selectedDate ? `Expenses on ${selectedDate.toLocaleDateString()}` : 'Recent Expenses'}
                    </h2>
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
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Calendar</h2>
                    <Calendar onSelect={setSelectedDate} modifiers={{ hasExpense: expenseDates }} />
                </div>
            </div>
        </div>
    );
}
'use client';

import { useEffect, useState } from 'react';
import { Expense, Account, Category, Subscription } from '@/lib/types';
import { parseUTCDate, formatDateForDisplay } from '@/lib/format_date';
import { 
    DollarSign, 
    Wallet, 
    Tag, 
    CreditCard, 
    TrendingUp, 
    ArrowUpRight,
    ArrowDownRight,
    Calendar as CalendarIcon,
    PieChart,
    BarChart3,
    Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    BarChart, 
    Bar, 
    PieChart as RePieChart, 
    Pie, 
    Cell, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';

export default function EnhancedDashboard() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/expenses').then(res => res.json()),
            fetch('/api/accounts').then(res => res.json()),
            fetch('/api/categories').then(res => res.json()),
            fetch('/api/subscriptions').then(res => res.json())
        ]).then(([expensesData, accountsData, categoriesData, subscriptionsData]) => {
            setExpenses(expensesData);
            setAccounts(accountsData);
            setCategories(categoriesData);
            setSubscriptions(subscriptionsData);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    // Calculate metrics
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

    const lastMonthExpenses = (() => {
        const currentDate = new Date();
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        
        return expenses
            .filter(expense => {
                const expenseDate = parseUTCDate(expense.date);
                return expenseDate.getMonth() === lastMonth.getMonth() && expenseDate.getFullYear() === lastMonth.getFullYear();
            })
            .reduce((total, expense) => total + expense.amount, 0);
    })();

    const totalAssets = accounts.reduce((sum, account) => sum + account.balance, 0);
    const totalCategories = categories.length;
    const totalAccounts = accounts.length;

    // Calculate month-over-month change
    const monthOverMonthChange = lastMonthExpenses > 0 
        ? ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 
        : 0;

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
        .slice(0, 5);

    // Chart data preparation
    const expensesByCategory = (() => {
        const categoryTotals = expenses.reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(categoryTotals).map(([category, amount]) => ({
            name: category,
            value: amount,
            amount: amount.toFixed(2)
        }));
    })();

    const monthlySpendingTrend = (() => {
        const monthlyTotals = expenses.reduce((acc, expense) => {
            const date = new Date(expense.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            acc[monthKey] = (acc[monthKey] || 0) + expense.amount;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(monthlyTotals)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6) // Last 6 months
            .map(([month, amount]) => ({
                month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
                amount: parseFloat(amount.toFixed(2))
            }));
    })();

    const dailySpendingThisMonth = (() => {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const dailyTotals = expenses
            .filter(expense => {
                const expenseDate = parseUTCDate(expense.date);
                return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
            })
            .reduce((acc, expense) => {
                const expenseDate = parseUTCDate(expense.date);
                const day = expenseDate.getDate();
                acc[day] = (acc[day] || 0) + expense.amount;
                return acc;
            }, {} as Record<number, number>);

        // Create array for all days of the month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        return Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            amount: dailyTotals[i + 1] || 0
        }));
    })();

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

    // Top spending categories
    const topCategories = expensesByCategory
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // Recent transactions
    const recentExpenses = expenses
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

    if (loading) return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Month</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${currentMonthExpenses.toFixed(2)}</div>
                        <div className="flex items-center text-xs text-muted-foreground">
                            {monthOverMonthChange >= 0 ? (
                                <>
                                    <ArrowUpRight className="h-3 w-3 text-red-500 mr-1" />
                                    <span className="text-red-500">+{monthOverMonthChange.toFixed(1)}%</span>
                                </>
                            ) : (
                                <>
                                    <ArrowDownRight className="h-3 w-3 text-green-500 mr-1" />
                                    <span className="text-green-500">{monthOverMonthChange.toFixed(1)}%</span>
                                </>
                            )}
                            <span className="ml-1">from last month</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Assets</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalAssets.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Across {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Categories</CardTitle>
                        <Tag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCategories}</div>
                        <p className="text-xs text-muted-foreground">
                            Active categories
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bank Accounts</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalAccounts}</div>
                        <p className="text-xs text-muted-foreground">
                            Connected accounts
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Spending Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Monthly Spending Trend
                        </CardTitle>
                        <CardDescription>Last 6 months of expenses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={monthlySpendingTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip formatter={(value: number | undefined) => value ? [`$${value.toFixed(2)}`, 'Amount'] : ['$0.00', 'Amount']} />
                                <Area 
                                    type="monotone" 
                                    dataKey="amount" 
                                    stroke="#8884d8" 
                                    fill="#8884d8" 
                                    fillOpacity={0.3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Expenses by Category */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="h-5 w-5" />
                            Expenses by Category
                        </CardTitle>
                        <CardDescription>Breakdown of spending by category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <RePieChart>
                                <Pie
                                    data={expensesByCategory}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {expensesByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number | undefined) => value ? [`$${value.toFixed(2)}`, 'Amount'] : ['$0.00', 'Amount']} />
                            </RePieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Daily Spending and Top Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Spending This Month */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Daily Spending This Month
                        </CardTitle>
                        <CardDescription>Daily expense breakdown for current month</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={dailySpendingThisMonth}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="day" />
                                <YAxis />
                                <Tooltip formatter={(value: number | undefined) => value ? [`$${value.toFixed(2)}`, 'Amount'] : ['$0.00', 'Amount']} />
                                <Bar dataKey="amount" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Categories */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Top Categories
                        </CardTitle>
                        <CardDescription>Highest spending categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {topCategories.map((category) => (
                                <div key={category.name} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{category.name}</span>
                                        <span className="text-sm font-bold">${category.value.toFixed(2)}</span>
                                    </div>
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                        <div 
                                            className="h-full w-full flex-1 bg-blue-600 transition-all duration-300 ease-in-out"
                                            style={{ transform: `translateX(-${100 - ((category.value / Math.max(...topCategories.map(c => c.value))) * 100)}%)` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions and Upcoming Payments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5" />
                            Recent Transactions
                        </CardTitle>
                        <CardDescription>Latest expense entries</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentExpenses.map((expense) => (
                                <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <p className="font-medium">{expense.description}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {expense.category} • {formatDateForDisplay(expense.date)}
                                        </p>
                                    </div>
                                    <p className="font-bold text-red-600">${expense.amount.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming Payments */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5" />
                            Upcoming Payments
                        </CardTitle>
                        <CardDescription>Next 30 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {upcomingPayments.length > 0 ? (
                                upcomingPayments.map((subscription) => (
                                    <div key={subscription.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <p className="font-medium">{subscription.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {subscription.provider} • {subscription.next_payment_date ? formatDateForDisplay(subscription.next_payment_date) : 'N/A'}
                                            </p>
                                        </div>
                                        <p className="font-bold text-blue-600">
                                            ${(subscription.price_cents / 100).toFixed(2)}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-center py-4">No upcoming payments</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

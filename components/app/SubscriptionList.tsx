'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Edit, Trash2, Calendar, DollarSign, CreditCard, Clock, TrendingUp, AlertCircle, CheckCircle, XCircle, RefreshCw, List, Filter, ChevronDown, User, History, ExternalLink, Table, Layout } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateForDisplay } from '@/lib/format_date';
import { formatPaymentAmount, getUpcomingPayments, getOverduePayments, PaymentSchedule } from '@/lib/recurring-payments';
import { toast } from "sonner";

interface Subscription {
    id: string;
    name: string;
    provider?: string;
    price_cents: number;
    currency: string;
    billing_cycle: string;
    start_date: string;
    next_payment_date?: string;
    status: string;
    end_date?: string;
    website_url?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    category?: {
        id: number;
        name: string;
    };
}

interface Category {
    id: number;
    name: string;
}

interface SubscriptionPayment {
    id: string;
    subscriptionId: string;
    amount: number;
    currency: string;
    dueDate: string;
    paymentDate?: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    paymentMethod?: string;
    createdAt: string;
    updatedAt: string;
}

const billingCycles = [
    'monthly',
    'quarterly',
    'yearly',
    'weekly',
    'daily'
];

const currencies = [
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'JPY'
];

// Utility function to calculate next payment date
const calculateNextPaymentDate = (startDate: Date, billingCycle: string): Date => {
    const date = new Date(startDate.getTime()); // Create a copy to avoid mutating original

    switch (billingCycle) {
        case 'daily':
            date.setUTCDate(date.getUTCDate() + 1);
            break;
        case 'weekly':
            date.setUTCDate(date.getUTCDate() + 7);
            break;
        case 'monthly':
            date.setUTCMonth(date.getUTCMonth() + 1);
            break;
        case 'quarterly':
            date.setUTCMonth(date.getUTCMonth() + 3);
            break;
        case 'yearly':
            date.setUTCFullYear(date.getUTCFullYear() + 1);
            break;
        default:
            date.setUTCMonth(date.getUTCMonth() + 1); // default to monthly
    }

    return date;
};

// Utility function to get upcoming payments (next 3 payments)
const getUpcomingPaymentsList = (subscription: Subscription): Date[] => {
    if (subscription.status !== 'active' || !subscription.start_date) return [];

    const payments: Date[] = [];
    let currentDate = new Date(subscription.start_date);

    // Generate next 3 payment dates
    for (let i = 0; i < 3; i++) {
        currentDate = calculateNextPaymentDate(currentDate, subscription.billing_cycle);
        payments.push(new Date(currentDate.getTime())); // Create a copy
    }

    return payments;
};

export default function SubscriptionList() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [currentView, setCurrentView] = useState<'table' | 'card' | 'list'>('table');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
    const [showPaymentsModal, setShowPaymentsModal] = useState(false);
    const [selectedSubscriptionPayments, setSelectedSubscriptionPayments] = useState<SubscriptionPayment[]>([]);
    const [upcomingPaymentList, setUpcomingPaymentList] = useState<PaymentSchedule[]>([]);
    const [overduePaymentList, setOverduePaymentList] = useState<PaymentSchedule[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        provider: '',
        price_cents: '',
        currency: 'USD',
        billing_cycle: 'monthly',
        start_date: '',
        status: 'active',
        website_url: '',
        notes: '',
        categoryId: ''
    });

    const fetchSubscriptions = () => {
        fetch('/api/subscriptions')
            .then((res) => res.json())
            .then((data) => {
                setSubscriptions(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setSubscriptions([]);
                setLoading(false);
            });
    };

    const fetchCategories = () => {
        fetch('/api/categories')
            .then((res) => res.json())
            .then((data) => {
                setCategories(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                setCategories([]);
            });
    };

    useEffect(() => {
        fetchSubscriptions();
        fetchCategories();
    }, []);

    const handleEdit = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        setFormData({
            name: subscription.name,
            provider: subscription.provider || '',
            price_cents: subscription.price_cents.toString(),
            currency: subscription.currency,
            billing_cycle: subscription.billing_cycle,
            start_date: subscription.start_date ? new Date(subscription.start_date).toISOString().split('T')[0] : '',
            status: subscription.status,
            website_url: subscription.website_url || '',
            notes: subscription.notes || '',
            categoryId: subscription.category?.id.toString() || ''
        });
        setEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this subscription?')) {
            const response = await fetch(`/api/subscriptions/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                toast.success("Subscription deleted successfully!");
                fetchSubscriptions(); // Refresh list
            } else {
                toast.error("Failed to delete subscription");
            }
        }
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Create UTC date from the date string (YYYY-MM-DD format from input)
        const startDate = formData.start_date
            ? new Date(formData.start_date + 'T00:00:00.000Z') // Treat as UTC midnight
            : new Date(); // Current UTC time

        const nextPaymentDate = calculateNextPaymentDate(startDate, formData.billing_cycle);

        const response = await fetch('/api/subscriptions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                price_cents: parseInt(formData.price_cents),
                start_date: startDate.toISOString(),
                next_payment_date: nextPaymentDate.toISOString(),
                status: formData.status || 'active'
            }),
        });
        if (response.ok) {
            toast.success("Subscription added successfully!");
            setAddModalOpen(false);
            setFormData({
                name: '',
                provider: '',
                price_cents: '',
                currency: 'USD',
                billing_cycle: 'monthly',
                start_date: '',
                status: 'active',
                website_url: '',
                notes: '',
                categoryId: ''
            });
            fetchSubscriptions(); // Refresh list
        } else {
            toast.error("Failed to add subscription");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSubscription) return;

        // Create UTC date from the date string (YYYY-MM-DD format from input)
        const startDate = formData.start_date
            ? new Date(formData.start_date + 'T00:00:00.000Z') // Treat as UTC midnight
            : (editingSubscription.start_date ? new Date(editingSubscription.start_date) : new Date());

        const nextPaymentDate = calculateNextPaymentDate(startDate, formData.billing_cycle);

        const response = await fetch(`/api/subscriptions/${editingSubscription.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                price_cents: parseInt(formData.price_cents),
                start_date: startDate.toISOString(),
                next_payment_date: nextPaymentDate.toISOString(),
                status: formData.status
            }),
        });
        if (response.ok) {
            toast.success("Subscription updated successfully!");
            setEditModalOpen(false);
            setEditingSubscription(null);
            setFormData({
                name: '',
                provider: '',
                price_cents: '',
                currency: 'USD',
                billing_cycle: 'monthly',
                start_date: '',
                status: 'active',
                website_url: '',
                notes: '',
                categoryId: ''
            });
            fetchSubscriptions(); // Refresh list
        } else {
            toast.error("Failed to update subscription");
        }
    };

    const handleModalClose = () => {
        setAddModalOpen(false);
        setEditModalOpen(false);
        setEditingSubscription(null);
        setFormData({
            name: '',
            provider: '',
            price_cents: '',
            currency: 'USD',
            billing_cycle: 'monthly',
            start_date: '',
            status: 'active',
            website_url: '',
            notes: '',
            categoryId: ''
        });
    };

    const getTotalMonthlyCost = (subs: Subscription[] = subscriptions) => {
        return subs.reduce((total, sub) => {
            if (sub.billing_cycle === 'monthly') {
                return total + (sub.price_cents / 100);
            } else if (sub.billing_cycle === 'yearly') {
                return total + (sub.price_cents / 100) / 12;
            } else if (sub.billing_cycle === 'quarterly') {
                return total + (sub.price_cents / 100) / 3;
            } else if (sub.billing_cycle === 'weekly') {
                return total + (sub.price_cents / 100) * 4.33;
            } else if (sub.billing_cycle === 'daily') {
                return total + (sub.price_cents / 100) * 30;
            }
            return total;
        }, 0);
    };

    const getUpcomingPayments = (subs: Subscription[] = subscriptions) => {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const upcomingPayments: Array<{ subscription: Subscription, paymentDate: Date }> = [];

        subs.forEach(sub => {
            if (sub.status !== 'active') return;

            const paymentDates = getUpcomingPaymentsList(sub);
            paymentDates.forEach(paymentDate => {
                if (paymentDate >= now && paymentDate <= nextWeek) {
                    upcomingPayments.push({
                        subscription: sub,
                        paymentDate: paymentDate
                    });
                }
            });
        });

        return upcomingPayments;
    };

    const getFilteredSubscriptions = () => {
        if (selectedCategoryIds.size === 0) {
            return subscriptions;
        }
        return subscriptions.filter(sub =>
            sub.category && selectedCategoryIds.has(sub.category.id)
        );
    };

    const handleCategoryFilterChange = (categoryId: number, checked: boolean) => {
        const newSelected = new Set(selectedCategoryIds);
        if (checked) {
            newSelected.add(categoryId);
        } else {
            newSelected.delete(categoryId);
        }
        setSelectedCategoryIds(newSelected);
    };

    const clearCategoryFilters = () => {
        setSelectedCategoryIds(new Set());
    };

    // Payment management functions
    const fetchSubscriptionPayments = async (subscriptionId: string) => {
        try {
            const response = await fetch(`/api/subscriptions/${subscriptionId}/payments?includeUpcoming=true&includeOverdue=true`);
            if (response.ok) {
                const data = await response.json();
                setSelectedSubscriptionPayments(data.payments || []);
                setUpcomingPaymentList(data.upcoming || []);
                setOverduePaymentList(data.overdue || []);
            }
        } catch {
            toast.error("Failed to fetch payment history");
        }
    };

    const handleViewPayments = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        fetchSubscriptionPayments(subscription.id);
        setShowPaymentsModal(true);
    };

    const handleMarkPaymentPaid = async (paymentId: string) => {
        try {
            const response = await fetch(`/api/subscriptions/payments/${paymentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'paid',
                    paymentMethod: 'manual'
                }),
            });
            if (response.ok) {
                toast.success("Payment marked as paid!");
                if (editingSubscription) {
                    fetchSubscriptionPayments(editingSubscription.id);
                }
                fetchSubscriptions(); // Refresh subscriptions to update next payment dates
            } else {
                toast.error("Failed to update payment");
            }
        } catch (error) {
            toast.error("Failed to update payment");
        }
    };

    const generateFuturePayments = async () => {
        try {
            const response = await fetch('/api/subscriptions/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    monthsAhead: 12
                }),
            });
            if (response.ok) {
                const data = await response.json();
                toast.success(`Generated ${data.payments.length} future payments!`);
            } else {
                toast.error("Failed to generate payments");
            }
        } catch {
            toast.error("Failed to generate payments");
        }
    };

    const migrateExistingPayments = async () => {
        try {
            const response = await fetch('/api/admin/migrate-payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.ok) {
                const data = await response.json();
                toast.success(`Migration completed! Created ${data.summary.totalPaymentsCreated} payments for ${data.summary.totalSubscriptions} subscriptions.`);
                fetchSubscriptions(); // Refresh the subscriptions list
            } else {
                const errorData = await response.json();
                toast.error(`Migration failed: ${errorData.error}`);
            }
        } catch {
            toast.error("Failed to migrate payments");
        }
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

    const filteredSubscriptions = getFilteredSubscriptions();
    const totalMonthly = getTotalMonthlyCost(filteredSubscriptions);
    const upcomingPayments = getUpcomingPayments(filteredSubscriptions);

    // Check if user has existing subscriptions but likely no payment history
    const hasExistingSubscriptions = subscriptions.length > 0;
    const shouldShowMigrationAlert = hasExistingSubscriptions && subscriptions.some(sub => {
        const startDate = new Date(sub.start_date);
        const daysSinceStart = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceStart > 30; // Subscriptions older than 30 days likely have payment history
    });

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
                    <p className="text-muted-foreground mt-2">
                        Track and manage your recurring subscriptions
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center border rounded-md p-1">
                        <Button
                            variant={currentView === 'table' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setCurrentView('table')}
                            className="h-8 w-8 p-0"
                        >
                            <Table className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={currentView === 'card' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setCurrentView('card')}
                            className="h-8 w-8 p-0"
                        >
                            <Layout className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={currentView === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setCurrentView('list')}
                            className="h-8 w-8 p-0"
                        >
                            <List className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Category Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="w-4 h-4 mr-2" />
                                Filter
                                {selectedCategoryIds.size > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                        {selectedCategoryIds.size}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">Filter by Category</h4>
                                    {selectedCategoryIds.size > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearCategoryFilters}
                                            className="h-6 px-2 text-xs"
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {categories.map((category) => (
                                        <div key={category.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`category-${category.id}`}
                                                checked={selectedCategoryIds.has(category.id)}
                                                onCheckedChange={(checked) =>
                                                    handleCategoryFilterChange(category.id, checked as boolean)
                                                }
                                            />
                                            <Label
                                                htmlFor={`category-${category.id}`}
                                                className="text-sm font-normal cursor-pointer"
                                            >
                                                {category.name}
                                            </Label>
                                        </div>
                                    ))}
                                    {categories.length === 0 && (
                                        <p className="text-sm text-muted-foreground">No categories available</p>
                                    )}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Subscription
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Subscription</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Service Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Netflix, Spotify, etc."
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="provider">Provider (Optional)</Label>
                                    <Input
                                        id="provider"
                                        value={formData.provider}
                                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                        placeholder="Company name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="price">Price</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            value={formData.price_cents}
                                            onChange={(e) => setFormData({ ...formData, price_cents: e.target.value })}
                                            placeholder="9.99"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="currency">Currency</Label>
                                        <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {currencies.map((currency) => (
                                                    <SelectItem key={currency} value={currency}>
                                                        {currency}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="billing_cycle">Billing Cycle</Label>
                                    <Select value={formData.billing_cycle} onValueChange={(value) => setFormData({ ...formData, billing_cycle: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {billingCycles.map((cycle) => (
                                                <SelectItem key={cycle} value={cycle}>
                                                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="category">Category (Optional)</Label>
                                    <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((category) => (
                                                <SelectItem key={category.id} value={category.id.toString()}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                            <SelectItem value="paused">Paused</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="website">Website URL (Optional)</Label>
                                    <Input
                                        id="website"
                                        type="url"
                                        value={formData.website_url}
                                        onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                                        placeholder="https://example.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Additional notes about this subscription"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex justify-end space-x-2 pt-4">
                                    <Button type="button" variant="outline" onClick={handleModalClose}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">Add Subscription</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Migration Alert */}
            {shouldShowMigrationAlert && (
                <Card className="mb-6 border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="text-orange-800 flex items-center">
                            <Calendar className="w-5 h-5 mr-2" />
                            Import Your Payment History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-orange-700 mb-4">
                            We detected you have existing subscriptions. Would you like to import your payment history?
                            This will create payment records based on your subscription start dates and billing cycles.
                        </p>
                        <div className="flex space-x-2">
                            <Button onClick={migrateExistingPayments} className="bg-orange-600 hover:bg-orange-700">
                                Import Payment History
                            </Button>
                            <Button variant="outline" onClick={() => setShowPaymentsModal(true)}>
                                Learn More
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredSubscriptions.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {selectedCategoryIds.size > 0 ? 'Filtered subscriptions' : 'Active subscriptions'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalMonthly.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Estimated monthly total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Upcoming Payments</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{upcomingPayments.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Due within 7 days
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Upcoming Payments Alert */}
            {upcomingPayments.length > 0 && (
                <Card className="mb-6 border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="text-orange-800 flex items-center">
                            <Calendar className="w-5 h-5 mr-2" />
                            Upcoming Payments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {upcomingPayments.map((payment, index) => (
                                <div key={`${payment.subscription.id}-${index}`} className="flex justify-between items-center">
                                    <span className="font-medium">{payment.subscription.name}</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-muted-foreground">
                                            {formatPaymentAmount(payment.subscription.price_cents, payment.subscription.currency)} on {formatDateForDisplay(payment.paymentDate.toISOString())}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Table View */}
            {currentView === 'table' && (
                <div className="space-y-4">
                    {filteredSubscriptions.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Calendar className="w-12 h-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    {selectedCategoryIds.size > 0 ? 'No subscriptions match your filters' : 'No subscriptions yet'}
                                </h3>
                                <p className="text-gray-500 text-center mb-4">
                                    {selectedCategoryIds.size > 0
                                        ? 'Try adjusting your category filters or clear them to see all subscriptions.'
                                        : 'Start tracking your subscriptions by adding your first one.'
                                    }
                                </p>
                                {selectedCategoryIds.size > 0 ? (
                                    <Button onClick={clearCategoryFilters} variant="outline">
                                        Clear Filters
                                    </Button>
                                ) : (
                                    <Button onClick={() => setAddModalOpen(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Your First Subscription
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Payment</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredSubscriptions.map((subscription) => (
                                                <tr key={subscription.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">{subscription.name}</div>
                                                                {subscription.website_url && (
                                                                    <a
                                                                        href={subscription.website_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-sm text-blue-600 hover:underline flex items-center"
                                                                    >
                                                                        Website <ExternalLink className="w-3 h-3 ml-1" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{subscription.provider || '-'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{formatPaymentAmount(subscription.price_cents, subscription.currency)}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{subscription.category?.name || '-'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {subscription.next_payment_date ? formatDateForDisplay(subscription.next_payment_date) : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>{subscription.status}</Badge>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <div className="flex space-x-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEdit(subscription)}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleViewPayments(subscription)}
                                                                title="View Payment History"
                                                            >
                                                                <CreditCard className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleDelete(subscription.id)}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Card View */}
            {currentView === 'card' && (
                <div className="grid gap-4">
                    {subscriptions.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Calendar className="w-12 h-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No subscriptions yet</h3>
                                <p className="text-gray-500 text-center mb-4">
                                    Start tracking your subscriptions by adding your first one.
                                </p>
                                <Button onClick={() => setAddModalOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Your First Subscription
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        subscriptions.map((subscription) => (
                            <Card key={subscription.id}>
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <h3 className="text-lg font-semibold">{subscription.name}</h3>
                                                {subscription.provider && (
                                                    <Badge variant="secondary">{subscription.provider}</Badge>
                                                )}
                                                <Badge variant="outline">{subscription.billing_cycle}</Badge>
                                                {subscription.category && (
                                                    <Badge variant="outline">{subscription.category.name}</Badge>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <p>Price: {formatPaymentAmount(subscription.price_cents, subscription.currency)}</p>
                                                {subscription.start_date && <p>Started: {formatDateForDisplay(subscription.start_date)}</p>}
                                                {subscription.next_payment_date && (
                                                    <p>Next Payment: {formatDateForDisplay(subscription.next_payment_date)}</p>
                                                )}
                                                <p>Status: <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>{subscription.status}</Badge></p>
                                                {subscription.website_url && (
                                                    <p>
                                                        Website: <a
                                                            href={subscription.website_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline inline-flex items-center"
                                                        >
                                                            {subscription.website_url} <ExternalLink className="w-3 h-3 ml-1" />
                                                        </a>
                                                    </p>
                                                )}
                                                {subscription.notes && (
                                                    <p>Notes: {subscription.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEdit(subscription)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDelete(subscription.id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* List View */}
            {currentView === 'list' && (
                <div className="space-y-2">
                    {filteredSubscriptions.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Calendar className="w-12 h-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    {selectedCategoryIds.size > 0 ? 'No subscriptions match your filters' : 'No subscriptions yet'}
                                </h3>
                                <p className="text-gray-500 text-center mb-4">
                                    {selectedCategoryIds.size > 0
                                        ? 'Try adjusting your category filters or clear them to see all subscriptions.'
                                        : 'Start tracking your subscriptions by adding your first one.'
                                    }
                                </p>
                                {selectedCategoryIds.size > 0 ? (
                                    <Button onClick={clearCategoryFilters} variant="outline">
                                        Clear Filters
                                    </Button>
                                ) : (
                                    <Button onClick={() => setAddModalOpen(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Your First Subscription
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        filteredSubscriptions.map((subscription) => (
                            <Card key={subscription.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3">
                                                <h3 className="font-medium">{subscription.name}</h3>
                                                {subscription.provider && (
                                                    <Badge variant="secondary" className="text-xs">{subscription.provider}</Badge>
                                                )}
                                                <Badge variant="outline" className="text-xs">{subscription.billing_cycle}</Badge>
                                                {subscription.category && (
                                                    <Badge variant="outline" className="text-xs">{subscription.category.name}</Badge>
                                                )}
                                                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="text-xs">{subscription.status}</Badge>
                                                <span className="text-sm font-medium text-green-600">
                                                    {formatPaymentAmount(subscription.price_cents, subscription.currency)}
                                                </span>
                                                {subscription.start_date && (
                                                    <span className="text-sm text-gray-500">
                                                        Started: {formatDateForDisplay(subscription.start_date)}
                                                    </span>
                                                )}
                                                {subscription.next_payment_date && (
                                                    <span className="text-sm text-gray-500">
                                                        Next: {formatDateForDisplay(subscription.next_payment_date)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex space-x-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(subscription)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(subscription.id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b bg-white">
                            <h2 className="text-xl font-bold text-gray-900">Edit Subscription</h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </Button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-6">
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-name">Service Name</Label>
                                    <Input
                                        id="edit-name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Netflix, Spotify, etc."
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-provider">Provider (Optional)</Label>
                                    <Input
                                        id="edit-provider"
                                        value={formData.provider}
                                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                        placeholder="Company name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-price">Price</Label>
                                        <Input
                                            id="edit-price"
                                            type="number"
                                            step="0.01"
                                            value={formData.price_cents}
                                            onChange={(e) => setFormData({ ...formData, price_cents: e.target.value })}
                                            placeholder="9.99"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-currency">Currency</Label>
                                        <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {currencies.map((currency) => (
                                                    <SelectItem key={currency} value={currency}>
                                                        {currency}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-billing_cycle">Billing Cycle</Label>
                                    <Select value={formData.billing_cycle} onValueChange={(value) => setFormData({ ...formData, billing_cycle: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {billingCycles.map((cycle) => (
                                                <SelectItem key={cycle} value={cycle}>
                                                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-category">Category (Optional)</Label>
                                    <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((category) => (
                                                <SelectItem key={category.id} value={category.id.toString()}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-start_date">Start Date</Label>
                                    <Input
                                        id="edit-start_date"
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-status">Status</Label>
                                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                            <SelectItem value="paused">Paused</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-website">Website URL (Optional)</Label>
                                    <Input
                                        id="edit-website"
                                        type="url"
                                        value={formData.website_url}
                                        onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                                        placeholder="https://example.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-notes">Notes (Optional)</Label>
                                    <Textarea
                                        id="edit-notes"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Additional notes about this subscription"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex justify-end space-x-2 pt-4">
                                    <Button type="button" variant="outline" onClick={handleModalClose}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">Update Subscription</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment History Modal */}
            {showPaymentsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="w-full h-full max-w-3xl max-h-full bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-2 md:p-3 border-b bg-white">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-sm md:text-base font-bold text-gray-900 truncate">
                                    <CreditCard className="w-3 h-3 mr-1 text-blue-600 inline" />
                                    <span className="truncate">Payment History - {editingSubscription?.name}</span>
                                </h2>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPaymentsModal(false)}
                                className="text-gray-500 hover:text-gray-700 shrink-0 p-1"
                            >
                                ✕
                            </Button>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-2 md:p-3">
                            <div className="space-y-2 max-w-3xl mx-auto">
                                {/* Migration and Generation Buttons */}
                                <div className="bg-gray-50 rounded-lg p-3 md:p-4 border">
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold mb-1">Payment Management</h3>
                                            <p className="text-gray-600 text-xs hidden md:block">
                                                Import past payments and generate future payment schedules
                                            </p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button onClick={migrateExistingPayments} variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-50 text-xs px-2 py-1 w-full sm:w-auto">
                                                <RefreshCw className="w-3 h-3 mr-1 text-orange-600" />
                                                Migrate
                                            </Button>
                                            <Button onClick={generateFuturePayments} variant="outline" className="hover:bg-blue-50 text-xs px-2 py-1 w-full sm:w-auto">
                                                <Plus className="w-3 h-3 mr-1 text-blue-600" />
                                                Generate
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Summary Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <Card className="bg-green-50 border-green-200">
                                        <CardContent className="p-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs text-green-600 font-medium">Paid</p>
                                                    <p className="text-base font-bold text-green-700">
                                                        {selectedSubscriptionPayments.filter(p => p.status === 'paid').length}
                                                    </p>
                                                </div>
                                                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                                    <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-blue-50 border-blue-200">
                                        <CardContent className="p-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs text-blue-600 font-medium">Pending</p>
                                                    <p className="text-base font-bold text-blue-700">
                                                        {selectedSubscriptionPayments.filter(p => p.status === 'pending').length}
                                                    </p>
                                                </div>
                                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <Clock className="w-2.5 h-2.5 text-blue-600" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-purple-50 border-purple-200">
                                        <CardContent className="p-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs text-purple-600 font-medium">Total</p>
                                                    <p className="text-base font-bold text-purple-700">
                                                        {formatPaymentAmount(
                                                            selectedSubscriptionPayments.reduce((sum, p) => sum + p.amount, 0),
                                                            selectedSubscriptionPayments[0]?.currency || 'USD'
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                                                    <DollarSign className="w-2.5 h-2.5 text-purple-600" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Payment History */}
                                <Card className="border">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center">
                                            <TrendingUp className="w-3 h-3 mr-2" />
                                            <span className="truncate">Payment History</span>
                                        </CardTitle>
                                        <p className="text-gray-600 mt-1 text-xs">
                                            Payment transactions
                                        </p>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {selectedSubscriptionPayments.length === 0 ? (
                                            <div className="text-center py-8 md:py-12">
                                                <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                                                    <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-gray-400" />
                                                </div>
                                                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">No Payment History</h3>
                                                <p className="text-gray-500 mb-3 md:mb-4 max-w-lg mx-auto text-xs md:text-sm">
                                                    Start by migrating your existing payments or generating future payment schedules.
                                                </p>
                                                <div className="flex flex-col sm:flex-row justify-center gap-2">
                                                    <Button onClick={migrateExistingPayments} variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-50 text-sm px-4 py-2 w-full sm:w-auto">
                                                        <RefreshCw className="w-3 h-3 mr-1 text-orange-600" />
                                                        Migrate
                                                    </Button>
                                                    <Button onClick={generateFuturePayments} variant="outline" className="hover:bg-blue-50 text-sm px-4 py-2 w-full sm:w-auto">
                                                        <Plus className="w-3 h-3 mr-1 text-blue-600" />
                                                        Generate
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 pr-2">
                                                {selectedSubscriptionPayments.map((payment) => (
                                                    <div key={payment.id} className="flex flex-col md:flex-row md:justify-between md:items-start p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="mb-2">
                                                                <div className="flex flex-col md:flex-row md:items-start md:space-x-3 mb-2">
                                                                    <span className="text-xs md:text-sm font-semibold text-gray-900">
                                                                        {payment.status === 'paid' ? <><CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1 text-green-600" /> Paid</> : <><Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 text-blue-600" /> Due</>}: 
                                                                        <span className="block md:inline">{formatDateForDisplay(payment.dueDate)}</span>
                                                                    </span>
                                                                    {payment.paymentDate && payment.status === 'paid' && (
                                                                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-semibold mt-1 md:mt-0">
                                                                            Paid on: {formatDateForDisplay(payment.paymentDate)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col md:flex-row md:items-center space-y-1 md:space-y-0 md:space-x-4 text-xs text-gray-600">
                                                                    {payment.paymentMethod && (
                                                                        <span className="flex items-center">
                                                                            <CreditCard className="w-3 h-3 mr-1 text-gray-600" />
                                                                            <span className="font-medium">via {payment.paymentMethod}</span>
                                                                        </span>
                                                                    )}
                                                                    <span className="flex items-center">
                                                                        <Calendar className="w-3 h-3 mr-1 text-gray-600" />
                                                                        <span className="font-medium">Created: {formatDateForDisplay(payment.createdAt)}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col md:flex-col md:items-end space-y-2 md:space-y-2 md:ml-0 md:ml-8">
                                                            <div className="text-left md:text-right">
                                                                <p className="text-sm md:text-lg font-bold text-gray-900">
                                                                    {formatPaymentAmount(payment.amount, payment.currency)}
                                                                </p>
                                                                <p className="text-xs text-gray-500 font-semibold">{payment.currency}</p>
                                                            </div>
                                                            <div className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-2">
                                                                <Badge 
                                                                    variant={payment.status === 'paid' ? 'default' : 
                                                                            payment.status === 'overdue' ? 'destructive' : 'secondary'}
                                                                    className="min-w-16 md:min-w-20 text-center py-1 md:py-1 text-xs font-semibold"
                                                                >
                                                                    {payment.status}
                                                                </Badge>
                                                                {payment.status === 'pending' && (
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleMarkPaymentPaid(payment.id)}
                                                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 md:px-3 md:py-1 text-xs w-full md:w-auto"
                                                                    >
                                                                        ✓ Mark Paid
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
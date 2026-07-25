'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    CreditCard,
    ExternalLink,
    Filter,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { EmptyState, MetricTile, PageHeader } from '@/components/app/WorkspaceUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { formatDateForDisplay } from '@/lib/format_date';
import { calculateNextPaymentDate, estimateMonthlyCost, formatPaymentAmount } from '@/lib/recurring-payments';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

type SchedulePreview = {
    dueDate: string | Date;
    amount: number;
    currency: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
};

const NO_CATEGORY = '__none__';

const billingCycleOptions = ['monthly', 'quarterly', 'yearly', 'weekly', 'daily'].map((cycle) => ({
    value: cycle,
    label: cycle.charAt(0).toUpperCase() + cycle.slice(1),
}));

const currencyOptions = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((currency) => ({
    value: currency,
    label: currency,
}));

const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'cancelled', label: 'Cancelled' },
];

const blankForm = {
    name: '',
    provider: '',
    price: '',
    currency: 'USD',
    billing_cycle: 'monthly',
    start_date: '',
    status: 'active',
    website_url: '',
    notes: '',
    categoryId: '',
};

function centsFromPrice(price: string) {
    return Math.round((parseFloat(price) || 0) * 100);
}

function priceFromCents(cents: number) {
    return (cents / 100).toFixed(2);
}

function dateInputValue(value?: string) {
    return value ? new Date(value).toISOString().split('T')[0] : '';
}

function statusBadge(status: string) {
    if (status === 'active') {
        return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Active</Badge>;
    }
    if (status === 'cancelled') {
        return <Badge variant="secondary">Cancelled</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
}

function paymentStatusBadge(status: SubscriptionPayment['status'] | SchedulePreview['status']) {
    if (status === 'paid') {
        return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Paid</Badge>;
    }
    if (status === 'overdue') {
        return <Badge variant="destructive">Overdue</Badge>;
    }
    if (status === 'cancelled') {
        return <Badge variant="secondary">Cancelled</Badge>;
    }
    return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Pending</Badge>;
}

function formatScheduleDate(value: string | Date) {
    return formatDateForDisplay(value instanceof Date ? value.toISOString() : value);
}

function SubscriptionForm({
    formData,
    setFormData,
    categoryOptions,
    onSubmit,
    onCancel,
    submitLabel,
}: {
    formData: typeof blankForm;
    setFormData: (value: typeof blankForm) => void;
    categoryOptions: Array<{ value: string; label: string }>;
    onSubmit: (event: React.FormEvent) => void;
    onCancel: () => void;
    submitLabel: string;
}) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="subscription-name">Service</Label>
                    <Input
                        id="subscription-name"
                        value={formData.name}
                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                        placeholder="Netflix, Spotify, GitHub"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="subscription-provider">Provider</Label>
                    <Input
                        id="subscription-provider"
                        value={formData.provider}
                        onChange={(event) => setFormData({ ...formData, provider: event.target.value })}
                        placeholder="Company name"
                    />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label htmlFor="subscription-price">Price</Label>
                    <Input
                        id="subscription-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(event) => setFormData({ ...formData, price: event.target.value })}
                        placeholder="9.99"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label>Currency</Label>
                    <SearchableSelect
                        value={formData.currency}
                        onValueChange={(value) => setFormData({ ...formData, currency: value })}
                        options={currencyOptions}
                        searchPlaceholder="Search currencies..."
                    />
                </div>
                <div className="space-y-2">
                    <Label>Cycle</Label>
                    <SearchableSelect
                        value={formData.billing_cycle}
                        onValueChange={(value) => setFormData({ ...formData, billing_cycle: value })}
                        options={billingCycleOptions}
                        searchPlaceholder="Search cycles..."
                    />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label>Category</Label>
                    <SearchableSelect
                        value={formData.categoryId || NO_CATEGORY}
                        onValueChange={(value) => setFormData({ ...formData, categoryId: value === NO_CATEGORY ? '' : value })}
                        options={categoryOptions}
                        placeholder="No category"
                        searchPlaceholder="Search categories..."
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="subscription-start">Start date</Label>
                    <Input
                        id="subscription-start"
                        type="date"
                        value={formData.start_date}
                        onChange={(event) => setFormData({ ...formData, start_date: event.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Status</Label>
                    <SearchableSelect
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                        options={statusOptions}
                        searchPlaceholder="Search statuses..."
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="subscription-website">Website URL</Label>
                <Input
                    id="subscription-website"
                    type="url"
                    value={formData.website_url}
                    onChange={(event) => setFormData({ ...formData, website_url: event.target.value })}
                    placeholder="https://example.com"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="subscription-notes">Notes</Label>
                <Textarea
                    id="subscription-notes"
                    value={formData.notes}
                    onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                    placeholder="Cancellation notes, plan details, or billing quirks"
                    rows={3}
                />
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit">{submitLabel}</Button>
            </div>
        </form>
    );
}

export default function SubscriptionList() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
    const [selectedSubscriptionPayments, setSelectedSubscriptionPayments] = useState<SubscriptionPayment[]>([]);
    const [upcomingPaymentList, setUpcomingPaymentList] = useState<SchedulePreview[]>([]);
    const [overduePaymentList, setOverduePaymentList] = useState<SchedulePreview[]>([]);
    const [formData, setFormData] = useState(blankForm);

    const categoryOptions = useMemo(() => [
        { value: NO_CATEGORY, label: 'No category' },
        ...categories.map((category) => ({
            value: category.id.toString(),
            label: category.name,
        })),
    ], [categories]);

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
            .then((data) => setCategories(Array.isArray(data) ? data : []))
            .catch(() => setCategories([]));
    };

    useEffect(() => {
        fetchSubscriptions();
        fetchCategories();
    }, []);

    const filteredSubscriptions = useMemo(() => {
        if (selectedCategoryIds.size === 0) return subscriptions;
        return subscriptions.filter((subscription) => subscription.category && selectedCategoryIds.has(subscription.category.id));
    }, [selectedCategoryIds, subscriptions]);

    const activeSubscriptions = filteredSubscriptions.filter((subscription) => subscription.status === 'active');
    const totalMonthly = estimateMonthlyCost(filteredSubscriptions);
    const dueThisWeek = filteredSubscriptions.filter((subscription) => {
        if (!subscription.next_payment_date || subscription.status !== 'active') return false;
        const dueDate = new Date(subscription.next_payment_date);
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return dueDate >= now && dueDate <= nextWeek;
    });
    const shouldShowMigrationAlert = subscriptions.some((subscription) => {
        const startDate = new Date(subscription.start_date);
        const ageInDays = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return ageInDays > 30;
    });

    const resetForm = () => {
        setFormData(blankForm);
        setEditingSubscription(null);
    };

    const fillForm = (subscription: Subscription) => {
        setFormData({
            name: subscription.name,
            provider: subscription.provider || '',
            price: priceFromCents(subscription.price_cents),
            currency: subscription.currency,
            billing_cycle: subscription.billing_cycle,
            start_date: dateInputValue(subscription.start_date),
            status: subscription.status,
            website_url: subscription.website_url || '',
            notes: subscription.notes || '',
            categoryId: subscription.category?.id.toString() || '',
        });
    };

    const preparePayload = () => {
        const startDate = formData.start_date
            ? new Date(`${formData.start_date}T00:00:00.000Z`)
            : new Date();
        const nextPaymentDate = calculateNextPaymentDate(startDate, formData.billing_cycle);

        return {
            name: formData.name,
            provider: formData.provider || null,
            price_cents: centsFromPrice(formData.price),
            currency: formData.currency,
            billing_cycle: formData.billing_cycle,
            start_date: startDate.toISOString(),
            next_payment_date: nextPaymentDate.toISOString(),
            status: formData.status || 'active',
            website_url: formData.website_url || null,
            notes: formData.notes || null,
            categoryId: formData.categoryId || null,
        };
    };

    const handleAddSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const response = await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preparePayload()),
        });

        if (response.ok) {
            toast.success('Subscription added');
            setAddModalOpen(false);
            resetForm();
            fetchSubscriptions();
        } else {
            toast.error('Failed to add subscription');
        }
    };

    const handleEditSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editingSubscription) return;

        const response = await fetch(`/api/subscriptions/${editingSubscription.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preparePayload()),
        });

        if (response.ok) {
            toast.success('Subscription updated');
            setEditModalOpen(false);
            resetForm();
            fetchSubscriptions();
        } else {
            toast.error('Failed to update subscription');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this subscription?')) return;

        const response = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
        if (response.ok) {
            toast.success('Subscription deleted');
            fetchSubscriptions();
        } else {
            toast.error('Failed to delete subscription');
        }
    };

    const fetchSubscriptionPayments = async (subscriptionId: string) => {
        try {
            const response = await fetch(`/api/subscriptions/${subscriptionId}/payments?includeUpcoming=true&includeOverdue=true`);
            if (!response.ok) throw new Error('Failed to fetch payments');
            const data = await response.json();
            setSelectedSubscriptionPayments(Array.isArray(data.payments) ? data.payments : []);
            setUpcomingPaymentList(Array.isArray(data.upcoming) ? data.upcoming : []);
            setOverduePaymentList(Array.isArray(data.overdue) ? data.overdue : []);
        } catch {
            setSelectedSubscriptionPayments([]);
            setUpcomingPaymentList([]);
            setOverduePaymentList([]);
            toast.error('Failed to fetch payment history');
        }
    };

    const handleViewPayments = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        setPaymentsModalOpen(true);
        fetchSubscriptionPayments(subscription.id);
    };

    const handleMarkPaymentPaid = async (paymentId: string) => {
        const response = await fetch(`/api/subscriptions/payments/${paymentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paid', paymentMethod: 'manual' }),
        });

        if (response.ok) {
            toast.success('Payment marked as paid');
            if (editingSubscription) fetchSubscriptionPayments(editingSubscription.id);
            fetchSubscriptions();
        } else {
            toast.error('Failed to update payment');
        }
    };

    const generateFuturePayments = async () => {
        const response = await fetch('/api/subscriptions/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monthsAhead: 12 }),
        });

        if (response.ok) {
            const data = await response.json();
            toast.success(`Generated ${data.payments?.length || 0} future payments`);
            if (editingSubscription) fetchSubscriptionPayments(editingSubscription.id);
        } else {
            toast.error('Failed to generate payments');
        }
    };

    const migrateExistingPayments = async () => {
        const response = await fetch('/api/admin/migrate-payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
            const data = await response.json();
            toast.success(`Migration completed: ${data.summary.totalPaymentsCreated} payments`);
            fetchSubscriptions();
            if (editingSubscription) fetchSubscriptionPayments(editingSubscription.id);
        } else {
            const errorData = await response.json();
            toast.error(`Migration failed: ${errorData.error}`);
        }
    };

    const toggleCategory = (categoryId: number, checked: boolean) => {
        setSelectedCategoryIds((current) => {
            const next = new Set(current);
            if (checked) {
                next.add(categoryId);
            } else {
                next.delete(categoryId);
            }
            return next;
        });
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
                title="Subscriptions"
                description="Track recurring spend, upcoming charges, and payment history in one compact workspace."
                actions={(
                    <>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline">
                                    <Filter className="h-4 w-4" />
                                    Categories
                                    {selectedCategoryIds.size > 0 && <Badge variant="secondary">{selectedCategoryIds.size}</Badge>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72" align="end">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-medium">Filter categories</p>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedCategoryIds(new Set())}>Clear</Button>
                                    </div>
                                    <div className="max-h-60 space-y-2 overflow-y-auto">
                                        {categories.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No categories yet</p>
                                        ) : categories.map((category) => (
                                            <label key={category.id} className="flex cursor-pointer items-center gap-2 text-sm">
                                                <Checkbox
                                                    checked={selectedCategoryIds.has(category.id)}
                                                    onCheckedChange={(checked) => toggleCategory(category.id, checked === true)}
                                                />
                                                {category.name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Dialog open={addModalOpen} onOpenChange={(open) => {
                            setAddModalOpen(open);
                            if (!open) resetForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4" />
                                    Add Subscription
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Add Subscription</DialogTitle>
                                </DialogHeader>
                                <SubscriptionForm
                                    formData={formData}
                                    setFormData={setFormData}
                                    categoryOptions={categoryOptions}
                                    onSubmit={handleAddSubmit}
                                    onCancel={() => setAddModalOpen(false)}
                                    submitLabel="Add Subscription"
                                />
                            </DialogContent>
                        </Dialog>
                    </>
                )}
            />

            {shouldShowMigrationAlert && (
                <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1 text-sm">
                        <p className="font-medium">Older subscriptions may be missing payment history.</p>
                        <p className="mt-1 text-amber-800">Run migration if you want generated payment records based on start dates and billing cycles.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={migrateExistingPayments}>
                        <RefreshCw className="h-4 w-4" />
                        Migrate
                    </Button>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label="Visible Subscriptions" value={filteredSubscriptions.length.toString()} />
                <MetricTile label="Active" value={activeSubscriptions.length.toString()} tone="income" />
                <MetricTile label="Monthly Estimate" value={formatPaymentAmount(Math.round(totalMonthly * 100), 'USD')} tone="expense" />
                <MetricTile label="Due This Week" value={dueThisWeek.length.toString()} tone={dueThisWeek.length > 0 ? 'expense' : 'neutral'} />
            </div>

            {dueThisWeek.length > 0 && (
                <Card className="rounded-md border-amber-200 bg-amber-50/60">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Calendar className="h-4 w-4" />
                            Upcoming This Week
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 md:grid-cols-2">
                        {dueThisWeek.map((subscription) => (
                            <div key={subscription.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                                <span className="font-medium">{subscription.name}</span>
                                <span className="text-muted-foreground">
                                    {formatPaymentAmount(subscription.price_cents, subscription.currency)} on {formatDateForDisplay(subscription.next_payment_date || '')}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {filteredSubscriptions.length === 0 ? (
                <EmptyState
                    title={subscriptions.length === 0 ? 'No subscriptions yet' : 'No subscriptions match the selected filters'}
                    description={subscriptions.length === 0 ? 'Add recurring services to track future payments.' : 'Clear category filters to see all subscriptions.'}
                />
            ) : (
                <Card className="min-w-0 rounded-md">
                    <CardHeader>
                        <CardTitle>Recurring Ledger</CardTitle>
                        <CardDescription>Table-first view for quick scanning and payment actions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-[920px] table-fixed text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="border-b">
                                        <th className="px-3 py-3 text-left font-medium">Service</th>
                                        <th className="w-40 px-3 py-3 text-left font-medium">Category</th>
                                        <th className="w-32 px-3 py-3 text-right font-medium">Price</th>
                                        <th className="w-32 px-3 py-3 text-left font-medium">Cycle</th>
                                        <th className="w-36 px-3 py-3 text-left font-medium">Next Payment</th>
                                        <th className="w-28 px-3 py-3 text-left font-medium">Status</th>
                                        <th className="w-36 px-3 py-3 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubscriptions.map((subscription) => (
                                        <tr key={subscription.id} className="border-b last:border-0">
                                            <td className="px-3 py-3 align-top">
                                                <div className="min-w-0">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <p className="truncate font-medium">{subscription.name}</p>
                                                        {subscription.website_url && (
                                                            <a
                                                                href={subscription.website_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-muted-foreground hover:text-foreground"
                                                                aria-label={`${subscription.name} website`}
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="truncate text-xs text-muted-foreground">{subscription.provider || subscription.notes || 'No provider'}</p>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 align-top">
                                                <Badge variant="secondary" className="max-w-36 truncate font-normal">
                                                    {subscription.category?.name || 'No category'}
                                                </Badge>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right align-top font-semibold tabular-nums">
                                                {formatPaymentAmount(subscription.price_cents, subscription.currency)}
                                            </td>
                                            <td className="px-3 py-3 align-top capitalize text-muted-foreground">{subscription.billing_cycle}</td>
                                            <td className="whitespace-nowrap px-3 py-3 align-top text-muted-foreground">
                                                {subscription.next_payment_date ? formatDateForDisplay(subscription.next_payment_date) : '-'}
                                            </td>
                                            <td className="px-3 py-3 align-top">{statusBadge(subscription.status)}</td>
                                            <td className="px-3 py-3 align-top">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewPayments(subscription)}
                                                        aria-label={`Payments for ${subscription.name}`}
                                                    >
                                                        <CreditCard className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingSubscription(subscription);
                                                            fillForm(subscription);
                                                            setEditModalOpen(true);
                                                        }}
                                                        aria-label={`Edit ${subscription.name}`}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(subscription.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                        aria-label={`Delete ${subscription.name}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
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

            <Dialog open={editModalOpen} onOpenChange={(open) => {
                setEditModalOpen(open);
                if (!open) resetForm();
            }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Subscription</DialogTitle>
                    </DialogHeader>
                    <SubscriptionForm
                        formData={formData}
                        setFormData={setFormData}
                        categoryOptions={categoryOptions}
                        onSubmit={handleEditSubmit}
                        onCancel={() => setEditModalOpen(false)}
                        submitLabel="Update Subscription"
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={paymentsModalOpen} onOpenChange={(open) => {
                setPaymentsModalOpen(open);
                if (!open) {
                    setSelectedSubscriptionPayments([]);
                    setUpcomingPaymentList([]);
                    setOverduePaymentList([]);
                }
            }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Payment History{editingSubscription ? ` - ${editingSubscription.name}` : ''}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={migrateExistingPayments}>
                                <RefreshCw className="h-4 w-4" />
                                Migrate History
                            </Button>
                            <Button variant="outline" size="sm" onClick={generateFuturePayments}>
                                <Plus className="h-4 w-4" />
                                Generate Future
                            </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <MetricTile label="Paid" value={selectedSubscriptionPayments.filter((payment) => payment.status === 'paid').length.toString()} tone="income" />
                            <MetricTile label="Pending" value={selectedSubscriptionPayments.filter((payment) => payment.status === 'pending').length.toString()} />
                            <MetricTile label="Overdue" value={(overduePaymentList.length + selectedSubscriptionPayments.filter((payment) => payment.status === 'overdue').length).toString()} tone="expense" />
                        </div>

                        {upcomingPaymentList.length > 0 && (
                            <div className="rounded-md border bg-blue-50/40 p-4">
                                <p className="font-medium">Upcoming preview</p>
                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                    {upcomingPaymentList.slice(0, 6).map((payment, index) => (
                                        <div key={`${payment.dueDate}-${index}`} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                                            <span>{formatScheduleDate(payment.dueDate)}</span>
                                            <span className="font-medium">{formatPaymentAmount(payment.amount, payment.currency)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedSubscriptionPayments.length === 0 ? (
                            <EmptyState
                                title="No payment records"
                                description="Generate future payments or migrate older subscriptions to create records."
                            />
                        ) : (
                            <div className="overflow-x-auto rounded-md border">
                                <table className="w-full min-w-[720px] table-fixed text-sm">
                                    <thead className="bg-muted/60">
                                        <tr className="border-b">
                                            <th className="px-3 py-3 text-left font-medium">Due Date</th>
                                            <th className="w-32 px-3 py-3 text-right font-medium">Amount</th>
                                            <th className="w-32 px-3 py-3 text-left font-medium">Status</th>
                                            <th className="w-36 px-3 py-3 text-left font-medium">Paid On</th>
                                            <th className="w-32 px-3 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSubscriptionPayments.map((payment) => (
                                            <tr key={payment.id} className={cn('border-b last:border-0', payment.status === 'overdue' && 'bg-red-50/70')}>
                                                <td className="px-3 py-3 align-top">{formatDateForDisplay(payment.dueDate)}</td>
                                                <td className="whitespace-nowrap px-3 py-3 text-right align-top font-semibold tabular-nums">
                                                    {formatPaymentAmount(payment.amount, payment.currency)}
                                                </td>
                                                <td className="px-3 py-3 align-top">{paymentStatusBadge(payment.status)}</td>
                                                <td className="px-3 py-3 align-top text-muted-foreground">
                                                    {payment.paymentDate ? formatDateForDisplay(payment.paymentDate) : '-'}
                                                </td>
                                                <td className="px-3 py-3 text-right align-top">
                                                    {payment.status === 'pending' ? (
                                                        <Button size="sm" onClick={() => handleMarkPaymentPaid(payment.id)}>
                                                            <CheckCircle className="h-4 w-4" />
                                                            Paid
                                                        </Button>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

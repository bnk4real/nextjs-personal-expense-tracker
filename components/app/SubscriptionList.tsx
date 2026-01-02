'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatDateForDisplay } from '@/lib/format_date';
import { Plus, Edit, Trash2, ExternalLink, Calendar, DollarSign } from 'lucide-react';
import { toast } from "sonner";

interface Subscription {
    id: string;
    name: string;
    provider?: string;
    price_cents: number;
    currency: string;
    billing_cycle: string;
    next_payment_date?: string;
    website_url?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
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

export default function SubscriptionList() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        provider: '',
        price_cents: '',
        currency: 'USD',
        billing_cycle: 'monthly',
        next_payment_date: '',
        website_url: '',
        notes: ''
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

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const handleEdit = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        setFormData({
            name: subscription.name,
            provider: subscription.provider || '',
            price_cents: subscription.price_cents.toString(),
            currency: subscription.currency,
            billing_cycle: subscription.billing_cycle,
            next_payment_date: subscription.next_payment_date ? new Date(subscription.next_payment_date).toISOString().split('T')[0] : '',
            website_url: subscription.website_url || '',
            notes: subscription.notes || ''
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
        const response = await fetch('/api/subscriptions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                price_cents: parseInt(formData.price_cents),
                next_payment_date: formData.next_payment_date || null
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
                next_payment_date: '',
                website_url: '',
                notes: ''
            });
            fetchSubscriptions(); // Refresh list
        } else {
            toast.error("Failed to add subscription");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSubscription) return;

        const response = await fetch(`/api/subscriptions/${editingSubscription.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                price_cents: parseInt(formData.price_cents),
                next_payment_date: formData.next_payment_date || null
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
                next_payment_date: '',
                website_url: '',
                notes: ''
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
            next_payment_date: '',
            website_url: '',
            notes: ''
        });
    };

    const getTotalMonthlyCost = () => {
        return subscriptions.reduce((total, sub) => {
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

    const getUpcomingPayments = () => {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return subscriptions.filter(sub => {
            if (!sub.next_payment_date) return false;
            const paymentDate = new Date(sub.next_payment_date);
            return paymentDate >= now && paymentDate <= nextWeek;
        });
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

    const totalMonthly = getTotalMonthlyCost();
    const upcomingPayments = getUpcomingPayments();

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
                    <p className="text-muted-foreground mt-2">
                        Track and manage your recurring subscriptions
                    </p>
                </div>
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
                                <Label htmlFor="next_payment">Next Payment Date (Optional)</Label>
                                <Input
                                    id="next_payment"
                                    type="date"
                                    value={formData.next_payment_date}
                                    onChange={(e) => setFormData({ ...formData, next_payment_date: e.target.value })}
                                />
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{subscriptions.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Active subscriptions
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
                            {upcomingPayments.map((sub) => (
                                <div key={sub.id} className="flex justify-between items-center">
                                    <span className="font-medium">{sub.name}</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-muted-foreground">
                                            ${(sub.price_cents / 100).toFixed(2)} on {formatDateForDisplay(sub.next_payment_date!)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Subscription List */}
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
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p>Price: ${(subscription.price_cents / 100).toFixed(2)} {subscription.currency}</p>
                                            {subscription.next_payment_date && (
                                                <p>Next Payment: {formatDateForDisplay(subscription.next_payment_date)}</p>
                                            )}
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

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Subscription</DialogTitle>
                    </DialogHeader>
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
                            <Label htmlFor="edit-next_payment">Next Payment Date (Optional)</Label>
                            <Input
                                id="edit-next_payment"
                                type="date"
                                value={formData.next_payment_date}
                                onChange={(e) => setFormData({ ...formData, next_payment_date: e.target.value })}
                            />
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
                </DialogContent>
            </Dialog>
        </div>
    );
}
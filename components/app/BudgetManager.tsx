'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Gauge,
    Pencil,
    Plus,
    ReceiptText,
    Target,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    BudgetCategoryBreakdown,
    BudgetSummary,
    Category,
    MonthlyBudget,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PageHeader } from '@/components/app/WorkspaceUI';

type BudgetResult = {
    budget: MonthlyBudget | null;
    summary: BudgetSummary | null;
    unbudgeted?: {
        spentCents: number;
        transactionCount: number;
        categoryBreakdown: Array<{
            category: string;
            spentCents: number;
        }>;
    } | null;
};

type BudgetHistoryItem = {
    budget: MonthlyBudget;
    summary: BudgetSummary;
};

type LimitDraft = {
    category: string;
    amount: string;
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label: new Date(2026, index, 1).toLocaleDateString('en-US', { month: 'long' }),
}));

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, offset: number) {
    const [year, monthNumber] = month.split('-').map(Number);
    const shifted = new Date(year, monthNumber - 1 + offset, 1);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function monthName(month: string, includeYear = true) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        ...(includeYear ? { year: 'numeric' } : {}),
    });
}

function moneyFromCents(value: number) {
    return (value / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function statusLabel(status: BudgetSummary['status']) {
    if (status === 'over') return 'Over budget';
    if (status === 'near') return 'Near limit';
    return 'On track';
}

function statusClass(status: BudgetSummary['status']) {
    if (status === 'over') return 'border-red-200 bg-red-50 text-red-700';
    if (status === 'near') return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function ProgressBar({ value, status }: { value: number; status: BudgetSummary['status'] }) {
    const color = status === 'over'
        ? 'bg-red-500'
        : status === 'near'
            ? 'bg-amber-500'
            : 'bg-emerald-500';

    return (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
                className={cn('h-full rounded-full transition-[width] duration-300', color)}
                style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
            />
        </div>
    );
}

function Metric({
    label,
    value,
    helper,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    helper: string;
    tone?: 'neutral' | 'good' | 'warning' | 'danger';
}) {
    const color = {
        neutral: 'text-zinc-950',
        good: 'text-emerald-600',
        warning: 'text-amber-600',
        danger: 'text-red-600',
    }[tone];

    return (
        <div className="min-w-0 border-b border-zinc-200 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className={cn('mt-2 truncate text-2xl font-semibold tabular-nums', color)}>{value}</p>
            <p className="mt-1 truncate text-xs text-zinc-500">{helper}</p>
        </div>
    );
}

export default function BudgetManager() {
    const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
    const [result, setResult] = useState<BudgetResult>({ budget: null, summary: null, unbudgeted: null });
    const [history, setHistory] = useState<BudgetHistoryItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [amount, setAmount] = useState('');
    const [warningThreshold, setWarningThreshold] = useState('90');
    const [limits, setLimits] = useState<LimitDraft[]>([]);
    const [newLimitCategory, setNewLimitCategory] = useState('');

    const loadMonth = useCallback(async (month: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/budgets?month=${month}`);
            if (!response.ok) throw new Error('Failed to load budget');
            setResult(await response.json());
        } catch {
            toast.error('Failed to load budget');
            setResult({ budget: null, summary: null, unbudgeted: null });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/budgets');
            if (!response.ok) throw new Error('Failed to load history');
            const data = await response.json();
            setHistory(Array.isArray(data.history) ? data.history : []);
        } catch {
            setHistory([]);
        }
    }, []);

    useEffect(() => {
        loadMonth(selectedMonth);
    }, [loadMonth, selectedMonth]);

    useEffect(() => {
        Promise.all([
            fetch('/api/categories').then((response) => response.json()),
            loadHistory(),
        ]).then(([categoryData]) => {
            setCategories(Array.isArray(categoryData) ? categoryData : []);
        });
    }, [loadHistory]);

    const categoryOptions = useMemo(() => categories
        .filter((category) => !limits.some((limit) => limit.category === category.name))
        .map((category) => ({ value: category.name, label: category.name })), [categories, limits]);

    const budgetAmountCents = Number.isFinite(Number(amount))
        ? Math.max(0, Math.round(Number(amount) * 100))
        : 0;
    const allocatedCents = limits.reduce((total, limit) => {
        const limitAmount = Number(limit.amount);
        return total + (Number.isFinite(limitAmount) && limitAmount > 0
            ? Math.round(limitAmount * 100)
            : 0);
    }, 0);
    const unallocatedCents = budgetAmountCents - allocatedCents;
    const allocationPercent = budgetAmountCents > 0
        ? (allocatedCents / budgetAmountCents) * 100
        : 0;

    const yearOptions = useMemo(() => {
        const selectedYear = Number(selectedMonth.slice(0, 4));
        const currentYear = new Date().getFullYear();
        const historyYears = history.map((item) => Number(item.budget.month.slice(0, 4)));
        const minimumYear = Math.min(currentYear - 5, selectedYear, ...historyYears);
        const maximumYear = Math.max(currentYear + 2, selectedYear, ...historyYears);

        return Array.from({ length: maximumYear - minimumYear + 1 }, (_, index) => {
            const year = String(maximumYear - index);
            return { value: year, label: year };
        });
    }, [history, selectedMonth]);

    const openEditor = (source?: MonthlyBudget | null) => {
        const budget = source === undefined ? result.budget : source;
        setAmount(budget ? (budget.amountCents / 100).toFixed(2) : '');
        setWarningThreshold(String(budget?.warningThreshold || 90));
        setLimits((budget?.categoryLimits || []).map((limit) => ({
            category: limit.category,
            amount: (limit.amountCents / 100).toFixed(2),
        })));
        setNewLimitCategory('');
        setEditorOpen(true);
    };

    const copyPreviousMonth = async () => {
        const previousMonth = shiftMonth(selectedMonth, -1);
        try {
            const response = await fetch(`/api/budgets?month=${previousMonth}`);
            const data: BudgetResult = await response.json();
            if (!response.ok || !data.budget) {
                toast.info(`No budget found for ${monthName(previousMonth)}`);
                return;
            }
            openEditor(data.budget);
        } catch {
            toast.error('Failed to copy the previous budget');
        }
    };

    const addCategoryLimit = () => {
        if (!newLimitCategory) return;
        setLimits((current) => [...current, { category: newLimitCategory, amount: '' }]);
        setNewLimitCategory('');
    };

    const saveBudget = async () => {
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error('Enter a budget greater than zero');
            return;
        }
        if (limits.some((limit) => !Number.isFinite(Number(limit.amount)) || Number(limit.amount) <= 0)) {
            toast.error('Every category limit must be greater than zero');
            return;
        }
        if (allocatedCents > budgetAmountCents) {
            toast.error('Category allocations cannot exceed the monthly budget');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: selectedMonth,
                    amount: parsedAmount,
                    warningThreshold: Number(warningThreshold),
                    categoryLimits: limits.map((limit) => ({
                        category: limit.category,
                        amount: Number(limit.amount),
                    })),
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Failed to save budget');

            setResult(data);
            setEditorOpen(false);
            await loadHistory();
            toast.success(`Budget saved for ${monthName(selectedMonth)}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save budget');
        } finally {
            setSaving(false);
        }
    };

    const deleteBudget = async () => {
        setDeleting(true);
        try {
            const response = await fetch(`/api/budgets?month=${selectedMonth}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Failed to delete budget');

            setDeleteDialogOpen(false);
            await Promise.all([loadMonth(selectedMonth), loadHistory()]);
            toast.success(`Budget deleted for ${monthName(selectedMonth)}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete budget');
        } finally {
            setDeleting(false);
        }
    };

    const budget = result.budget;
    const summary = result.summary;
    const unbudgeted = result.unbudgeted;
    const savedAllocatedCents = budget?.categoryLimits.reduce(
        (total, limit) => total + limit.amountCents,
        0
    ) || 0;
    const previousBudgetExists = history.some(
        (item) => item.budget.month === shiftMonth(selectedMonth, -1)
    );
    const remainingTone = !summary
        ? 'neutral'
        : summary.remainingCents < 0
            ? 'danger'
            : summary.status === 'near'
                ? 'warning'
                : 'good';

    return (
        <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
            <PageHeader
                title="Budget Management"
                description="Set a monthly spending plan, monitor the cap, and review where the money went."
                actions={(budget || previousBudgetExists) ? (
                    <>
                        {previousBudgetExists && (
                            <Button variant="outline" onClick={copyPreviousMonth}>
                                <Copy className="h-4 w-4" />
                                Copy Last Month
                            </Button>
                        )}
                        {budget && (
                            <>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label={`Delete ${monthName(selectedMonth)} budget`}
                                    title="Delete budget"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button onClick={() => openEditor()}>
                                    <Pencil className="h-4 w-4" />
                                    Edit Budget
                                </Button>
                            </>
                        )}
                    </>
                ) : undefined}
            />

            <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2 shadow-xs">
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous month"
                    onClick={() => setSelectedMonth((month) => shiftMonth(month, -1))}
                >
                    <ChevronLeft />
                </Button>
                <div className="flex items-center gap-2">
                    <SearchableSelect
                        value={selectedMonth.slice(5, 7)}
                        onValueChange={(month) => setSelectedMonth(`${selectedMonth.slice(0, 4)}-${month}`)}
                        options={MONTH_OPTIONS}
                        placeholder="Month"
                        searchPlaceholder="Search months..."
                        className="w-36 border-0 bg-transparent font-medium shadow-none"
                    />
                    <SearchableSelect
                        value={selectedMonth.slice(0, 4)}
                        onValueChange={(year) => setSelectedMonth(`${year}-${selectedMonth.slice(5, 7)}`)}
                        options={yearOptions}
                        placeholder="Year"
                        searchPlaceholder="Search years..."
                        className="w-24 border-0 bg-transparent font-medium shadow-none"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next month"
                    onClick={() => setSelectedMonth((month) => shiftMonth(month, 1))}
                >
                    <ChevronRight />
                </Button>
            </div>

            {loading ? (
                <div className="grid min-h-48 place-items-center rounded-md border bg-white text-sm text-zinc-500">
                    Loading {monthName(selectedMonth)}...
                </div>
            ) : !budget || !summary ? (
                <section className="overflow-hidden rounded-md border bg-white shadow-xs">
                    <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                        <div className="flex flex-col justify-between p-6 sm:p-8">
                            <div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700">
                                    <Target className="h-5 w-5" />
                                </div>
                                <p className="mt-5 text-sm font-medium text-zinc-500">{monthName(selectedMonth)} plan</p>
                                <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Set a cap around real spending</h2>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                                    This month already has {unbudgeted?.transactionCount || 0} expense{unbudgeted?.transactionCount === 1 ? '' : 's'}.
                                    Set the budget now and they will be included immediately.
                                </p>
                            </div>

                            <div className="mt-8 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-xs font-medium uppercase text-zinc-400">Spent without a budget</p>
                                    <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-950">
                                        {moneyFromCents(unbudgeted?.spentCents || 0)}
                                    </p>
                                </div>
                                <Button onClick={() => openEditor(null)}>
                                    <Plus />
                                    Set {monthName(selectedMonth, false)} Budget
                                </Button>
                            </div>
                        </div>

                        <div className="border-t bg-zinc-50/70 lg:border-l lg:border-t-0">
                            <div className="border-b px-5 py-4">
                                <p className="font-medium">Spending So Far</p>
                                <p className="mt-1 text-xs text-zinc-500">Largest categories before a plan is set.</p>
                            </div>
                            <div className="divide-y">
                                {(unbudgeted?.categoryBreakdown || []).slice(0, 5).map((category) => (
                                    <div key={category.category} className="flex items-center justify-between gap-4 px-5 py-3.5">
                                        <p className="min-w-0 truncate text-sm">{category.category}</p>
                                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                                            {moneyFromCents(category.spentCents)}
                                        </p>
                                    </div>
                                ))}
                                {!unbudgeted?.categoryBreakdown.length && (
                                    <p className="px-5 py-6 text-sm text-zinc-500">No expenses recorded in this month.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
                <>
                    <section className="grid overflow-hidden rounded-md border bg-white shadow-xs sm:grid-cols-2 xl:grid-cols-4">
                        <Metric
                            label="Monthly Budget"
                            value={moneyFromCents(budget.amountCents)}
                            helper={`Warning starts at ${budget.warningThreshold}%`}
                        />
                        <Metric
                            label="Spent"
                            value={moneyFromCents(summary.spentCents)}
                            helper={`${summary.percentUsed.toFixed(1)}% of the plan`}
                            tone={summary.status === 'over' ? 'danger' : summary.status === 'near' ? 'warning' : 'neutral'}
                        />
                        <Metric
                            label={summary.remainingCents >= 0 ? 'Remaining' : 'Over By'}
                            value={moneyFromCents(Math.abs(summary.remainingCents))}
                            helper={summary.remainingCents >= 0 ? 'Available this month' : 'Beyond the monthly cap'}
                            tone={remainingTone}
                        />
                        <Metric
                            label="Allocated"
                            value={moneyFromCents(savedAllocatedCents)}
                            helper={`${budget.categoryLimits.length} categories · ${moneyFromCents(budget.amountCents - savedAllocatedCents)} flexible`}
                        />
                    </section>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
                        <section className="overflow-hidden rounded-md border bg-white shadow-xs">
                            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Gauge className="h-4 w-4" />
                                        <h2 className="font-semibold">Monthly Progress</h2>
                                    </div>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        Actual expenses posted in {monthName(selectedMonth)}.
                                    </p>
                                </div>
                                <Badge variant="outline" className={statusClass(summary.status)}>
                                    {summary.status === 'on-track' && <Check className="mr-1 h-3.5 w-3.5" />}
                                    {summary.status !== 'on-track' && <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                                    {statusLabel(summary.status)}
                                </Badge>
                            </div>
                            <div className="space-y-5 p-5">
                                <div>
                                    <div className="mb-2 flex items-end justify-between gap-4">
                                        <div>
                                            <p className="text-3xl font-semibold tabular-nums">
                                                {summary.percentUsed.toFixed(1)}%
                                            </p>
                                            <p className="mt-1 text-sm text-zinc-500">of the monthly budget used</p>
                                        </div>
                                        <p className="text-right text-sm tabular-nums text-zinc-600">
                                            {moneyFromCents(summary.spentCents)}
                                            <span className="text-zinc-400"> / {moneyFromCents(budget.amountCents)}</span>
                                        </p>
                                    </div>
                                    <ProgressBar value={summary.percentUsed} status={summary.status} />
                                </div>

                                {summary.status === 'over' ? (
                                    <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <p className="font-medium">The monthly budget is over by {moneyFromCents(Math.abs(summary.remainingCents))}.</p>
                                            <p className="mt-1 text-sm text-red-700">Review the category breakdown to see what drove the overage.</p>
                                        </div>
                                    </div>
                                ) : summary.status === 'near' ? (
                                    <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
                                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <p className="font-medium">{moneyFromCents(summary.remainingCents)} remains before the cap.</p>
                                            <p className="mt-1 text-sm text-amber-800">New expenses will show a warning before they are saved.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                                        <Check className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <p className="font-medium">{moneyFromCents(summary.remainingCents)} remains in the plan.</p>
                                            <p className="mt-1 text-sm text-emerald-700">Spending is still below the warning threshold.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-md border bg-white shadow-xs">
                            <div className="border-b px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <ReceiptText className="h-4 w-4" />
                                    <h2 className="font-semibold">Largest Categories</h2>
                                </div>
                                <p className="mt-1 text-sm text-zinc-500">Top contributors to this month&apos;s spend.</p>
                            </div>
                            <div className="divide-y">
                                {summary.categoryBreakdown.slice(0, 5).map((category) => (
                                    <div key={category.category} className="flex items-center justify-between gap-4 px-5 py-3.5">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{category.category}</p>
                                            <p className="mt-0.5 text-xs text-zinc-500">
                                                {summary.spentCents > 0
                                                    ? `${((category.spentCents / summary.spentCents) * 100).toFixed(1)}% of spending`
                                                    : 'No spending'}
                                            </p>
                                        </div>
                                        <p className="shrink-0 font-semibold tabular-nums">{moneyFromCents(category.spentCents)}</p>
                                    </div>
                                ))}
                                {summary.categoryBreakdown.length === 0 && (
                                    <div className="p-5 text-sm text-zinc-500">No expenses posted this month.</div>
                                )}
                            </div>
                        </section>
                    </div>

                    <CategoryBudgetTable categories={summary.categoryBreakdown} />
                </>
            )}

            {history.length > 0 && (
                <section className="overflow-hidden rounded-md border bg-white shadow-xs">
                    <div className="border-b px-5 py-4">
                        <h2 className="font-semibold">Budget History</h2>
                        <p className="mt-1 text-sm text-zinc-500">Planned versus actual spending for saved monthly budgets.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[680px] text-sm">
                            <thead className="border-b bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                                <tr>
                                    <th className="px-5 py-3">Month</th>
                                    <th className="px-5 py-3 text-right">Budget</th>
                                    <th className="px-5 py-3 text-right">Actual</th>
                                    <th className="px-5 py-3 text-right">Difference</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="w-12 px-5 py-3"><span className="sr-only">Open</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {history.map((item) => (
                                    <tr
                                        key={item.budget.id}
                                        className="cursor-pointer hover:bg-zinc-50"
                                        onClick={() => setSelectedMonth(item.budget.month)}
                                    >
                                        <td className="px-5 py-3.5 font-medium">{monthName(item.budget.month)}</td>
                                        <td className="px-5 py-3.5 text-right tabular-nums">{moneyFromCents(item.budget.amountCents)}</td>
                                        <td className="px-5 py-3.5 text-right tabular-nums">{moneyFromCents(item.summary.spentCents)}</td>
                                        <td className={cn(
                                            'px-5 py-3.5 text-right font-medium tabular-nums',
                                            item.summary.remainingCents < 0 ? 'text-red-600' : 'text-emerald-600'
                                        )}>
                                            {item.summary.remainingCents < 0 ? '-' : '+'}
                                            {moneyFromCents(Math.abs(item.summary.remainingCents))}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <Badge variant="outline" className={statusClass(item.summary.status)}>
                                                {statusLabel(item.summary.status)}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3.5"><ArrowRight className="h-4 w-4 text-zinc-400" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{result.budget ? 'Edit' : 'Set'} {monthName(selectedMonth)} Budget</DialogTitle>
                        <DialogDescription>
                            Set the monthly cap, then allocate any portion of it across spending categories.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="budget-amount">Monthly Budget</Label>
                                <Input
                                    id="budget-amount"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    placeholder="5000.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="budget-warning">Warning Threshold</Label>
                                <div className="relative">
                                    <Input
                                        id="budget-warning"
                                        type="number"
                                        min="50"
                                        max="100"
                                        step="1"
                                        value={warningThreshold}
                                        onChange={(event) => setWarningThreshold(event.target.value)}
                                        className="pr-8"
                                    />
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">%</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 border-t pt-5">
                            <div>
                                <p className="text-sm font-medium">Budget Allocation</p>
                                <p className="mt-1 text-xs text-zinc-500">Optional. Unallocated money remains flexible and every expense still counts toward the monthly total.</p>
                            </div>

                            <div className="overflow-hidden rounded-md border bg-zinc-50">
                                <div className="grid grid-cols-3 divide-x">
                                    <div className="min-w-0 p-3">
                                        <p className="text-xs text-zinc-500">Total</p>
                                        <p className="mt-1 truncate text-sm font-semibold tabular-nums">{moneyFromCents(budgetAmountCents)}</p>
                                    </div>
                                    <div className="min-w-0 p-3">
                                        <p className="text-xs text-zinc-500">Allocated</p>
                                        <p className="mt-1 truncate text-sm font-semibold tabular-nums">{moneyFromCents(allocatedCents)}</p>
                                    </div>
                                    <div className="min-w-0 p-3">
                                        <p className="text-xs text-zinc-500">{unallocatedCents < 0 ? 'Overallocated' : 'Unallocated'}</p>
                                        <p className={cn(
                                            'mt-1 truncate text-sm font-semibold tabular-nums',
                                            unallocatedCents < 0 ? 'text-red-600' : 'text-emerald-600'
                                        )}>
                                            {moneyFromCents(Math.abs(unallocatedCents))}
                                        </p>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-zinc-200">
                                    <div
                                        className={cn('h-full', allocationPercent > 100 ? 'bg-red-500' : 'bg-zinc-900')}
                                        style={{ width: `${Math.min(allocationPercent, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {limits.map((limit, index) => (
                                <div key={limit.category} className="grid grid-cols-[minmax(0,1fr)_140px_36px] items-center gap-2">
                                    <div className="truncate text-sm font-medium">{limit.category}</div>
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={limit.amount}
                                        onChange={(event) => setLimits((current) => current.map((item, itemIndex) => (
                                            itemIndex === index ? { ...item, amount: event.target.value } : item
                                        )))}
                                        placeholder="0.00"
                                        aria-label={`${limit.category} limit`}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Remove ${limit.category} limit`}
                                        onClick={() => setLimits((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            ))}

                            <div className="flex gap-2">
                                <SearchableSelect
                                    value={newLimitCategory}
                                    onValueChange={setNewLimitCategory}
                                    options={categoryOptions}
                                    placeholder="Choose a category"
                                    searchPlaceholder="Search categories..."
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    aria-label="Add category limit"
                                    disabled={!newLimitCategory}
                                    onClick={addCategoryLimit}
                                >
                                    <Plus />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
                        <Button onClick={saveBudget} disabled={saving || allocatedCents > budgetAmountCents}>
                            {saving ? 'Saving...' : 'Save Budget'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete {monthName(selectedMonth)} Budget?</DialogTitle>
                        <DialogDescription>
                            This removes the monthly plan and its category allocations. Existing expenses will not be deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={deleteBudget} disabled={deleting}>
                            <Trash2 />
                            {deleting ? 'Deleting...' : 'Delete Budget'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CategoryBudgetTable({ categories }: { categories: BudgetCategoryBreakdown[] }) {
    return (
        <section className="overflow-hidden rounded-md border bg-white shadow-xs">
            <div className="border-b px-5 py-4">
                <h2 className="font-semibold">Category Breakdown</h2>
                <p className="mt-1 text-sm text-zinc-500">Actual spending and optional category caps for the selected month.</p>
            </div>
            {categories.length === 0 ? (
                <div className="p-5 text-sm text-zinc-500">No category spending to show.</div>
            ) : (
                <div className="divide-y">
                    {categories.map((category) => {
                        const categoryStatus = category.status === 'unlimited' ? 'on-track' : category.status;
                        return (
                            <div key={category.category} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.5fr)_140px_140px] md:items-center">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{category.category}</p>
                                    <p className="mt-0.5 text-xs text-zinc-500">
                                        {category.limitCents === null ? 'No category cap' : `${category.percentUsed?.toFixed(1)}% used`}
                                    </p>
                                </div>
                                <div>
                                    {category.percentUsed === null ? (
                                        <div className="h-2.5 rounded-full bg-zinc-100" />
                                    ) : (
                                        <ProgressBar value={category.percentUsed} status={categoryStatus} />
                                    )}
                                </div>
                                <div className="md:text-right">
                                    <p className="text-xs text-zinc-500">Spent</p>
                                    <p className="mt-0.5 font-semibold tabular-nums">{moneyFromCents(category.spentCents)}</p>
                                </div>
                                <div className="md:text-right">
                                    <p className="text-xs text-zinc-500">{category.limitCents === null ? 'Limit' : category.remainingCents! < 0 ? 'Over by' : 'Remaining'}</p>
                                    <p className={cn(
                                        'mt-0.5 font-semibold tabular-nums',
                                        category.remainingCents !== null && category.remainingCents < 0 && 'text-red-600'
                                    )}>
                                        {category.limitCents === null
                                            ? 'Not set'
                                            : moneyFromCents(Math.abs(category.remainingCents!))}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

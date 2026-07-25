'use client';

import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
    title: string;
    description?: string;
    actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-4 rounded-md border bg-white px-5 py-4 shadow-xs sm:flex-row sm:items-start sm:justify-between">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

type MetricTileProps = {
    label: string;
    value: string;
    tone?: 'neutral' | 'expense' | 'income' | 'transfer';
};

export function MetricTile({ label, value, tone = 'neutral' }: MetricTileProps) {
    const toneClass = {
        neutral: 'text-foreground',
        expense: 'text-red-600',
        income: 'text-green-600',
        transfer: 'text-blue-600',
    }[tone];

    return (
        <Card className="rounded-md bg-white shadow-xs">
            <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={cn('mt-1 text-2xl font-semibold tabular-nums', toneClass)}>{value}</p>
            </CardContent>
        </Card>
    );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
            <p className="font-medium">{title}</p>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
    );
}

export function TransactionTypeBadge({ type }: { type: 'expense' | 'income' | 'transfer' }) {
    const config = {
        expense: { label: 'Expense', className: 'border-red-200 bg-red-50 text-red-700' },
        income: { label: 'Income', className: 'border-green-200 bg-green-50 text-green-700' },
        transfer: { label: 'Transfer', className: 'border-blue-200 bg-blue-50 text-blue-700' },
    }[type];

    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

export function AmountText({ amount, type }: { amount: number; type: 'expense' | 'income' | 'transfer' }) {
    const formatted = amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const className = type === 'expense'
        ? 'text-red-600'
        : type === 'income'
            ? 'text-green-600'
            : 'text-blue-600';
    const prefix = type === 'expense' ? '-' : type === 'income' ? '+' : '';

    return <span className={cn('font-semibold tabular-nums', className)}>{prefix}{formatted}</span>;
}

export function AccountBadge({ children }: { children: ReactNode }) {
    return (
        <Badge variant="secondary" className="max-w-full truncate font-normal">
            {children}
        </Badge>
    );
}

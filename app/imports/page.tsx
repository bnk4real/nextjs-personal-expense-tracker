'use client';

import { useMemo, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Database,
    FileCheck2,
    FileText,
    Loader2,
    RefreshCw,
    Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/app/WorkspaceUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type ImportSummary = {
    files: number;
    parsedTransactions: number;
    skippedParserRows: number;
    skippedTransfers: number;
    duplicateRowsInFiles: number;
    importableTransactions: number;
    expenses: number;
    incomes: number;
    selectedTransactions: number;
    selectedExpenses: number;
    selectedIncomes: number;
    possibleDuplicates: number;
    exactDuplicates: number;
    selectedDuplicates: number;
    latestEndingBalance: number | null;
    latestEndingDate: string | null;
};

type DuplicateStatus = 'new' | 'possible_duplicate' | 'exact_duplicate';

type ExistingMatch = {
    id: number;
    type: 'expense' | 'income';
    date: string;
    amount: number;
    description: string;
    accountName: string | null;
};

type ImportRow = {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'expense' | 'income';
    category: string | null;
    source: string | null;
    fileName: string;
    isTransferLike: boolean;
    duplicateStatus: DuplicateStatus;
    selectedByDefault: boolean;
    existingMatches: ExistingMatch[];
};

type ImportResult = {
    accountId: number;
    createdExpenses: number;
    createdIncomes: number;
    accountBalanceSynced: boolean;
};

type ApiResponse = {
    summary: ImportSummary;
    rows: ImportRow[];
    result?: ImportResult;
    error?: string;
};

type ImportSource = 'bofa' | 'chase';

const IMPORT_SOURCE_OPTIONS = [
    {
        value: 'bofa',
        label: 'Bank of America CSV',
        searchText: 'Bank of America BoFA CSV checking bank',
    },
    {
        value: 'chase',
        label: 'Chase staging CSV',
        searchText: 'Chase staging CSV checking freedom sapphire credit card',
    },
];

const SOURCE_CONFIG = {
    bofa: {
        title: 'Bank of America CSV',
        description: 'Use exported Bank of America CSV files. Balance sync is available for these files.',
        endpoint: '/api/imports/bofa',
        fileLabel: 'BoFA CSV files',
        emptyError: 'Select at least one BoFA CSV file.',
    },
    chase: {
        title: 'Chase staging CSV',
        description: 'Use reviewed Chase staging CSV files made from statement tables.',
        endpoint: '/api/imports/chase',
        fileLabel: 'Chase staging CSV files',
        emptyError: 'Select at least one Chase staging CSV file.',
    },
} satisfies Record<ImportSource, {
    title: string;
    description: string;
    endpoint: string;
    fileLabel: string;
    emptyError: string;
}>;

function money(value: number | null) {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(value: string | null) {
    if (!value) return '-';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function statusBadge(status: DuplicateStatus) {
    if (status === 'exact_duplicate') {
        return <Badge variant="destructive">Duplicate</Badge>;
    }

    if (status === 'possible_duplicate') {
        return <Badge variant="secondary">Review</Badge>;
    }

    return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">New</Badge>;
}

function typeBadge(type: ImportRow['type']) {
    return type === 'expense' ? (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Expense</Badge>
    ) : (
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Income</Badge>
    );
}

function metricClass(tone: 'neutral' | 'expense' | 'income' | 'warning') {
    return {
        neutral: 'text-foreground',
        expense: 'text-red-600',
        income: 'text-green-600',
        warning: 'text-amber-700',
    }[tone];
}

function MetricBlock({
    label,
    value,
    detail,
    tone = 'neutral',
}: {
    label: string;
    value: string | number;
    detail?: string;
    tone?: 'neutral' | 'expense' | 'income' | 'warning';
}) {
    return (
        <div className="rounded-md border bg-background p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn('mt-1 text-2xl font-semibold tabular-nums', metricClass(tone))}>{value}</p>
            {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
    );
}

export default function ImportsPage() {
    const [importSource, setImportSource] = useState<ImportSource>('bofa');
    const [files, setFiles] = useState<File[]>([]);
    const [accountName, setAccountName] = useState('Bank of America');
    const [includeTransfers, setIncludeTransfers] = useState(false);
    const [skipBalanceSync, setSkipBalanceSync] = useState(false);
    const [loading, setLoading] = useState<'preview' | 'import' | null>(null);
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [rows, setRows] = useState<ImportRow[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');

    const sourceConfig = SOURCE_CONFIG[importSource];
    const selectedRows = useMemo(
        () => rows.filter((row) => selectedIds.has(row.id)),
        [rows, selectedIds]
    );
    const selectedExpenses = useMemo(
        () => selectedRows.filter((row) => row.type === 'expense').length,
        [selectedRows]
    );
    const selectedIncomes = selectedRows.length - selectedExpenses;
    const reviewFlags = useMemo(() => {
        if (!summary) return [];

        return [
            {
                label: 'Transfer-like rows skipped',
                value: summary.skippedTransfers,
                active: summary.skippedTransfers > 0,
            },
            {
                label: 'Exact database duplicates',
                value: summary.exactDuplicates,
                active: summary.exactDuplicates > 0,
            },
            {
                label: 'Possible database duplicates',
                value: summary.possibleDuplicates,
                active: summary.possibleDuplicates > 0,
            },
            {
                label: 'Duplicate rows inside files',
                value: summary.duplicateRowsInFiles,
                active: summary.duplicateRowsInFiles > 0,
            },
            {
                label: 'Parser rows skipped',
                value: summary.skippedParserRows,
                active: summary.skippedParserRows > 0,
            },
            {
                label: 'Selected duplicate/review rows',
                value: summary.selectedDuplicates,
                active: summary.selectedDuplicates > 0,
            },
        ];
    }, [summary]);
    const activeReviewFlags = reviewFlags.filter((flag) => flag.active);
    const importDisabled = loading !== null || files.length === 0 || !summary || selectedIds.size === 0;

    const resetPreview = () => {
        setSummary(null);
        setRows([]);
        setSelectedIds(new Set());
        setResult(null);
        setError('');
    };

    const changeImportSource = (source: ImportSource) => {
        setImportSource(source);
        setFiles([]);
        resetPreview();
        if (source === 'bofa') {
            setAccountName('Bank of America');
        }
    };

    const toggleRow = (id: string, checked: boolean) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    };

    const selectNewRows = () => {
        setSelectedIds(new Set(rows.filter((row) => row.duplicateStatus === 'new').map((row) => row.id)));
    };

    const selectNoRows = () => {
        setSelectedIds(new Set());
    };

    const submitImport = async (commit: boolean) => {
        setError('');
        setResult(null);

        if (files.length === 0) {
            setError(sourceConfig.emptyError);
            return;
        }

        if (commit && selectedIds.size === 0) {
            setError('Select at least one row to import.');
            return;
        }

        setLoading(commit ? 'import' : 'preview');

        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        formData.append('accountName', accountName);
        formData.append('accountType', 'Bank Account');
        formData.append('includeTransfers', String(includeTransfers));
        formData.append('skipBalanceSync', String(skipBalanceSync));
        formData.append('commit', String(commit));
        formData.append('selectedImportHashes', JSON.stringify([...selectedIds]));

        try {
            const response = await fetch(sourceConfig.endpoint, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json() as ApiResponse;

            if (!response.ok) {
                setError(data.error || 'Import failed.');
                return;
            }

            setSummary(data.summary);
            setRows(data.rows);
            if (!commit) {
                setSelectedIds(new Set(data.rows.filter((row) => row.selectedByDefault).map((row) => row.id)));
            }
            setResult(data.result || null);
        } catch {
            setError('Import failed.');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
            <PageHeader
                title="Imports"
                description="Preview bank files, review duplicates, then commit only the rows you trust."
                actions={(
                    <>
                        <Button
                            variant="outline"
                            onClick={() => submitImport(false)}
                            disabled={loading !== null || files.length === 0}
                        >
                            {loading === 'preview' ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                            Preview
                        </Button>
                        <Button onClick={() => submitImport(true)} disabled={importDisabled}>
                            {loading === 'import' ? <Loader2 className="animate-spin" /> : <Database />}
                            Import {selectedIds.size > 0 ? selectedIds.size : ''}
                        </Button>
                    </>
                )}
            />

            {error && (
                <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {result && (
                <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 text-green-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="text-sm">
                        <p className="font-medium">
                            Imported {result.createdExpenses} expenses and {result.createdIncomes} incomes.
                        </p>
                        <p className="mt-1 text-green-700">
                            {result.accountBalanceSynced ? 'Account balance was synced from the latest statement.' : 'Account balance was not changed.'}
                            {summary?.selectedDuplicates ? ` ${summary.selectedDuplicates} selected rows were marked as duplicate/review.` : ''}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="rounded-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Source Setup
                        </CardTitle>
                        <CardDescription>{sourceConfig.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label>Import source</Label>
                            <SearchableSelect
                                value={importSource}
                                onValueChange={(value) => changeImportSource(value as ImportSource)}
                                options={IMPORT_SOURCE_OPTIONS}
                                searchPlaceholder="Search sources..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="import-files">{sourceConfig.fileLabel}</Label>
                            <div className="rounded-md border border-dashed bg-muted/30 p-4">
                                <Input
                                    id="import-files"
                                    type="file"
                                    accept=".csv,text/csv"
                                    multiple
                                    className="bg-background"
                                    onChange={(event) => {
                                        setFiles(Array.from(event.target.files || []));
                                        resetPreview();
                                    }}
                                />
                                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'CSV files only'}</span>
                                </div>
                            </div>
                            {files.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {files.map((file) => (
                                        <Badge key={`${file.name}-${file.size}`} variant="secondary" className="max-w-full truncate font-normal">
                                            {file.name}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {importSource === 'bofa' ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="account-name">Account name</Label>
                                    <Input
                                        id="account-name"
                                        value={accountName}
                                        onChange={(event) => {
                                            setAccountName(event.target.value);
                                            resetPreview();
                                        }}
                                    />
                                </div>

                                <div className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <Label htmlFor="include-transfers">Include transfer-like rows</Label>
                                            <p className="mt-1 text-sm text-muted-foreground">Useful for auditing, but keep them unchecked before import.</p>
                                        </div>
                                        <Switch
                                            id="include-transfers"
                                            checked={includeTransfers}
                                            onCheckedChange={(checked) => {
                                                setIncludeTransfers(checked);
                                                resetPreview();
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <Label htmlFor="skip-balance-sync">Skip balance sync</Label>
                                            <p className="mt-1 text-sm text-muted-foreground">Keep the current account balance unchanged.</p>
                                        </div>
                                        <Switch
                                            id="skip-balance-sync"
                                            checked={skipBalanceSync}
                                            onCheckedChange={(checked) => {
                                                setSkipBalanceSync(checked);
                                                setResult(null);
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                                Chase staging rows carry their own account mapping. Payments, transfers, and Zelle rows stay review-only unless explicitly selected by the parser.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid min-w-0 grid-cols-1 gap-6">
                    <Card className="rounded-md">
                        <CardHeader>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <CardTitle>Review Summary</CardTitle>
                                    <CardDescription>Preview totals update before anything is written to the database.</CardDescription>
                                </div>
                                {summary && (
                                    <Badge variant="outline" className="w-fit">
                                        {summary.files} file{summary.files === 1 ? '' : 's'} parsed
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {summary ? (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                        <MetricBlock label="Parsed Rows" value={summary.parsedTransactions} />
                                        <MetricBlock label="Importable" value={summary.importableTransactions} />
                                        <MetricBlock label="Expenses" value={summary.expenses} tone="expense" />
                                        <MetricBlock label="Incomes" value={summary.incomes} tone="income" />
                                        <MetricBlock
                                            label="Selected"
                                            value={selectedRows.length}
                                            detail={`${selectedExpenses} expenses, ${selectedIncomes} incomes`}
                                        />
                                        <MetricBlock
                                            label="Skipped Transfers"
                                            value={summary.skippedTransfers}
                                            tone={summary.skippedTransfers > 0 ? 'warning' : 'neutral'}
                                        />
                                        <MetricBlock
                                            label="DB Duplicates"
                                            value={summary.exactDuplicates + summary.possibleDuplicates}
                                            detail={`${summary.exactDuplicates} exact, ${summary.possibleDuplicates} possible`}
                                            tone={summary.exactDuplicates + summary.possibleDuplicates > 0 ? 'warning' : 'neutral'}
                                        />
                                        <MetricBlock
                                            label="Latest Balance"
                                            value={money(summary.latestEndingBalance)}
                                            detail={formatDate(summary.latestEndingDate)}
                                        />
                                    </div>

                                    <div className="rounded-md border bg-muted/20 p-4">
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                            <p className="font-medium">Review flags</p>
                                        </div>
                                        {activeReviewFlags.length > 0 ? (
                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                {activeReviewFlags.map((flag) => (
                                                    <div key={flag.label} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                                                        <span className="text-sm text-muted-foreground">{flag.label}</span>
                                                        <Badge variant="secondary">{flag.value}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-2 text-sm text-muted-foreground">No duplicate, transfer, or parser warnings in this preview.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                                    <FileCheck2 className="h-8 w-8 text-muted-foreground" />
                                    <p className="mt-3 font-medium">No preview yet</p>
                                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                        Select CSV files and run Preview before importing. Nothing is saved until you press Import.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card className="min-w-0 rounded-md">
                <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <CardTitle>Preview Rows</CardTitle>
                            <CardDescription>
                                First 200 importable rows. New rows are selected by default, duplicates need review.
                            </CardDescription>
                        </div>
                        {rows.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={selectNewRows}>
                                    Select New
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={selectNoRows}>
                                    Clear
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {rows.length > 0 ? (
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-[920px] table-fixed text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="border-b">
                                        <th className="w-16 px-3 py-3 text-left font-medium">Import</th>
                                        <th className="w-28 px-3 py-3 text-left font-medium">Date</th>
                                        <th className="px-3 py-3 text-left font-medium">Description</th>
                                        <th className="w-32 px-3 py-3 text-right font-medium">Amount</th>
                                        <th className="w-28 px-3 py-3 text-left font-medium">Type</th>
                                        <th className="w-32 px-3 py-3 text-left font-medium">Status</th>
                                        <th className="w-40 px-3 py-3 text-left font-medium">Category</th>
                                        <th className="w-44 px-3 py-3 text-left font-medium">File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className={cn(
                                                'border-b last:border-0',
                                                row.duplicateStatus === 'possible_duplicate' && 'bg-amber-50/70',
                                                row.duplicateStatus === 'exact_duplicate' && 'bg-red-50/70'
                                            )}
                                        >
                                            <td className="px-3 py-3 align-top">
                                                <Checkbox
                                                    checked={selectedIds.has(row.id)}
                                                    onCheckedChange={(checked) => toggleRow(row.id, checked === true)}
                                                    aria-label={`Import ${row.description}`}
                                                />
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums">{row.date}</td>
                                            <td className="px-3 py-3 align-top">
                                                <div className="min-w-0">
                                                    <p className="break-words font-medium">{row.description}</p>
                                                    {row.existingMatches.length > 0 && (
                                                        <p className="mt-1 break-words text-xs text-amber-800">
                                                            Matches existing {row.existingMatches[0].type} #{row.existingMatches[0].id}: {row.existingMatches[0].description}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={cn(
                                                'whitespace-nowrap px-3 py-3 text-right align-top font-semibold tabular-nums',
                                                row.type === 'expense' ? 'text-red-600' : 'text-green-600'
                                            )}>
                                                {money(row.amount)}
                                            </td>
                                            <td className="px-3 py-3 align-top">{typeBadge(row.type)}</td>
                                            <td className="px-3 py-3 align-top">{statusBadge(row.duplicateStatus)}</td>
                                            <td className="px-3 py-3 align-top">
                                                <span className="line-clamp-2 text-muted-foreground">{row.category || row.source || '-'}</span>
                                            </td>
                                            <td className="px-3 py-3 align-top">
                                                <span className="line-clamp-2 text-muted-foreground">{row.fileName}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                            <Database className="h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 font-medium">No rows to review</p>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                Preview results will appear here with selection controls before import.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

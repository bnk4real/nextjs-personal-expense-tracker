'use client';

import { useMemo, useState } from 'react';
import { Upload, FileCheck2, Loader2, Database, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

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

function money(value: number | null) {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
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

    const selectedFileNames = useMemo(() => files.map((file) => file.name).join(', '), [files]);
    const sourceConfig = importSource === 'bofa'
        ? {
            title: 'Bank of America CSV',
            description: 'Select exported BoFA CSV files',
            endpoint: '/api/imports/bofa',
            fileLabel: 'BoFA CSV Files',
            emptyError: 'Select at least one BoFA CSV file.',
        }
        : {
            title: 'Chase Staging CSV',
            description: 'Select Chase staging CSV files created from reviewed tables',
            endpoint: '/api/imports/chase',
            fileLabel: 'Chase Staging CSV Files',
            emptyError: 'Select at least one Chase staging CSV file.',
        };
    const selectedRows = useMemo(
        () => rows.filter((row) => selectedIds.has(row.id)),
        [rows, selectedIds]
    );

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
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Imports</h1>
                    <p className="text-muted-foreground mt-2">{sourceConfig.title}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => submitImport(false)} disabled={loading !== null || files.length === 0}>
                        {loading === 'preview' ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                        Preview
                    </Button>
                    <Button onClick={() => submitImport(true)} disabled={loading !== null || files.length === 0 || !summary || selectedIds.size === 0}>
                        {loading === 'import' ? <Loader2 className="animate-spin" /> : <Database />}
                        Import {selectedIds.size > 0 ? selectedIds.size : ''}
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 flex items-center gap-2 text-red-700">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                    </CardContent>
                </Card>
            )}

            {result && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4 text-green-800">
                        Imported {result.createdExpenses} expenses and {result.createdIncomes} incomes.
                        {summary?.selectedDuplicates ? ` ${summary.selectedDuplicates} selected rows were marked as duplicates/review.` : ''}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5" />
                            Source
                        </CardTitle>
                        <CardDescription>{sourceConfig.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant={importSource === 'bofa' ? 'default' : 'outline'}
                                onClick={() => changeImportSource('bofa')}
                            >
                                BoFA
                            </Button>
                            <Button
                                type="button"
                                variant={importSource === 'chase' ? 'default' : 'outline'}
                                onClick={() => changeImportSource('chase')}
                            >
                                Chase
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="import-files">{sourceConfig.fileLabel}</Label>
                            <Input
                                id="import-files"
                                type="file"
                                accept=".csv,text/csv"
                                multiple
                                onChange={(event) => {
                                    setFiles(Array.from(event.target.files || []));
                                    resetPreview();
                                }}
                            />
                            {selectedFileNames && (
                                <p className="text-sm text-muted-foreground break-words">{selectedFileNames}</p>
                            )}
                        </div>

                        {importSource === 'bofa' ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="account-name">Account Name</Label>
                                    <Input
                                        id="account-name"
                                        value={accountName}
                                        onChange={(event) => {
                                            setAccountName(event.target.value);
                                            resetPreview();
                                        }}
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                    <div>
                                        <Label htmlFor="include-transfers">Include Transfers</Label>
                                        <p className="text-sm text-muted-foreground">Zelle and payment-like rows</p>
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

                                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                    <div>
                                        <Label htmlFor="skip-balance-sync">Skip Balance Sync</Label>
                                        <p className="text-sm text-muted-foreground">Keep current account balance</p>
                                    </div>
                                    <Switch id="skip-balance-sync" checked={skipBalanceSync} onCheckedChange={setSkipBalanceSync} />
                                </div>
                            </>
                        ) : (
                            <div className="rounded-md border p-3 text-sm text-muted-foreground">
                                Chase staging CSVs already include account mapping and review defaults. Rows marked review are shown but not selected automatically.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                        <CardDescription>Preview totals before importing</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {summary ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="rounded-md border p-3">
                                    <p className="text-sm text-muted-foreground">Files</p>
                                    <p className="text-2xl font-bold">{summary.files}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-sm text-muted-foreground">Transactions</p>
                                    <p className="text-2xl font-bold">{summary.importableTransactions}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-sm text-muted-foreground">Expenses</p>
                                    <p className="text-2xl font-bold text-red-600">{summary.expenses}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-sm text-muted-foreground">Incomes</p>
                                    <p className="text-2xl font-bold text-green-600">{summary.incomes}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-sm text-muted-foreground">Transfers Skipped</p>
                                    <p className="text-2xl font-bold">{summary.skippedTransfers}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-sm text-muted-foreground">Duplicates</p>
                                    <p className="text-2xl font-bold">{summary.exactDuplicates + summary.possibleDuplicates}</p>
                                    <p className="text-xs text-muted-foreground">{summary.duplicateRowsInFiles} in files</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-sm text-muted-foreground">Selected</p>
                                    <p className="text-2xl font-bold">{selectedRows.length}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {selectedRows.filter((row) => row.type === 'expense').length} expenses, {selectedRows.filter((row) => row.type === 'income').length} incomes
                                    </p>
                                </div>
                                <div className="rounded-md border p-3 md:col-span-2">
                                    <p className="text-sm text-muted-foreground">Latest Ending Balance</p>
                                    <p className="text-2xl font-bold">{money(summary.latestEndingBalance)}</p>
                                    <p className="text-sm text-muted-foreground">{summary.latestEndingDate || '-'}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-muted-foreground border rounded-md">
                                No preview yet
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <CardTitle>Preview</CardTitle>
                            <CardDescription>First 200 importable rows. New rows are selected by default.</CardDescription>
                        </div>
                        {rows.length > 0 && (
                            <div className="flex gap-2">
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
                        <div className="overflow-x-auto border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="border-b">
                                        <th className="text-left p-3 font-medium">Import</th>
                                        <th className="text-left p-3 font-medium">Date</th>
                                        <th className="text-left p-3 font-medium">Description</th>
                                        <th className="text-right p-3 font-medium">Amount</th>
                                        <th className="text-left p-3 font-medium">Type</th>
                                        <th className="text-left p-3 font-medium">Status</th>
                                        <th className="text-left p-3 font-medium">Category</th>
                                        <th className="text-left p-3 font-medium">File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id} className={`border-b last:border-0 ${row.duplicateStatus !== 'new' ? 'bg-yellow-50' : ''}`}>
                                            <td className="p-3">
                                                <Checkbox
                                                    checked={selectedIds.has(row.id)}
                                                    onCheckedChange={(checked) => toggleRow(row.id, checked === true)}
                                                />
                                            </td>
                                            <td className="p-3 whitespace-nowrap">{row.date}</td>
                                            <td className="p-3 min-w-80">
                                                <div>{row.description}</div>
                                                {row.existingMatches.length > 0 && (
                                                    <div className="mt-1 text-xs text-yellow-800">
                                                        Matches existing {row.existingMatches[0].type} #{row.existingMatches[0].id}: {row.existingMatches[0].description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`p-3 text-right font-medium ${row.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {money(row.amount)}
                                            </td>
                                            <td className="p-3">
                                                <Badge variant={row.type === 'expense' ? 'destructive' : 'secondary'}>
                                                    {row.type}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                {row.duplicateStatus === 'new' ? (
                                                    <Badge variant="outline">new</Badge>
                                                ) : row.duplicateStatus === 'exact_duplicate' ? (
                                                    <Badge variant="destructive">duplicate</Badge>
                                                ) : (
                                                    <Badge variant="secondary">review</Badge>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">{row.category || row.source || '-'}</td>
                                            <td className="p-3 whitespace-nowrap text-muted-foreground">{row.fileName}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-muted-foreground border rounded-md">
                            No rows to show
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

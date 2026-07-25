'use client';

import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Download, FileText, Loader2, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmptyState, MetricTile, PageHeader } from '@/components/app/WorkspaceUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Transaction {
    id: string;
    amount: number;
    description: string;
    date: string;
    category?: string;
    account?: string;
}

interface UserData {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
}

const reportTypeOptions = [
    { value: 'expenses', label: 'Expense Report' },
    { value: 'incomes', label: 'Income Report' },
];

function startOfCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getUserFromCookies(): UserData | null {
    if (typeof window === 'undefined') return null;

    const token = document.cookie
        .split('; ')
        .find((item) => item.startsWith('token='))
        ?.split('=')[1];

    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
            username: payload.username,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
        };
    } catch {
        return null;
    }
}

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function ReportsPage() {
    const [startDate, setStartDate] = useState<Date>(() => startOfCurrentMonth());
    const [endDate, setEndDate] = useState<Date>(() => new Date());
    const [reportType, setReportType] = useState<string>('expenses');
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [hasPreviewed, setHasPreviewed] = useState(false);

    const user = getUserFromCookies();
    const reportTypeLabel = reportType === 'incomes' ? 'Income Report' : 'Expense Report';
    const total = useMemo(
        () => transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
        [transactions]
    );
    const average = transactions.length > 0 ? total / transactions.length : 0;

    const fetchTransactions = useCallback(async () => {
        if (!startDate || !endDate || !reportType) {
            toast.error('Select a date range and report type first');
            return [];
        }

        setLoadingPreview(true);
        try {
            const response = await fetch(
                `/api/reports?type=${reportType}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch report data');
            }

            const data = await response.json();
            const rows = Array.isArray(data.transactions) ? data.transactions : [];
            setTransactions(rows);
            setHasPreviewed(true);
            return rows as Transaction[];
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to fetch report data');
            setTransactions([]);
            setHasPreviewed(true);
            return [];
        } finally {
            setLoadingPreview(false);
        }
    }, [endDate, reportType, startDate]);

    const generatePDF = useCallback(async () => {
        if (!startDate || !endDate || !reportType) {
            toast.error('Select a date range and report type first');
            return;
        }

        setIsGenerating(true);

        try {
            const rows = transactions.length > 0 || hasPreviewed ? transactions : await fetchTransactions();

            if (rows.length === 0) {
                toast.error('No transactions found for this report');
                return;
            }

            const doc = new jsPDF();
            const owner = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Expense Tracker User';

            doc.setFontSize(20);
            doc.text('Expense Tracker Report', 20, 30);
            doc.setFontSize(12);
            doc.text(`Account Owner: ${owner}`, 20, 50);
            doc.text(`Report Date: ${format(new Date(), 'MMMM dd, yyyy')}`, 20, 60);
            doc.text(`Report Type: ${reportTypeLabel}`, 20, 70);
            doc.text(`Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`, 20, 80);

            autoTable(doc, {
                head: [['Date', 'Description', 'Category/Source', 'Account', 'Amount']],
                body: rows.map((transaction) => [
                    format(new Date(`${transaction.date}T00:00:00`), 'MMM dd, yyyy'),
                    transaction.description,
                    transaction.category || 'N/A',
                    transaction.account || 'N/A',
                    money(Math.abs(transaction.amount)),
                ]),
                startY: 90,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [24, 24, 27], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 245, 245] },
            });

            const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 90;
            doc.setFont('helvetica', 'bold');
            doc.text(`Total ${reportTypeLabel}: ${money(Math.abs(total))}`, 20, finalY + 18);

            const pageCount = doc.getNumberOfPages();
            for (let page = 1; page <= pageCount; page += 1) {
                doc.setPage(page);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text('Expense Tracker', 20, doc.internal.pageSize.height - 18);
                doc.text(`Generated on ${format(new Date(), 'MMM dd, yyyy')}`, 20, doc.internal.pageSize.height - 12);
                doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 12);
            }

            const fileName = `${reportTypeLabel.toLowerCase().replace(' ', '_')}_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.pdf`;
            doc.save(fileName);
            toast.success('PDF report generated');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to generate PDF');
        } finally {
            setIsGenerating(false);
        }
    }, [endDate, fetchTransactions, hasPreviewed, reportType, reportTypeLabel, startDate, total, transactions, user]);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
            <PageHeader
                title="Reports"
                description="Preview real transaction data, then export clean PDF reports."
                actions={(
                    <>
                        <Button variant="outline" onClick={fetchTransactions} disabled={loadingPreview || isGenerating}>
                            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Preview
                        </Button>
                        <Button onClick={generatePDF} disabled={loadingPreview || isGenerating}>
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export PDF
                        </Button>
                    </>
                )}
            />

            <Card className="rounded-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Report Builder
                    </CardTitle>
                    <CardDescription>Pick a range and verify the rows before creating a file.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Start date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>End date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Report type</Label>
                            <SearchableSelect
                                value={reportType}
                                onValueChange={setReportType}
                                options={reportTypeOptions}
                                searchPlaceholder="Search report types..."
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
                <MetricTile label="Rows" value={transactions.length.toString()} />
                <MetricTile label="Total" value={money(Math.abs(total))} tone={reportType === 'incomes' ? 'income' : 'expense'} />
                <MetricTile label="Average" value={money(Math.abs(average))} />
            </div>

            <Card className="min-w-0 rounded-md">
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle>Preview Rows</CardTitle>
                            <CardDescription>{reportTypeLabel} for {format(startDate, 'MMM d, yyyy')} to {format(endDate, 'MMM d, yyyy')}</CardDescription>
                        </div>
                        {hasPreviewed && <Badge variant="outline">{transactions.length} row{transactions.length === 1 ? '' : 's'}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    {transactions.length === 0 ? (
                        <EmptyState
                            title={hasPreviewed ? 'No transactions found' : 'No report preview yet'}
                            description={hasPreviewed ? 'Try a wider date range or another report type.' : 'Run Preview to fetch report rows from the database.'}
                        />
                    ) : (
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-[760px] table-fixed text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="border-b">
                                        <th className="w-28 px-3 py-3 text-left font-medium">Date</th>
                                        <th className="px-3 py-3 text-left font-medium">Description</th>
                                        <th className="w-40 px-3 py-3 text-left font-medium">Category/Source</th>
                                        <th className="w-40 px-3 py-3 text-left font-medium">Account</th>
                                        <th className="w-32 px-3 py-3 text-right font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((transaction) => (
                                        <tr key={transaction.id} className="border-b last:border-0">
                                            <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums">{transaction.date}</td>
                                            <td className="px-3 py-3 align-top">
                                                <p className="break-words font-medium">{transaction.description}</p>
                                            </td>
                                            <td className="px-3 py-3 align-top text-muted-foreground">{transaction.category || '-'}</td>
                                            <td className="px-3 py-3 align-top text-muted-foreground">{transaction.account || '-'}</td>
                                            <td className={cn(
                                                'whitespace-nowrap px-3 py-3 text-right align-top font-semibold tabular-nums',
                                                reportType === 'incomes' ? 'text-green-600' : 'text-red-600'
                                            )}>
                                                {money(Math.abs(transaction.amount))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

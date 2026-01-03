'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: {
            head: string[][];
            body: (string | number)[][];
            startY: number;
            theme: string;
            styles: {
                fontSize: number;
                cellPadding: number;
            };
            headStyles: {
                fillColor: number[];
                textColor: number;
            };
            alternateRowStyles: {
                fillColor: number[];
            };
        }) => jsPDF;
        lastAutoTable: {
            finalY: number;
        };
    }
}

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

// Function to get user data from cookies
const getUserFromCookies = (): UserData | null => {
    if (typeof window === 'undefined') return null;

    const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
    };

    const token = getCookie('token');
    if (token) {
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
    return null;
};

export default function ReportsPage() {
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [reportType, setReportType] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const user = getUserFromCookies();

    // Mock data - in real app, this would come from API
    const mockTransactions: Transaction[] = useMemo(() => [
        { id: '1', amount: 2500.00, description: 'Salary', date: '2024-01-15', category: 'Income', account: 'Checking' },
        { id: '2', amount: -150.00, description: 'Groceries', date: '2024-01-16', category: 'Food', account: 'Credit Card' },
        { id: '3', amount: -75.00, description: 'Gas', date: '2024-01-17', category: 'Transportation', account: 'Credit Card' },
        { id: '4', amount: 500.00, description: 'Freelance Work', date: '2024-01-20', category: 'Income', account: 'Checking' },
        { id: '5', amount: -200.00, description: 'Rent', date: '2024-01-01', category: 'Housing', account: 'Checking' },
    ], []);

    const fetchTransactions = useCallback(async (type: string, start: Date, end: Date) => {
        try {
            const response = await fetch(
                `/api/reports?type=${type}&startDate=${start.toISOString().split('T')[0]}&endDate=${end.toISOString().split('T')[0]}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch transactions');
            }

            const data = await response.json();
            setTransactions(data.transactions);
            return data.transactions;
        } catch {
            // Fallback to mock data
            const filtered = mockTransactions.filter(transaction => {
                const transactionDate = new Date(transaction.date);
                const isInDateRange = transactionDate >= start && transactionDate <= end;

                if (type === 'incomes') {
                    return isInDateRange && transaction.amount > 0;
                } else if (type === 'expenses') {
                    return isInDateRange && transaction.amount < 0;
                }

                return isInDateRange;
            });

            setTransactions(filtered);
            return filtered;
        }
    }, [mockTransactions]);

    const generatePDF = useCallback(async () => {
        if (!startDate || !endDate || !reportType || !user) {
            const missingFields = [];
            if (!startDate) missingFields.push('start date');
            if (!endDate) missingFields.push('end date');
            if (!reportType) missingFields.push('report type');
            if (!user) missingFields.push('user information');

            alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
            return;
        }

        setIsGenerating(true);

        try {
            const data = await fetchTransactions(reportType, startDate, endDate);

            if (!data || data.length === 0) {
                alert('No transactions found for the selected period.');
                setIsGenerating(false);
                return;
            }

            // Validate data structure
            const invalidTransactions = data.filter((t: Transaction) =>
                !t.date || !t.description || typeof t.amount !== 'number'
            );
            if (invalidTransactions.length > 0) {
                alert('Some transactions have invalid data. Please check the transaction records.');
                setIsGenerating(false);
                return;
            }

            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.text('Expense Tracker Report', 20, 30);

            // Account Owner
            doc.setFontSize(12);
            doc.text(`Account Owner: ${user.firstName} ${user.lastName}`, 20, 50);

            // Report Date
            doc.text(`Report Date: ${format(new Date(), 'MMMM dd, yyyy')}`, 20, 60);

            // Report Type
            const reportTypeLabel = reportType === 'incomes' ? 'Income Report' : 'Expense Report';
            doc.text(`Report Type: ${reportTypeLabel}`, 20, 70);

            // Date Range
            doc.text(`Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`, 20, 80);

            // Transactions Table
            const tableData = data.map((transaction: Transaction) => {
                try {
                    const formattedDate = format(new Date(transaction.date), 'MMM dd, yyyy');
                    return [
                        formattedDate,
                        transaction.description,
                        transaction.category || 'N/A',
                        transaction.account || 'N/A',
                        `$${Math.abs(transaction.amount).toFixed(2)}`
                    ];
                } catch {
                    return [
                        transaction.date, // fallback to original date string
                        transaction.description,
                        transaction.category || 'N/A',
                        transaction.account || 'N/A',
                        `$${Math.abs(transaction.amount).toFixed(2)}`
                    ];
                }
            });

            // Calculate totals
            const total = data.reduce((sum: number, transaction: Transaction) => sum + transaction.amount, 0);

            // Add table
            if (typeof autoTable !== 'function') {
                throw new Error('autoTable function not available. PDF generation library may not be properly loaded.');
            }

            autoTable(doc, {
                head: [['Date', 'Description', 'Category', 'Account', 'Amount']],
                body: tableData,
                startY: 90,
                theme: 'grid',
                styles: {
                    fontSize: 10,
                    cellPadding: 3,
                },
                headStyles: {
                    fillColor: [41, 128, 185],
                    textColor: 255,
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245],
                },
            });

            // Add total
            const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
                ? (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 20
                : 200;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`Total ${reportTypeLabel}: $${Math.abs(total).toFixed(2)}`, 20, finalY);

            // Footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text('Expense Tracker', 20, doc.internal.pageSize.height - 20);
                doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy')}`, 20, doc.internal.pageSize.height - 15);
                doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 15);
            }

            // Save the PDF
            const fileName = `${reportTypeLabel.toLowerCase().replace(' ', '_')}_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.pdf`;
            doc.save(fileName);

        } catch (_error) {
            alert(`Error generating report: ${_error instanceof Error ? _error.message : 'Unknown error'}. Please try again.`);
        } finally {
            setIsGenerating(false);
        }
    }, [startDate, endDate, reportType, user, fetchTransactions]);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
                    <p className="text-gray-600">Generate PDF reports for your financial transactions</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Generate Report
                        </CardTitle>
                        <CardDescription>
                            Select the date range and report type to generate a PDF report
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Date Range Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start-date">Start Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "PPP") : "Pick a date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={setStartDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="end-date">End Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "PPP") : "Pick a date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Report Type Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="report-type">Report Type</Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select report type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="incomes">Income Report</SelectItem>
                                    <SelectItem value="expenses">Expense Report</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Generate Button */}
                        <Button
                            onClick={generatePDF}
                            disabled={!startDate || !endDate || !reportType || isGenerating}
                            className="w-full"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {isGenerating ? 'Generating...' : 'Generate PDF Report'}
                        </Button>

                        {/* Test PDF Button */}
                        {/* <Button
                            onClick={async () => {
                                try {
                                    const doc = new jsPDF();
                                    doc.text('Test PDF', 20, 30);
                                    doc.save('test.pdf');
                                } catch (error) {
                                    alert('Test PDF failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                                }
                            }}
                            variant="outline"
                            className="w-full mt-2"
                        >
                            Test PDF Generation
                        </Button> */}

                        {/* Preview Info */}
                        {transactions.length > 0 && (
                            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold mb-2">Report Preview</h3>
                                <p className="text-sm text-gray-600">
                                    Found {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} for the selected period.
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    Total: ${transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, MapPin, Info } from 'lucide-react';

interface StateTaxInfo {
    state: string;
    code: string;
    incomeTax: {
        brackets: Array<{
            min: number;
            max: number | null;
            rate: number;
        }>;
        standardDeduction: {
            single: number;
            married: number;
        };
    };
    salesTax: number;
    propertyTax: number;
}

const stateTaxData: StateTaxInfo[] = [
    {
        state: 'California',
        code: 'CA',
        incomeTax: {
            brackets: [
                { min: 0, max: 10099, rate: 0.01 },
                { min: 10099, max: 23942, rate: 0.02 },
                { min: 23942, max: 37788, rate: 0.04 },
                { min: 37788, max: 52455, rate: 0.06 },
                { min: 52455, max: 66295, rate: 0.08 },
                { min: 66295, max: 349137, rate: 0.09 },
                { min: 349137, max: 698274, rate: 0.10 },
                { min: 698274, max: null, rate: 0.11 }
            ],
            standardDeduction: { single: 5202, married: 10404 }
        },
        salesTax: 0.0725,
        propertyTax: 0.0076
    },
    {
        state: 'Texas',
        code: 'TX',
        incomeTax: {
            brackets: [], // No state income tax
            standardDeduction: { single: 0, married: 0 }
        },
        salesTax: 0.0625,
        propertyTax: 0.0181
    },
    {
        state: 'New York',
        code: 'NY',
        incomeTax: {
            brackets: [
                { min: 0, max: 8500, rate: 0.04 },
                { min: 8500, max: 11700, rate: 0.045 },
                { min: 11700, max: 13900, rate: 0.0525 },
                { min: 13900, max: 21400, rate: 0.059 },
                { min: 21400, max: 80650, rate: 0.0597 },
                { min: 80650, max: 215400, rate: 0.0633 },
                { min: 215400, max: 1077550, rate: 0.0657 },
                { min: 1077550, max: null, rate: 0.0685 }
            ],
            standardDeduction: { single: 8000, married: 16050 }
        },
        salesTax: 0.04,
        propertyTax: 0.0143
    },
    {
        state: 'Florida',
        code: 'FL',
        incomeTax: {
            brackets: [], // No state income tax
            standardDeduction: { single: 0, married: 0 }
        },
        salesTax: 0.06,
        propertyTax: 0.0089
    },
    {
        state: 'Illinois',
        code: 'IL',
        incomeTax: {
            brackets: [
                { min: 0, max: 10000, rate: 0.045 },
                { min: 10000, max: 20000, rate: 0.048 },
                { min: 20000, max: 100000, rate: 0.053 },
                { min: 100000, max: 250000, rate: 0.062 },
                { min: 250000, max: null, rate: 0.0695 }
            ],
            standardDeduction: { single: 0, married: 0 }
        },
        salesTax: 0.0625,
        propertyTax: 0.0221
    },
    {
        state: 'Massachusetts',
        code: 'MA',
        incomeTax: {
            brackets: [
                { min: 0, max: 1000000, rate: 0.05 },
                { min: 1000000, max: null, rate: 0.053 }
            ],
            standardDeduction: { single: 0, married: 0 }
        },
        salesTax: 0.0625,
        propertyTax: 0.0122
    },
    {
        state: 'Connecticut',
        code: 'CT',
        incomeTax: {
            brackets: [
                { min: 0, max: 20000, rate: 0.03 },
                { min: 20000, max: 100000, rate: 0.05 },
                { min: 100000, max: 200000, rate: 0.055 },
                { min: 200000, max: 1000000, rate: 0.06 },
                { min: 1000000, max: null, rate: 0.0699 }
            ],
            standardDeduction: { single: 0, married: 0 }
        },
        salesTax: 0.0635,
        propertyTax: 0.021
    }
];

export default function StateTaxInfo() {
    const [selectedState, setSelectedState] = useState<string>('');
    const [income, setIncome] = useState<string>('');
    const [filingStatus, setFilingStatus] = useState<'single' | 'married'>('single');
    const [calculatedTax, setCalculatedTax] = useState<number | null>(null);

    const selectedStateData = stateTaxData.find(s => s.code === selectedState);

    const calculateStateTax = () => {
        if (!selectedStateData || !income) {
            setCalculatedTax(0);
            return;
        }

        const incomeAmount = parseFloat(income);
        if (selectedStateData.incomeTax.brackets.length === 0) {
            setCalculatedTax(0); // No state income tax
            return;
        }

        let tax = 0;
        const brackets = selectedStateData.incomeTax.brackets;
        const deduction = selectedStateData.incomeTax.standardDeduction[filingStatus];
        const taxableIncome = Math.max(0, incomeAmount - deduction);

        for (const bracket of brackets) {
            if (taxableIncome > bracket.min) {
                const bracketMax = bracket.max || taxableIncome;
                const bracketIncome = Math.min(taxableIncome, bracketMax) - bracket.min;
                tax += bracketIncome * bracket.rate;
            }
        }

        setCalculatedTax(tax);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <MapPin className="w-5 h-5 mr-2" />
                        State Tax Information
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="state">Select State</Label>
                                <Select value={selectedState} onValueChange={setSelectedState}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a state" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stateTaxData.map((state) => (
                                            <SelectItem key={state.code} value={state.code}>
                                                {state.state}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedStateData && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="income">Annual Income</Label>
                                        <Input
                                            id="income"
                                            type="number"
                                            value={income}
                                            onChange={(e) => setIncome(e.target.value)}
                                            placeholder="50000"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="filingStatus">Filing Status</Label>
                                        <Select value={filingStatus} onValueChange={(value: 'single' | 'married') => setFilingStatus(value)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="single">Single</SelectItem>
                                                <SelectItem value="married">Married Filing Jointly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button onClick={calculateStateTax} className="w-full">
                                        <Calculator className="w-4 h-4 mr-2" />
                                        Calculate State Tax
                                    </Button>
                                </>
                            )}
                        </div>

                        {selectedStateData && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">{selectedStateData.state} Tax Overview</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Sales Tax Rate</div>
                                        <div className="text-xl font-bold">{(selectedStateData.salesTax * 100).toFixed(1)}%</div>
                                    </div>
                                    <div className="p-3 bg-green-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Avg Property Tax</div>
                                        <div className="text-xl font-bold">{(selectedStateData.propertyTax * 100).toFixed(1)}%</div>
                                    </div>
                                </div>

                                {selectedStateData.incomeTax.brackets.length > 0 ? (
                                    <div>
                                        <h4 className="font-medium mb-2">Income Tax Brackets</h4>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {selectedStateData.incomeTax.brackets.slice(0, 3).map((bracket, index) => (
                                                <div key={index} className="text-sm flex justify-between">
                                                    <span>
                                                        ${bracket.min.toLocaleString()} - {bracket.max ? `$${bracket.max.toLocaleString()}` : '∞'}
                                                    </span>
                                                    <Badge variant="outline">{(bracket.rate * 100).toFixed(1)}%</Badge>
                                                </div>
                                            ))}
                                            {selectedStateData.incomeTax.brackets.length > 3 && (
                                                <div className="text-sm text-gray-500">
                                                    +{selectedStateData.incomeTax.brackets.length - 3} more brackets
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-yellow-50 rounded-lg">
                                        <div className="flex items-center">
                                            <Info className="w-4 h-4 mr-2 text-yellow-600" />
                                            <span className="text-sm font-medium">No State Income Tax</span>
                                        </div>
                                    </div>
                                )}

                                {calculatedTax !== null && (
                                    <div className="p-3 bg-red-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Estimated State Income Tax</div>
                                        <div className="text-xl font-bold text-red-600">
                                            ${calculatedTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Effective rate: {((calculatedTax / parseFloat(income || '1')) * 100).toFixed(1)}%
                                            <br />
                                            <em>Note: This is an estimate. Consult a tax professional for accurate calculations.</em>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>State Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2">State</th>
                                    <th className="text-center p-2">Income Tax</th>
                                    <th className="text-center p-2">Sales Tax</th>
                                    <th className="text-center p-2">Property Tax</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stateTaxData.map((state) => (
                                    <tr key={state.code} className="border-b hover:bg-gray-50">
                                        <td className="p-2 font-medium">{state.state}</td>
                                        <td className="p-2 text-center">
                                            {state.incomeTax.brackets.length > 0 ? (
                                                <Badge variant="destructive">Yes</Badge>
                                            ) : (
                                                <Badge variant="secondary">None</Badge>
                                            )}
                                        </td>
                                        <td className="p-2 text-center">{(state.salesTax * 100).toFixed(1)}%</td>
                                        <td className="p-2 text-center">{(state.propertyTax * 100).toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
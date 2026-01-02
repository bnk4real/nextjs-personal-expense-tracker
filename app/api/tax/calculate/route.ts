import { NextRequest, NextResponse } from 'next/server';

// Type definitions for tax calculations
interface TaxBracket {
    min: number;
    max: number | null;
    rate: number;
}

interface TaxBracketDetail {
    rate: number;
    taxableAmount: number;
    tax: number;
}

interface TaxCalculationResult {
    tax: number;
    brackets: TaxBracketDetail[];
}

// Static tax data for 2024 (fallback when API fails)
const TAX_BRACKETS_2024 = {
    federal: {
        single: [
            { min: 0, max: 11600, rate: 0.10 },
            { min: 11600, max: 47150, rate: 0.12 },
            { min: 47150, max: 100525, rate: 0.22 },
            { min: 100525, max: 191950, rate: 0.24 },
            { min: 191950, max: 243725, rate: 0.32 },
            { min: 243725, max: 609350, rate: 0.35 },
            { min: 609350, max: null, rate: 0.37 }
        ] as TaxBracket[],
        married_filing_jointly: [
            { min: 0, max: 23200, rate: 0.10 },
            { min: 23200, max: 94300, rate: 0.12 },
            { min: 94300, max: 201050, rate: 0.22 },
            { min: 201050, max: 383900, rate: 0.24 },
            { min: 383900, max: 487450, rate: 0.32 },
            { min: 487450, max: 731200, rate: 0.35 },
            { min: 731200, max: null, rate: 0.37 }
        ] as TaxBracket[],
        married_filing_separately: [
            { min: 0, max: 11600, rate: 0.10 },
            { min: 11600, max: 47150, rate: 0.12 },
            { min: 47150, max: 100525, rate: 0.22 },
            { min: 100525, max: 191950, rate: 0.24 },
            { min: 191950, max: 243725, rate: 0.32 },
            { min: 243725, max: 365600, rate: 0.35 },
            { min: 365600, max: null, rate: 0.37 }
        ] as TaxBracket[],
        head_of_household: [
            { min: 0, max: 16550, rate: 0.10 },
            { min: 16550, max: 63100, rate: 0.12 },
            { min: 63100, max: 100500, rate: 0.22 },
            { min: 100500, max: 191950, rate: 0.24 },
            { min: 191950, max: 243700, rate: 0.32 },
            { min: 243700, max: 609350, rate: 0.35 },
            { min: 609350, max: null, rate: 0.37 }
        ] as TaxBracket[]
    },
    state: {
        CA: [
            { min: 0, max: 10099, rate: 0.01 },
            { min: 10099, max: 23942, rate: 0.02 },
            { min: 23942, max: 37788, rate: 0.04 },
            { min: 37788, max: 52455, rate: 0.06 },
            { min: 52455, max: 66295, rate: 0.08 },
            { min: 66295, max: 349137, rate: 0.09 },
            { min: 349137, max: 698274, rate: 0.10 },
            { min: 698274, max: null, rate: 0.11 }
        ] as TaxBracket[],
        NY: [
            { min: 0, max: 8500, rate: 0.04 },
            { min: 8500, max: 11700, rate: 0.045 },
            { min: 11700, max: 13900, rate: 0.0525 },
            { min: 13900, max: 21400, rate: 0.059 },
            { min: 21400, max: 80650, rate: 0.0597 },
            { min: 80650, max: 215400, rate: 0.0633 },
            { min: 215400, max: 1077550, rate: 0.0657 },
            { min: 1077550, max: null, rate: 0.0685 }
        ] as TaxBracket[],
        IL: [
            { min: 0, max: 10000, rate: 0.045 },
            { min: 10000, max: 20000, rate: 0.048 },
            { min: 20000, max: 100000, rate: 0.053 },
            { min: 100000, max: 250000, rate: 0.062 },
            { min: 250000, max: null, rate: 0.0695 }
        ] as TaxBracket[],
        MA: [
            { min: 0, max: 1000000, rate: 0.05 },
            { min: 1000000, max: null, rate: 0.053 }
        ] as TaxBracket[],
        TX: [] as TaxBracket[], // No state income tax
        FL: [] as TaxBracket[], // No state income tax
        NV: [] as TaxBracket[], // No state income tax
        WA: [] as TaxBracket[], // No state income tax
        WY: [] as TaxBracket[], // No state income tax
        SD: [] as TaxBracket[], // No state income tax
        AK: [] as TaxBracket[]  // No state income tax
    }
};

const STANDARD_DEDUCTIONS_2024 = {
    federal: {
        single: 14600,
        married_filing_jointly: 29200,
        married_filing_separately: 14600,
        head_of_household: 21900
    }
};

function calculateTax(income: number, brackets: TaxBracket[], deduction: number = 0): TaxCalculationResult {
    const taxableIncome = Math.max(0, income - deduction);
    let totalTax = 0;
    const bracketDetails: TaxBracketDetail[] = [];

    for (const bracket of brackets) {
        if (taxableIncome > bracket.min) {
            const bracketMax = bracket.max || taxableIncome;
            const bracketIncome = Math.min(taxableIncome, bracketMax) - bracket.min;
            const bracketTax = bracketIncome * bracket.rate;

            totalTax += bracketTax;
            bracketDetails.push({
                rate: bracket.rate,
                taxableAmount: bracketIncome,
                tax: bracketTax
            });
        }
    }

    return { tax: totalTax, brackets: bracketDetails };
}

export async function POST(request: NextRequest) {
    try {
        const { income, state, filingStatus } = await request.json();

        const validFilingStatuses = ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'];
        if (!validFilingStatuses.includes(filingStatus)) {
            return NextResponse.json(
                { error: `Invalid filing status. Must be one of: ${validFilingStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const incomeAmount = parseFloat(income);

        // Use local tax calculation (Taxee.io API is no longer available)
        console.log('Using local tax calculation for:', { income: incomeAmount, state, filingStatus });

        const federalBrackets = TAX_BRACKETS_2024.federal[filingStatus as keyof typeof TAX_BRACKETS_2024.federal];
        if (!federalBrackets) {
            console.error('No federal brackets found for filing status:', filingStatus);
            return NextResponse.json(
                { error: `Invalid filing status: ${filingStatus}` },
                { status: 400 }
            );
        }

        const federalDeduction = STANDARD_DEDUCTIONS_2024.federal[filingStatus as keyof typeof STANDARD_DEDUCTIONS_2024.federal];
        if (federalDeduction === undefined) {
            console.error('No federal deduction found for filing status:', filingStatus);
            return NextResponse.json(
                { error: `Invalid filing status: ${filingStatus}` },
                { status: 400 }
            );
        }

        const stateBrackets = TAX_BRACKETS_2024.state[state as keyof typeof TAX_BRACKETS_2024.state] || [];

        console.log('Selected brackets for', filingStatus, ':', {
            federalBrackets: federalBrackets.length,
            federalDeduction,
            stateBrackets: stateBrackets.length
        });

        const federalResult = calculateTax(incomeAmount, federalBrackets, federalDeduction);
        const stateResult = calculateTax(incomeAmount, stateBrackets, 0); // States handle deductions differently

        const totalTax = federalResult.tax + stateResult.tax;
        const takeHome = incomeAmount - totalTax;
        const effectiveRate = incomeAmount > 0 ? totalTax / incomeAmount : 0;

        console.log('Tax calculation result:', { federalTax: federalResult.tax, stateTax: stateResult.tax, totalTax, effectiveRate });

        return NextResponse.json({
            federalTax: federalResult.tax,
            stateTax: stateResult.tax,
            totalTax,
            effectiveRate,
            takeHome,
            breakdown: {
                federal: {
                    brackets: federalResult.brackets
                },
                state: {
                    rate: stateBrackets.length > 0 ? stateBrackets[stateBrackets.length - 1].rate : 0,
                    tax: stateResult.tax
                }
            },
            source: 'local_calculation'
        });

    } catch (error) {
        console.error('Tax calculation error:', error);
        return NextResponse.json(
            { error: 'Failed to calculate taxes' },
            { status: 500 }
        );
    }
}
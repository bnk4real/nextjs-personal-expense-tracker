import { NextRequest, NextResponse } from 'next/server';
import { getBudgetWarning } from '@/lib/budget';
import { getRequestUser } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const amount = Number(body.amount);
        const excludeExpenseId = body.expenseId ? Number(body.expenseId) : undefined;

        const warning = await getBudgetWarning({
            userId: user.user_id,
            date: String(body.date || ''),
            amount,
            category: String(body.category || ''),
            excludeExpenseId: Number.isInteger(excludeExpenseId) ? excludeExpenseId : undefined,
        });

        return NextResponse.json({ warning });
    } catch (error) {
        console.error('Error checking budget:', error);
        return NextResponse.json({ error: 'Failed to check budget' }, { status: 500 });
    }
}

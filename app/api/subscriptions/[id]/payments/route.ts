import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { generatePaymentSchedule, getOverduePayments, getUpcomingPayments, PaymentSchedule } from '@/lib/recurring-payments';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to verify JWT token
function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { user_id: string; username: string; email: string; firstName: string; lastName: string };
    } catch {
        return null;
    }
}

// GET /api/subscriptions/[id]/payments - Get payment history for a subscription
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const includeUpcoming = searchParams.get('includeUpcoming') === 'true';
        const includeOverdue = searchParams.get('includeOverdue') === 'true';
        const daysAhead = parseInt(searchParams.get('daysAhead') || '30');

        // First, verify the subscription belongs to the user
        const subscription = await prisma.subscriptions.findFirst({
            where: {
                id: id,
                user_id: decoded.user_id
            }
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        // Get existing payments
        const payments = await prisma.subscriptionPayment.findMany({
            where: {
                subscriptionId: id
            },
            orderBy: {
                dueDate: 'desc'
            }
        });

        const result: { 
            payments: typeof payments; 
            upcoming?: PaymentSchedule[]; 
            overdue?: PaymentSchedule[] 
        } = { payments };

        // Generate upcoming payments if requested
        if (includeUpcoming) {
            const schedule = generatePaymentSchedule({
                billingCycle: subscription.billing_cycle as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
                startDate: subscription.start_date,
                endDate: subscription.end_date || undefined,
                priceCents: subscription.price_cents,
                currency: subscription.currency
            }, 24); // Generate up to 24 future payments

            const upcoming = getUpcomingPayments(schedule, new Date(), daysAhead);
            result.upcoming = upcoming;
        }

        // Get overdue payments if requested
        if (includeOverdue) {
            const overdue = getOverduePayments(payments.map((p): PaymentSchedule => ({
                dueDate: p.dueDate,
                amount: p.amount,
                currency: p.currency,
                status: p.status as 'pending' | 'paid' | 'overdue' | 'cancelled'
            })));
            result.overdue = overdue;
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching subscription payments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch subscription payments' },
            { status: 500 }
        );
    }
}

// POST /api/subscriptions/[id]/payments - Create a new payment record
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Verify the subscription belongs to the user
        const subscription = await prisma.subscriptions.findFirst({
            where: {
                id: id,
                user_id: decoded.user_id
            }
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        const { amount, currency, dueDate, paymentMethod, status = 'pending' } = await request.json();

        if (!amount || !dueDate) {
            return NextResponse.json(
                { error: 'Amount and due date are required' },
                { status: 400 }
            );
        }

        const payment = await prisma.subscriptionPayment.create({
            data: {
                subscriptionId: id,
                amount: parseInt(amount),
                currency: currency || subscription.currency,
                dueDate: new Date(dueDate),
                paymentDate: status === 'paid' ? new Date() : undefined,
                paymentMethod,
                status
            }
        });

        return NextResponse.json(payment, { status: 201 });
    } catch (error) {
        console.error('Error creating subscription payment:', error);
        return NextResponse.json(
            { error: 'Failed to create subscription payment' },
            { status: 500 }
        );
    }
}

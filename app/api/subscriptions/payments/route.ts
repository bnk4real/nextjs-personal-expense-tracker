import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getOverduePayments } from '@/lib/recurring-payments';
import { ensureNextSubscriptionPayment } from '@/lib/subscription-schedule';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to verify JWT token
function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { user_id: string; username: string; email: string; firstName: string; lastName: string };
    } catch {
        return null;
    }
}

// GET /api/subscriptions/payments - Get all payments for user with filters
export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'pending', 'paid', 'overdue', 'cancelled'
        const overdueOnly = searchParams.get('overdueOnly') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50');

        const whereClause: {
            subscription: {
                user_id: string;
            };
            status?: string;
        } = {
            subscription: {
                user_id: decoded.user_id
            }
        };

        if (status) {
            whereClause.status = status;
        }

        const payments = await prisma.subscriptionPayment.findMany({
            where: whereClause,
            include: {
                subscription: {
                    select: {
                        id: true,
                        name: true,
                        billing_cycle: true,
                        currency: true
                    }
                }
            },
            orderBy: {
                dueDate: 'asc'
            },
            take: limit
        });

        let result = { payments };

        // Filter for overdue payments if requested
        if (overdueOnly) {
            const overduePayments = getOverduePayments(payments.map(p => ({
                dueDate: p.dueDate,
                amount: p.amount,
                currency: p.currency,
                status: p.status as 'pending' | 'paid' | 'overdue' | 'cancelled'
            })));
            
            result = { 
                payments: payments.filter(p => 
                    overduePayments.some(op => 
                        op.dueDate.getTime() === p.dueDate.getTime()
                    )
                )
            };
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching payments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch payments' },
            { status: 500 }
        );
    }
}

// POST /api/subscriptions/payments - Ensure each active subscription has its next occurrence
export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { subscriptionIds } = await request.json();

        // Get subscriptions to generate payments for
        const subscriptions = await prisma.subscriptions.findMany({
            where: {
                user_id: decoded.user_id,
                status: 'active',
                ...(subscriptionIds && { id: { in: subscriptionIds } })
            }
        });

        const payments = (await Promise.all(
            subscriptions.map(ensureNextSubscriptionPayment)
        )).filter(Boolean);

        return NextResponse.json({
            message: `Ensured ${payments.length} recurring payments`,
            payments
        });
    } catch (error) {
        console.error('Error generating payments:', error);
        return NextResponse.json(
            { error: 'Failed to generate payments' },
            { status: 500 }
        );
    }
}

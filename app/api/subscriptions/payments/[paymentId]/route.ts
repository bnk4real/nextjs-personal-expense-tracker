import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to verify JWT token
function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { user_id: string; username: string; email: string; firstName: string; lastName: string };
    } catch {
        return null;
    }
}

// PUT /api/subscriptions/payments/[paymentId] - Mark payment as paid or update status
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) {
    try {
        const { paymentId } = await params;
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { status, paymentMethod } = await request.json();

        // Verify the payment belongs to the user
        const payment = await prisma.subscriptionPayment.findFirst({
            where: {
                id: paymentId,
                subscription: {
                    user_id: decoded.user_id
                }
            },
            include: {
                subscription: true
            }
        });

        if (!payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        const updateData: {
            status: string;
            paymentDate?: Date;
            paymentMethod?: string;
        } = {
            status: status || 'paid'
        };

        // Set payment date when marking as paid
        if (status === 'paid' && payment.status !== 'paid') {
            updateData.paymentDate = new Date();
        }

        if (paymentMethod) {
            updateData.paymentMethod = paymentMethod;
        }

        const updatedPayment = await prisma.subscriptionPayment.update({
            where: {
                id: paymentId
            },
            data: updateData
        });

        // If marking as paid, update the subscription's next_payment_date
        if (status === 'paid') {
            const nextPaymentDate = new Date(payment.dueDate);
            switch (payment.subscription.billing_cycle) {
                case 'daily':
                    nextPaymentDate.setUTCDate(nextPaymentDate.getUTCDate() + 1);
                    break;
                case 'weekly':
                    nextPaymentDate.setUTCDate(nextPaymentDate.getUTCDate() + 7);
                    break;
                case 'monthly':
                    nextPaymentDate.setUTCMonth(nextPaymentDate.getUTCMonth() + 1);
                    break;
                case 'quarterly':
                    nextPaymentDate.setUTCMonth(nextPaymentDate.getUTCMonth() + 3);
                    break;
                case 'yearly':
                    nextPaymentDate.setUTCFullYear(nextPaymentDate.getUTCFullYear() + 1);
                    break;
            }

            await prisma.subscriptions.update({
                where: {
                    id: payment.subscriptionId
                },
                data: {
                    next_payment_date: nextPaymentDate
                }
            });
        }

        return NextResponse.json(updatedPayment);
    } catch (error) {
        console.error('Error updating payment:', error);
        return NextResponse.json(
            { error: 'Failed to update payment' },
            { status: 500 }
        );
    }
}

// DELETE /api/subscriptions/payments/[paymentId] - Delete a payment
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) {
    try {
        const { paymentId } = await params;
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Verify the payment belongs to the user
        const payment = await prisma.subscriptionPayment.findFirst({
            where: {
                id: paymentId,
                subscription: {
                    user_id: decoded.user_id
                }
            }
        });

        if (!payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Don't allow deletion of paid payments
        if (payment.status === 'paid') {
            return NextResponse.json(
                { error: 'Cannot delete paid payments' },
                { status: 400 }
            );
        }

        await prisma.subscriptionPayment.delete({
            where: {
                id: paymentId
            }
        });

        return NextResponse.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Error deleting payment:', error);
        return NextResponse.json(
            { error: 'Failed to delete payment' },
            { status: 500 }
        );
    }
}

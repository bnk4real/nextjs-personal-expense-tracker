/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to verify JWT token
function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { user_id: string; username: string; email: string; firstName: string; lastName: string };
    } catch (error) {
        return null;
    }
}

// GET /api/subscriptions/[id] - Get a specific subscription
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check for token in cookies first, then Authorization header
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { id } = await params;
        const subscription = await prisma.subscriptions.findUnique({
            where: { id: id, user_id: decoded.user_id }
        });

        if (!subscription) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(subscription);
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return NextResponse.json(
            { error: 'Failed to fetch subscription' },
            { status: 500 }
        );
    }
}

// PUT /api/subscriptions/[id] - Update a specific subscription
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check for token in cookies first, then Authorization header
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { id } = await params;
        const { name, provider, price_cents, currency, billing_cycle, next_payment_date, website_url, notes } = await request.json();

        if (!name || !price_cents || !billing_cycle) {
            return NextResponse.json(
                { error: 'Name, price, and billing cycle are required' },
                { status: 400 }
            );
        }

        // Update the subscription
        const subscription = await prisma.subscriptions.update({
            where: { id: id, user_id: decoded.user_id },
            data: {
                name,
                provider,
                price_cents: parseInt(price_cents),
                currency: currency || 'USD',
                billing_cycle,
                next_payment_date: next_payment_date ? new Date(next_payment_date) : null,
                website_url,
                notes,
                updated_at: new Date()
            }
        });

        return NextResponse.json(subscription);
    } catch (error) {
        console.error('Error updating subscription:', error);
        return NextResponse.json(
            { error: 'Failed to update subscription' },
            { status: 500 }
        );
    }
}

// DELETE /api/subscriptions/[id] - Delete a specific subscription
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check for token in cookies first, then Authorization header
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { id } = await params;

        // Check if subscription exists and belongs to user
        const subscription = await prisma.subscriptions.findUnique({
            where: { id: id, user_id: decoded.user_id }
        });

        if (!subscription) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        // Delete the subscription
        await prisma.subscriptions.delete({
            where: { id: id, user_id: decoded.user_id }
        });

        return NextResponse.json({ message: 'Subscription deleted successfully' });
    } catch (error) {
        console.error('Error deleting subscription:', error);
        return NextResponse.json(
            { error: 'Failed to delete subscription' },
            { status: 500 }
        );
    }
}
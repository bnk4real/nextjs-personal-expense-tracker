/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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

// GET /api/subscriptions - Get all subscriptions
export async function GET(request: NextRequest) {
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

        const subscriptions = await prisma.subscriptions.findMany({
            // where: { user_id: decoded.user_id },
            orderBy: {
                next_payment_date: 'asc'
            }
        });


        return NextResponse.json(subscriptions);
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch subscriptions' },
            { status: 500 }
        );
    }
}

// POST /api/subscriptions - Create a new subscription
export async function POST(request: NextRequest) {
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

        const { name, provider, price_cents, currency, billing_cycle, next_payment_date, website_url, notes } = await request.json();

        if (!name || !price_cents || !billing_cycle) {
            return NextResponse.json(
                { error: 'Name, price, and billing cycle are required' },
                { status: 400 }
            );
        }

        // Create the subscription
        const subscription = await prisma.subscriptions.create({
            data: {
                user_id: decoded.user_id,
                name,
                provider,
                price_cents: parseInt(price_cents),
                currency: currency || 'USD',
                billing_cycle,
                next_payment_date: next_payment_date ? new Date(next_payment_date) : null,
                website_url,
                notes,
            } 
        });

        return NextResponse.json(subscription, { status: 201 });
    } catch (error) {
        console.error('Error creating subscription:', error);
        return NextResponse.json(
            { error: 'Failed to create subscription' },
            { status: 500 }
        );
    }
}
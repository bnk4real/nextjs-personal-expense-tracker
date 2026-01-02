/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const accounts = await prisma.account.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(accounts);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name, type, balance, creditLimit } = await request.json();
        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
        }

        // Parse balance as number
        const parsedBalance = typeof balance === 'string' ? parseFloat(balance) : (balance || 0);

        // Handle creditLimit for credit cards
        let parsedCreditLimit = null;
        if (type === 'Credit Card') {
            if (creditLimit !== undefined && creditLimit !== null && creditLimit !== '') {
                parsedCreditLimit = typeof creditLimit === 'string' ? parseFloat(creditLimit) : creditLimit;
            }
        }

        const account = await prisma.account.create({
            data: {
                name,
                type,
                balance: parsedBalance,
                creditLimit: parsedCreditLimit
            },
        });
        return NextResponse.json(account, { status: 201 });
    } catch (error) {
        console.error('Error creating account:', error);
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const account = await prisma.account.findUnique({
            where: { id: parseInt(id) },
        });
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
        return NextResponse.json(account);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        const account = await prisma.account.update({
            where: { id: parseInt(id) },
            data: {
                name,
                type,
                balance: parsedBalance,
                creditLimit: parsedCreditLimit
            },
        });
        return NextResponse.json(account);
    } catch (error) {
        console.error('Error updating account:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.account.delete({
            where: { id: parseInt(id) },
        });
        return NextResponse.json({ message: 'Account deleted successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}
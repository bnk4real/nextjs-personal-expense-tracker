import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const debts = await prisma.debt.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(debts);
    } catch (error) {
        console.error('Error fetching debts:', error);
        return NextResponse.json(
            { error: 'Failed to fetch debts' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            type,
            lender,
            accountNumber,
            totalAmount,
            currentBalance,
            interestRate,
            minimumPayment,
            dueDate,
            description
        } = body;

        if (!type || !lender || !totalAmount || currentBalance === undefined) {
            return NextResponse.json(
                { error: 'Type, lender, total amount, and current balance are required' },
                { status: 400 }
            );
        }

        const debt = await prisma.debt.create({
            data: {
                type,
                lender,
                accountNumber,
                totalAmount: parseFloat(totalAmount),
                currentBalance: parseFloat(currentBalance),
                interestRate: interestRate ? parseFloat(interestRate) : null,
                minimumPayment: minimumPayment ? parseFloat(minimumPayment) : null,
                dueDate,
                description
            }
        });

        return NextResponse.json(debt, { status: 201 });
    } catch (error) {
        console.error('Error creating debt:', error);
        return NextResponse.json(
            { error: 'Failed to create debt' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id,
            type,
            lender,
            accountNumber,
            totalAmount,
            currentBalance,
            interestRate,
            minimumPayment,
            dueDate,
            description,
            isActive
        } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Debt ID is required' },
                { status: 400 }
            );
        }

        const debt = await prisma.debt.update({
            where: { id: parseInt(id) },
            data: {
                type,
                lender,
                accountNumber,
                totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
                currentBalance: currentBalance !== undefined ? parseFloat(currentBalance) : undefined,
                interestRate: interestRate !== undefined ? (interestRate ? parseFloat(interestRate) : null) : undefined,
                minimumPayment: minimumPayment !== undefined ? (minimumPayment ? parseFloat(minimumPayment) : null) : undefined,
                dueDate,
                description,
                isActive: isActive !== undefined ? isActive : undefined
            }
        });

        return NextResponse.json(debt);
    } catch (error) {
        console.error('Error updating debt:', error);
        return NextResponse.json(
            { error: 'Failed to update debt' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Debt ID is required' },
                { status: 400 }
            );
        }

        await prisma.debt.delete({
            where: { id: parseInt(id) }
        });

        return NextResponse.json({ message: 'Debt deleted successfully' });
    } catch (error) {
        console.error('Error deleting debt:', error);
        return NextResponse.json(
            { error: 'Failed to delete debt' },
            { status: 500 }
        );
    }
}
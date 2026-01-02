import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/incomes/[id] - Get a specific income
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const income = await prisma.income.findUnique({
            where: { id: parseInt(id) },
            include: {
                account: true
            }
        });

        if (!income) {
            return NextResponse.json(
                { error: 'Income not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(income);
    } catch (error) {
        console.error('Error fetching income:', error);
        return NextResponse.json(
            { error: 'Failed to fetch income' },
            { status: 500 }
        );
    }
}

// PUT /api/incomes/[id] - Update a specific income
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { amount, source, date, description, notes, accountId, state, filingStatus } = await request.json();

        if (!amount || !source || !date || !description) {
            return NextResponse.json(
                { error: 'Amount, source, date, and description are required' },
                { status: 400 }
            );
        }

        // Get the current income to calculate balance changes
        const currentIncome = await prisma.income.findUnique({
            where: { id: parseInt(id) }
        });

        if (!currentIncome) {
            return NextResponse.json(
                { error: 'Income not found' },
                { status: 404 }
            );
        }

        // Update the income
        const income = await prisma.income.update({
            where: { id: parseInt(id) },
            data: {
                amount: parseFloat(amount),
                source,
                date,
                description,
                notes,
                state,
                filingStatus,
                accountId: accountId ? parseInt(accountId) : null,
                updatedAt: new Date()
            },
            include: {
                account: true
            }
        });

        // Update account balances
        const oldAccountId = currentIncome.accountId;
        const newAccountId = accountId ? parseInt(accountId) : null;
        const oldAmount = currentIncome.amount;
        const newAmount = parseFloat(amount);

        // If account changed, update both old and new accounts
        if (oldAccountId !== newAccountId) {
            // Subtract from old account
            if (oldAccountId) {
                await prisma.account.update({
                    where: { id: oldAccountId },
                    data: {
                        balance: { decrement: oldAmount },
                        updatedAt: new Date()
                    }
                });
            }

            // Add to new account
            if (newAccountId) {
                await prisma.account.update({
                    where: { id: newAccountId },
                    data: {
                        balance: { increment: newAmount },
                        updatedAt: new Date()
                    }
                });
            }
        } else if (newAccountId) {
            // Same account, just update the difference
            const difference = newAmount - oldAmount;
            await prisma.account.update({
                where: { id: newAccountId },
                data: {
                    balance: { increment: difference },
                    updatedAt: new Date()
                }
            });
        }

        return NextResponse.json(income);
    } catch (error) {
        console.error('Error updating income:', error);
        return NextResponse.json(
            { error: 'Failed to update income' },
            { status: 500 }
        );
    }
}

// DELETE /api/incomes/[id] - Delete a specific income
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Get the income before deleting to update account balance
        const income = await prisma.income.findUnique({
            where: { id: parseInt(id) }
        });

        if (!income) {
            return NextResponse.json(
                { error: 'Income not found' },
                { status: 404 }
            );
        }

        // Delete the income
        await prisma.income.delete({
            where: { id: parseInt(id) }
        });

        // Update account balance
        if (income.accountId) {
            await prisma.account.update({
                where: { id: income.accountId },
                data: {
                    balance: { decrement: income.amount },
                    updatedAt: new Date()
                }
            });
        }

        return NextResponse.json({ message: 'Income deleted successfully' });
    } catch (error) {
        console.error('Error deleting income:', error);
        return NextResponse.json(
            { error: 'Failed to delete income' },
            { status: 500 }
        );
    }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptPlaidAccessToken, getPlaidClient, plaidEnvironment, plaidErrorDetails } from '@/lib/plaid';
import { getRequestUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const connections = await prisma.plaidItem.findMany({
        where: { userId: user.user_id },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            institutionName: true,
            status: true,
            errorCode: true,
            errorMessage: true,
            autoImportStartDate: true,
            lastSyncedAt: true,
            createdAt: true,
            accounts: {
                select: {
                    id: true,
                    name: true,
                    mask: true,
                    type: true,
                    subtype: true,
                    currentBalance: true,
                    availableBalance: true,
                    creditLimit: true,
                    currency: true,
                    localAccountId: true,
                },
            },
            _count: {
                select: {
                    accounts: true,
                },
            },
        },
    });

    const reviewCount = await prisma.plaidTransaction.count({
        where: {
            plaidAccount: { item: { userId: user.user_id } },
            status: { in: ['review', 'pending'] },
        },
    });

    return NextResponse.json({ connections, reviewCount, environment: plaidEnvironment() });
}

export async function DELETE(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const body = await request.json() as { connectionId?: string };
        const item = await prisma.plaidItem.findFirst({
            where: { id: body.connectionId, userId: user.user_id },
        });
        if (!item) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

        await getPlaidClient().itemRemove({
            access_token: decryptPlaidAccessToken(item.encryptedAccessToken),
        });
        await prisma.plaidItem.delete({ where: { id: item.id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        const details = plaidErrorDetails(error);
        return NextResponse.json({ error: details.message, code: details.code }, { status: 502 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidErrorDetails } from '@/lib/plaid';
import { syncPlaidItem } from '@/lib/plaid-sync';
import { getRequestUser } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const body = await request.json().catch(() => ({})) as { connectionId?: string };
        const items = await prisma.plaidItem.findMany({
            where: {
                userId: user.user_id,
                ...(body.connectionId ? { id: body.connectionId } : {}),
            },
            select: { id: true },
        });
        if (body.connectionId && items.length === 0) {
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        const results = [];
        for (const item of items) {
            results.push({ connectionId: item.id, ...(await syncPlaidItem(item.id)) });
        }
        return NextResponse.json({ results });
    } catch (error) {
        const details = plaidErrorDetails(error);
        return NextResponse.json(
            { error: details.message, code: details.code, requestId: details.requestId },
            { status: 502 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncPlaidItem } from '@/lib/plaid-sync';
import { verifyPlaidWebhook } from '@/lib/plaid-webhook';

type PlaidWebhook = {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
    error?: {
        error_code?: string;
        error_message?: string;
    } | null;
};

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const verified = await verifyPlaidWebhook(
        request.headers.get('plaid-verification'),
        rawBody
    );
    if (!verified) {
        return NextResponse.json({ error: 'Invalid Plaid webhook signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as PlaidWebhook;
    if (!body.item_id) return NextResponse.json({ received: true });

    const item = await prisma.plaidItem.findUnique({ where: { itemId: body.item_id } });
    if (!item) return NextResponse.json({ received: true });

    await prisma.plaidItem.update({
        where: { id: item.id },
        data: {
            lastWebhookAt: new Date(),
            ...(body.webhook_type === 'ITEM' && body.error ? {
                status: body.error.error_code === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error',
                errorCode: body.error.error_code,
                errorMessage: body.error.error_message,
            } : {}),
        },
    });

    if (
        body.webhook_type === 'TRANSACTIONS'
        && ['SYNC_UPDATES_AVAILABLE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(body.webhook_code || '')
    ) {
        try {
            await syncPlaidItem(item.id);
        } catch {
            // The sync service persists the connection error for the UI.
        }
    }

    return NextResponse.json({ received: true });
}

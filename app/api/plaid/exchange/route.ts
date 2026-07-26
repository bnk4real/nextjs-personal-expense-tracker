import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptPlaidAccessToken, getPlaidClient, plaidErrorDetails } from '@/lib/plaid';
import { syncPlaidItem, upsertPlaidAccounts } from '@/lib/plaid-sync';
import { getRequestUser } from '@/lib/server-auth';

type ExchangeBody = {
    publicToken?: string;
    institution?: {
        institutionId?: string | null;
        name?: string | null;
    };
};

function importStartDate() {
    const configured = process.env.PLAID_AUTO_IMPORT_START_DATE?.trim();
    return configured && /^\d{4}-\d{2}-\d{2}$/.test(configured)
        ? configured
        : new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const body = await request.json() as ExchangeBody;
        if (!body.publicToken) {
            return NextResponse.json({ error: 'publicToken is required' }, { status: 400 });
        }

        const client = getPlaidClient();
        const exchange = await client.itemPublicTokenExchange({
            public_token: body.publicToken,
        });
        const { access_token: accessToken, item_id: itemId } = exchange.data;
        const accounts = await client.accountsGet({ access_token: accessToken });

        const item = await prisma.plaidItem.create({
            data: {
                userId: user.user_id,
                itemId,
                encryptedAccessToken: encryptPlaidAccessToken(accessToken),
                institutionId: body.institution?.institutionId || null,
                institutionName: body.institution?.name || null,
                autoImportStartDate: importStartDate(),
            },
        });

        await upsertPlaidAccounts(item.id, accounts.data.accounts);
        const sync = await syncPlaidItem(item.id);

        return NextResponse.json({ connectionId: item.id, sync }, { status: 201 });
    } catch (error) {
        const details = plaidErrorDetails(error);
        return NextResponse.json(
            { error: details.message, code: details.code, requestId: details.requestId },
            { status: 502 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { getPlaidClient, plaidEnvironment, plaidErrorDetails } from '@/lib/plaid';
import { getRequestUser } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const webhook = process.env.PLAID_WEBHOOK_URL?.trim();
        const daysRequested = Number(process.env.PLAID_DAYS_REQUESTED || 90);
        const response = await getPlaidClient().linkTokenCreate({
            user: { client_user_id: user.user_id },
            client_name: process.env.PLAID_APP_NAME?.trim() || 'Expense Tracker',
            products: [Products.Transactions],
            country_codes: [CountryCode.Us],
            language: 'en',
            webhook: webhook?.startsWith('https://') ? webhook : undefined,
            transactions: {
                days_requested: Number.isFinite(daysRequested)
                    ? Math.min(Math.max(daysRequested, 30), 730)
                    : 90,
            },
        });

        return NextResponse.json({
            linkToken: response.data.link_token,
            environment: plaidEnvironment(),
        });
    } catch (error) {
        const details = plaidErrorDetails(error);
        return NextResponse.json(
            { error: details.message, code: details.code, requestId: details.requestId },
            { status: 502 }
        );
    }
}

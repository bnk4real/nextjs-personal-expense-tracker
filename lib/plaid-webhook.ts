import { createHash, timingSafeEqual } from 'node:crypto';
import {
    decodeProtectedHeader,
    importJWK,
    jwtVerify,
    type JWK,
} from 'jose';
import { getPlaidClient } from '@/lib/plaid';

type PlaidVerificationPayload = {
    request_body_sha256?: string;
};

export async function verifyPlaidWebhook(signature: string | null, rawBody: string) {
    if (!signature) return false;

    try {
        const header = decodeProtectedHeader(signature);
        if (header.alg !== 'ES256' || !header.kid) return false;

        const response = await getPlaidClient().webhookVerificationKeyGet({
            key_id: header.kid,
        });
        const key = await importJWK(response.data.key as JWK, 'ES256');
        const verified = await jwtVerify<PlaidVerificationPayload>(signature, key, {
            algorithms: ['ES256'],
            maxTokenAge: '5 min',
        });

        const expectedHash = verified.payload.request_body_sha256;
        if (!expectedHash) return false;

        const actual = Buffer.from(createHash('sha256').update(rawBody).digest('hex'));
        const expected = Buffer.from(expectedHash);
        return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

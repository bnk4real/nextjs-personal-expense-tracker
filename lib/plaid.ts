import {
    createCipheriv,
    createDecipheriv,
    hkdfSync,
    randomBytes,
} from 'node:crypto';
import {
    Configuration,
    PlaidApi,
    PlaidEnvironments,
} from 'plaid';

const ENCRYPTION_VERSION = 'v1';
const KEY_CONTEXT = 'expense-tracker/plaid-access-token/v1';

function requiredEnvironment(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not configured`);
    return value;
}

function plaidBasePath() {
    const environment = (process.env.PLAID_ENV || 'sandbox').trim().toLowerCase();
    const basePath = PlaidEnvironments[environment as keyof typeof PlaidEnvironments];
    if (!basePath) throw new Error(`Unsupported PLAID_ENV: ${environment}`);
    return basePath;
}

function encryptionSecret() {
    const dedicatedSecret = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
    if (dedicatedSecret) return dedicatedSecret;

    const jwtSecret = process.env.JWT_SECRET?.trim();
    if (jwtSecret && jwtSecret !== 'your-secret-key') return jwtSecret;

    throw new Error('PLAID_TOKEN_ENCRYPTION_KEY or a secure JWT_SECRET is required');
}

function encryptionKey() {
    return Buffer.from(hkdfSync(
        'sha256',
        Buffer.from(encryptionSecret(), 'utf8'),
        Buffer.from('expense-tracker', 'utf8'),
        Buffer.from(KEY_CONTEXT, 'utf8'),
        32
    ));
}

export function getPlaidClient() {
    return new PlaidApi(new Configuration({
        basePath: plaidBasePath(),
        baseOptions: {
            headers: {
                'PLAID-CLIENT-ID': requiredEnvironment('PLAID_CLIENT_ID'),
                'PLAID-SECRET': requiredEnvironment('PLAID_SECRET'),
            },
        },
    }));
}

export function encryptPlaidAccessToken(accessToken: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(accessToken, 'utf8'),
        cipher.final(),
    ]);

    return [
        ENCRYPTION_VERSION,
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        encrypted.toString('base64url'),
    ].join('.');
}

export function decryptPlaidAccessToken(value: string) {
    const [version, ivValue, authTagValue, encryptedValue] = value.split('.');
    if (version !== ENCRYPTION_VERSION || !ivValue || !authTagValue || !encryptedValue) {
        throw new Error('Unsupported encrypted Plaid token format');
    }

    const decipher = createDecipheriv(
        'aes-256-gcm',
        encryptionKey(),
        Buffer.from(ivValue, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

export function plaidErrorDetails(error: unknown) {
    const response = (error as {
        response?: {
            data?: {
                error_code?: string;
                error_message?: string;
                request_id?: string;
            };
        };
    })?.response?.data;

    return {
        code: response?.error_code || 'PLAID_ERROR',
        message: response?.error_message || (error instanceof Error ? error.message : 'Plaid request failed'),
        requestId: response?.request_id,
    };
}

export function plaidEnvironment() {
    return (process.env.PLAID_ENV || 'sandbox').trim().toLowerCase();
}

import {
    createCipheriv,
    createDecipheriv,
    hkdfSync,
    randomBytes,
} from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const GEMINI_PROVIDER = 'gemini';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const ENCRYPTION_VERSION = 'v1';
const KEY_CONTEXT = 'expense-tracker/ai-provider-settings/v1';

function encryptionSecret() {
    const dedicatedSecret = process.env.AI_SETTINGS_ENCRYPTION_KEY?.trim();
    if (dedicatedSecret) return dedicatedSecret;

    const jwtSecret = process.env.JWT_SECRET?.trim();
    if (jwtSecret && jwtSecret !== 'your-secret-key') return jwtSecret;

    return null;
}

function encryptionKey() {
    const secret = encryptionSecret();
    if (!secret) {
        throw new Error('AI settings encryption is not configured');
    }

    return Buffer.from(hkdfSync(
        'sha256',
        Buffer.from(secret, 'utf8'),
        Buffer.from('expense-tracker', 'utf8'),
        Buffer.from(KEY_CONTEXT, 'utf8'),
        32
    ));
}

export function isAiSettingsEncryptionReady() {
    return Boolean(encryptionSecret());
}

export function encryptApiKey(apiKey: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(apiKey, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        ENCRYPTION_VERSION,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join('.');
}

export function decryptApiKey(value: string) {
    const [version, ivValue, authTagValue, encryptedValue] = value.split('.');
    if (
        version !== ENCRYPTION_VERSION
        || !ivValue
        || !authTagValue
        || !encryptedValue
    ) {
        throw new Error('Unsupported encrypted API key format');
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

export function apiKeyHint(apiKey: string) {
    const suffix = apiKey.slice(-4);
    return suffix ? `••••${suffix}` : 'Configured';
}

export function isValidGeminiModel(model: string) {
    return model === DEFAULT_GEMINI_MODEL;
}

export async function getGeminiRuntimeConfig(userId: string) {
    const setting = await prisma.aiProviderSetting.findUnique({
        where: {
            userId_provider: {
                userId,
                provider: GEMINI_PROVIDER,
            },
        },
    });

    if (setting) {
        if (!setting.isEnabled) return null;

        return {
            apiKey: decryptApiKey(setting.encryptedApiKey),
            model: isValidGeminiModel(setting.model)
                ? setting.model
                : DEFAULT_GEMINI_MODEL,
            source: 'database' as const,
        };
    }

    const environmentApiKey = process.env.GOOGLE_API_KEY?.trim();
    if (environmentApiKey) {
        return {
            apiKey: environmentApiKey,
            model: DEFAULT_GEMINI_MODEL,
            source: 'environment' as const,
        };
    }

    return null;
}

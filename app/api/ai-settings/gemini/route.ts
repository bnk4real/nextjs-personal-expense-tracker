import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/server-auth';
import {
    apiKeyHint,
    DEFAULT_GEMINI_MODEL,
    decryptApiKey,
    encryptApiKey,
    GEMINI_PROVIDER,
    isAiSettingsEncryptionReady,
    isValidGeminiModel,
} from '@/lib/ai-settings';

function noStoreJson(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
}

async function getSetting(userId: string) {
    return prisma.aiProviderSetting.findUnique({
        where: {
            userId_provider: {
                userId,
                provider: GEMINI_PROVIDER,
            },
        },
    });
}

async function validateGeminiConnection(apiKey: string, model: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });
    const result = await geminiModel.generateContent(
        'Reply with exactly OK. This is a connection test.'
    );
    if (!result.response.text().trim()) {
        throw new Error('Gemini returned an empty response');
    }
}

function connectionErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('429') || /quota|rate limit/i.test(message)) {
        return 'Gemini quota or rate limit was reached. Try again later or choose another model.';
    }
    if (message.includes('404') || /not found|not supported/i.test(message)) {
        return 'This Gemini model is not available for the API key.';
    }
    if (message.includes('400') || message.includes('403') || /api key/i.test(message)) {
        return 'Gemini rejected the API key. Check the key and its permissions.';
    }

    return 'Gemini connection failed. Check the API key and model.';
}

export async function GET(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return noStoreJson({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const setting = await getSetting(user.user_id);
        const environmentApiKey = process.env.GOOGLE_API_KEY?.trim();

        return noStoreJson({
            configured: Boolean(setting || environmentApiKey),
            savedInApp: Boolean(setting),
            source: setting ? 'database' : environmentApiKey ? 'environment' : 'none',
            keyHint: setting?.keyHint || (environmentApiKey ? apiKeyHint(environmentApiKey) : null),
            model: setting && isValidGeminiModel(setting.model)
                ? setting.model
                : DEFAULT_GEMINI_MODEL,
            isEnabled: setting?.isEnabled ?? true,
            lastValidatedAt: setting?.lastValidatedAt || null,
            encryptionReady: isAiSettingsEncryptionReady(),
        });
    } catch (error) {
        console.error('Error loading Gemini settings:', error);
        return noStoreJson({ error: 'Failed to load Gemini settings' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return noStoreJson({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const model = String(body.model || DEFAULT_GEMINI_MODEL).trim();
        const providedApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        if (!isValidGeminiModel(model)) {
            return noStoreJson({ error: 'Invalid Gemini model name' }, { status: 400 });
        }

        const setting = await getSetting(user.user_id);
        const apiKey = providedApiKey
            || (setting ? decryptApiKey(setting.encryptedApiKey) : '')
            || process.env.GOOGLE_API_KEY?.trim()
            || '';
        if (!apiKey) {
            return noStoreJson({ error: 'Enter a Gemini API key first' }, { status: 400 });
        }

        await validateGeminiConnection(apiKey, model);
        return noStoreJson({
            valid: true,
            keyHint: apiKeyHint(apiKey),
            model,
            testedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Gemini connection test failed:', error instanceof Error ? error.message : error);
        return noStoreJson(
            { error: connectionErrorMessage(error) },
            { status: 422 }
        );
    }
}

export async function PUT(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return noStoreJson({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAiSettingsEncryptionReady()) {
        return noStoreJson(
            { error: 'Server encryption is not configured' },
            { status: 503 }
        );
    }

    try {
        const body = await request.json();
        const model = String(body.model || DEFAULT_GEMINI_MODEL).trim();
        const providedApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        const isEnabled = body.isEnabled !== false;

        if (!isValidGeminiModel(model)) {
            return noStoreJson({ error: 'Invalid Gemini model name' }, { status: 400 });
        }

        const existing = await getSetting(user.user_id);
        const apiKey = providedApiKey
            || (existing ? decryptApiKey(existing.encryptedApiKey) : '');
        if (!apiKey) {
            return noStoreJson({ error: 'Enter a Gemini API key first' }, { status: 400 });
        }

        await validateGeminiConnection(apiKey, model);
        const validatedAt = new Date();
        const setting = await prisma.aiProviderSetting.upsert({
            where: {
                userId_provider: {
                    userId: user.user_id,
                    provider: GEMINI_PROVIDER,
                },
            },
            create: {
                userId: user.user_id,
                provider: GEMINI_PROVIDER,
                encryptedApiKey: encryptApiKey(apiKey),
                keyHint: apiKeyHint(apiKey),
                model,
                isEnabled,
                lastValidatedAt: validatedAt,
            },
            update: {
                ...(providedApiKey ? {
                    encryptedApiKey: encryptApiKey(apiKey),
                    keyHint: apiKeyHint(apiKey),
                } : {}),
                model,
                isEnabled,
                lastValidatedAt: validatedAt,
            },
        });

        return noStoreJson({
            configured: true,
            savedInApp: true,
            source: 'database',
            keyHint: setting.keyHint,
            model: setting.model,
            isEnabled: setting.isEnabled,
            lastValidatedAt: setting.lastValidatedAt,
            encryptionReady: true,
        });
    } catch (error) {
        console.error('Error saving Gemini settings:', error instanceof Error ? error.message : error);
        return noStoreJson(
            { error: connectionErrorMessage(error) },
            { status: 422 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const user = getRequestUser(request);
    if (!user) {
        return noStoreJson({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await prisma.aiProviderSetting.deleteMany({
            where: {
                userId: user.user_id,
                provider: GEMINI_PROVIDER,
            },
        });

        return noStoreJson({
            removed: true,
            fallbackAvailable: Boolean(process.env.GOOGLE_API_KEY?.trim()),
        });
    } catch (error) {
        console.error('Error removing Gemini settings:', error);
        return noStoreJson({ error: 'Failed to remove Gemini settings' }, { status: 500 });
    }
}

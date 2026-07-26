import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { getGeminiRuntimeConfig } from '@/lib/ai-settings';
import { getRequestUser } from '@/lib/server-auth';

const incomeSources = [
    'Salary',
    'Freelance',
    'Investment',
    'Business',
    'Gift',
    'Other',
];

type TransactionType = 'expense' | 'income';

type DraftResult = {
    isTransaction: boolean;
    confidence: number;
    reason?: string;
    draft?: {
        amount?: number;
        category?: string;
        source?: string;
        date?: string;
        description?: string;
        notes?: string;
        accountId?: number | null;
    };
};

function extractJsonObject(text: string) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
    const match = trimmed.match(/\{[\s\S]*\}/);
    return match ? match[0] : trimmed;
}

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: unknown) {
    if (typeof value !== 'string') return todayString();
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return todayString();
    return value;
}

function normalizeDraft(
    parsed: DraftResult,
    type: TransactionType,
    text: string,
    categories: Array<{ name: string }>,
    accounts: Array<{ id: number; name: string }>
) {
    if (!parsed.isTransaction || !parsed.draft) {
        return null;
    }

    const amount = Number(parsed.draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    const accountId = parsed.draft.accountId === null || parsed.draft.accountId === undefined
        ? null
        : Number(parsed.draft.accountId);
    const matchedAccount = Number.isFinite(accountId)
        ? accounts.find((account) => account.id === accountId)
        : null;

    const base = {
        amount,
        date: normalizeDate(parsed.draft.date),
        description: typeof parsed.draft.description === 'string' && parsed.draft.description.trim()
            ? parsed.draft.description.trim()
            : text,
        accountId: matchedAccount ? matchedAccount.id : null,
        accountName: matchedAccount ? matchedAccount.name : null,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
        originalText: text,
    };

    if (type === 'expense') {
        const categoryNames = categories.map((category) => category.name);
        const category = typeof parsed.draft.category === 'string' && parsed.draft.category.trim()
            ? parsed.draft.category.trim()
            : categoryNames.find((name) => name.toLowerCase() === 'other') || 'Other';

        return {
            ...base,
            type,
            category,
        };
    }

    const source = typeof parsed.draft.source === 'string' && parsed.draft.source.trim()
        ? parsed.draft.source.trim()
        : 'Other';

    return {
        ...base,
        type,
        source: incomeSources.includes(source) ? source : 'Other',
        notes: typeof parsed.draft.notes === 'string' ? parsed.draft.notes : '',
    };
}

export async function POST(request: NextRequest) {
    try {
        const user = getRequestUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const geminiConfig = await getGeminiRuntimeConfig(user.user_id);
        if (!geminiConfig) {
            return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
        }

        const { text, type } = await request.json() as { text?: string; type?: TransactionType };
        const transactionType = type === 'income' ? 'income' : 'expense';

        if (!text || !text.trim()) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const [categories, accounts] = await Promise.all([
            prisma.category.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
            prisma.account.findMany({ select: { id: true, name: true, type: true }, orderBy: { createdAt: 'desc' } }),
        ]);

        const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
        const model = genAI.getGenerativeModel({ model: geminiConfig.model });
        const categoryList = categories.map((category) => category.name).join(', ');
        const accountList = accounts
            .map((account) => `${account.id}: ${account.name} (${account.type})`)
            .join('\n');

        const prompt = `You extract a ${transactionType} draft for an expense tracking app from user text.

Return JSON only. Do not include markdown.

Current date: ${todayString()}
Mode: ${transactionType}
Existing categories: ${categoryList || 'Other'}
Income sources: ${incomeSources.join(', ')}
Accounts:
${accountList || 'No accounts'}

User text:
${text}

Rules:
- Parse English or Thai text.
- Do not save anything. Only produce a draft for user review.
- amount must be a positive dollar number.
- date must be YYYY-MM-DD. Resolve today/yesterday/Thai relative dates using Current date.
- accountId must be one of the listed account IDs only when clearly mentioned. Otherwise null.
- If Mode is expense, choose the best existing category, or "Other" if unclear.
- If Mode is income, choose the best income source from the Income sources list, or "Other" if unclear.
- Bank transfers, Zelle transfers, credit card payments, debt payments, and moving money between accounts are not expenses or incomes. Return isTransaction=false for those.

JSON shape:
{
  "isTransaction": boolean,
  "confidence": number,
  "reason": "short reason when not a transaction",
  "draft": {
    "amount": number,
    "category": "expense only",
    "source": "income only",
    "date": "YYYY-MM-DD",
    "description": string,
    "notes": "income optional",
    "accountId": number | null
  }
}`;

        const result = await model.generateContent(prompt);
        const parsed = JSON.parse(extractJsonObject(result.response.text())) as DraftResult;
        const draft = normalizeDraft(parsed, transactionType, text.trim(), categories, accounts);

        if (!draft) {
            return NextResponse.json(
                { error: parsed.reason || `Could not create a ${transactionType} draft from that text.` },
                { status: 422 }
            );
        }

        return NextResponse.json({ draft });
    } catch (error) {
        console.error('Error creating transaction draft:', error);
        return NextResponse.json({ error: 'Failed to create transaction draft' }, { status: 500 });
    }
}

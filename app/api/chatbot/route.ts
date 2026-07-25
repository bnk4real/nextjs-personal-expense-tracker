import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const DETAIL_ROW_LIMIT = 350;

if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set');
}

type DecodedToken = {
    user_id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
};

type TransactionRow = {
    id: number;
    amount: number;
    date: string;
    description: string;
    bucket: string;
    account: string;
};

type MoneyGroup = {
    name: string;
    total: number;
    count: number;
};

type DateRange = {
    label: string;
    start?: string;
    end?: string;
};

function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as DecodedToken;
    } catch {
        return null;
    }
}

function monthBounds(year: number, monthIndex: number): DateRange {
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0));

    return {
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    };
}

function detectDateRange(message: string): DateRange {
    const normalized = message.toLowerCase();
    const now = new Date();
    const thaiMonths = [
        'มกราคม',
        'กุมภาพันธ์',
        'มีนาคม',
        'เมษายน',
        'พฤษภาคม',
        'มิถุนายน',
        'กรกฎาคม',
        'สิงหาคม',
        'กันยายน',
        'ตุลาคม',
        'พฤศจิกายน',
        'ธันวาคม',
    ];
    const englishMonths = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
    ];

    if (/(all time|ทั้งหมด|ทุกเดือน|all transactions)/i.test(message)) {
        return { label: 'all available data' };
    }

    const isoMonth = normalized.match(/\b(20\d{2})-(0?[1-9]|1[0-2])\b/);
    if (isoMonth) {
        return monthBounds(parseInt(isoMonth[1], 10), parseInt(isoMonth[2], 10) - 1);
    }

    const slashMonth = normalized.match(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/);
    if (slashMonth) {
        return monthBounds(parseInt(slashMonth[2], 10), parseInt(slashMonth[1], 10) - 1);
    }

    const matchedEnglishMonth = englishMonths.findIndex((month) => normalized.includes(month));
    if (matchedEnglishMonth >= 0) {
        const yearMatch = normalized.match(/\b20\d{2}\b/);
        return monthBounds(yearMatch ? parseInt(yearMatch[0], 10) : now.getFullYear(), matchedEnglishMonth);
    }

    const matchedThaiMonth = thaiMonths.findIndex((month) => message.includes(month));
    if (matchedThaiMonth >= 0) {
        const yearMatch = message.match(/\b(25\d{2}|20\d{2})\b/);
        const year = yearMatch
            ? (yearMatch[1].startsWith('25') ? parseInt(yearMatch[1], 10) - 543 : parseInt(yearMatch[1], 10))
            : now.getFullYear();
        return monthBounds(year, matchedThaiMonth);
    }

    if (/(last month|เดือนที่แล้ว)/i.test(message)) {
        return monthBounds(now.getFullYear(), now.getMonth() - 1);
    }

    if (/(this month|current month|ทั้งเดือน|เดือนนี้|รายเดือน|monthly)/i.test(message)) {
        return monthBounds(now.getFullYear(), now.getMonth());
    }

    return monthBounds(now.getFullYear(), now.getMonth());
}

function groupRows(rows: TransactionRow[]): MoneyGroup[] {
    const groups = new Map<string, MoneyGroup>();

    rows.forEach((row) => {
        const key = row.bucket || 'Other';
        const current = groups.get(key) || { name: key, total: 0, count: 0 };
        current.total += row.amount;
        current.count += 1;
        groups.set(key, current);
    });

    return [...groups.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function groupByAccount(rows: TransactionRow[]): MoneyGroup[] {
    const groups = new Map<string, MoneyGroup>();

    rows.forEach((row) => {
        const key = row.account || 'No account';
        const current = groups.get(key) || { name: key, total: 0, count: 0 };
        current.total += row.amount;
        current.count += 1;
        groups.set(key, current);
    });

    return [...groups.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function merchantKey(description: string) {
    return description
        .replace(/\b\d{2}\/\d{2}\b/g, '')
        .replace(/\b\d{4,}\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 70) || 'Other';
}

function groupByMerchant(rows: TransactionRow[]): MoneyGroup[] {
    const groups = new Map<string, MoneyGroup>();

    rows.forEach((row) => {
        const key = merchantKey(row.description);
        const current = groups.get(key) || { name: key, total: 0, count: 0 };
        current.total += row.amount;
        current.count += 1;
        groups.set(key, current);
    });

    return [...groups.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).slice(0, 30);
}

function money(value: number) {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function dateWhere(range: DateRange) {
    if (!range.start || !range.end) return undefined;
    return {
        gte: range.start,
        lte: range.end,
    };
}

async function getUserFinancialContext(userId: string, message: string) {
    const range = detectDateRange(message);
    const where = dateWhere(range);

    const [expenses, incomes, transfers, accounts, categories, subscriptions] = await Promise.all([
        prisma.expense.findMany({
            where: where ? { date: where } : undefined,
            include: { account: true },
            orderBy: { date: 'desc' },
            take: 5000,
        }),
        prisma.income.findMany({
            where: where ? { date: where } : undefined,
            include: { account: true },
            orderBy: { date: 'desc' },
            take: 5000,
        }),
        prisma.transfer.findMany({
            where: where ? { date: where } : undefined,
            include: { fromAccount: true, toAccount: true },
            orderBy: { date: 'desc' },
            take: 5000,
        }),
        prisma.account.findMany({ orderBy: { name: 'asc' } }),
        prisma.category.findMany({ orderBy: { name: 'asc' } }),
        prisma.subscriptions.findMany({
            where: { user_id: userId },
            orderBy: { next_payment_date: 'asc' },
            take: 50,
        }),
    ]);

    const expenseRows: TransactionRow[] = expenses.map((expense) => ({
        id: expense.id,
        amount: expense.amount,
        date: expense.date,
        description: expense.description,
        bucket: expense.category || 'Other',
        account: expense.account?.name || 'No account',
    }));
    const incomeRows: TransactionRow[] = incomes.map((income) => ({
        id: income.id,
        amount: income.amount,
        date: income.date,
        description: income.description,
        bucket: income.source || 'Other',
        account: income.account?.name || 'No account',
    }));

    const totalExpenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);
    const totalIncomes = incomeRows.reduce((sum, row) => sum + row.amount, 0);
    const totalTransfers = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);

    return {
        range,
        summary: {
            expenseCount: expenseRows.length,
            incomeCount: incomeRows.length,
            transferCount: transfers.length,
            totalExpenses,
            totalIncomes,
            totalTransfers,
            netCashflow: totalIncomes - totalExpenses,
            accountsTotal: accounts.reduce((sum, account) => sum + account.balance, 0),
        },
        expenseGroups: {
            byCategory: groupRows(expenseRows),
            byAccount: groupByAccount(expenseRows),
            byMerchant: groupByMerchant(expenseRows),
        },
        incomeGroups: {
            bySource: groupRows(incomeRows),
            byAccount: groupByAccount(incomeRows),
        },
        detailRows: {
            expensesIncluded: Math.min(expenseRows.length, DETAIL_ROW_LIMIT),
            incomesIncluded: Math.min(incomeRows.length, DETAIL_ROW_LIMIT),
            expenses: expenseRows.slice(0, DETAIL_ROW_LIMIT),
            incomes: incomeRows.slice(0, DETAIL_ROW_LIMIT),
        },
        accounts: accounts.map((account) => ({
            name: account.name,
            type: account.type,
            balance: account.balance,
            creditLimit: account.creditLimit,
        })),
        categories: categories.map((category) => category.name),
        transfers: transfers.slice(0, 100).map((transfer) => ({
            date: transfer.date,
            amount: transfer.amount,
            description: transfer.description,
            from: transfer.fromAccount?.name || null,
            to: transfer.toAccount?.name || null,
            affectsBalance: transfer.affectsBalance,
        })),
        subscriptions: subscriptions.map((subscription) => ({
            name: subscription.name,
            provider: subscription.provider,
            amount: subscription.price_cents / 100,
            billingCycle: subscription.billing_cycle,
            nextPayment: subscription.next_payment_date,
            status: subscription.status,
        })),
    };
}

function formatGroups(groups: MoneyGroup[]) {
    if (groups.length === 0) return '- none';
    return groups
        .map((group) => `- ${group.name}: ${money(group.total)} (${group.count} txns)`)
        .join('\n');
}

function formatDetailRows(rows: TransactionRow[]) {
    if (rows.length === 0) return '- none';
    return rows
        .map((row) => `- ${row.date} | ${money(row.amount)} | ${row.bucket} | ${row.description} | ${row.account}`)
        .join('\n');
}

function buildSystemPrompt(context: Awaited<ReturnType<typeof getUserFinancialContext>>) {
    const rangeLabel = context.range.start && context.range.end
        ? `${context.range.label} (${context.range.start} to ${context.range.end})`
        : context.range.label;

    return `You are a male Thai-speaking financial assistant inside a personal expense tracker app.

Persona and language:
- Default to Thai for every answer. Do not drift into English just because financial field names are English.
- Only answer in English if the latest user message explicitly asks for English.
- Always speak as a male assistant.
- Use consistent masculine Thai particles such as "ครับ"; never switch to feminine particles such as "ค่ะ" or "คะ".
- If the user writes Thai, answer fully in Thai.
- Be direct, warm, and practical. Do not over-apologize.

Data rules:
- Use only the financial data provided below.
- Expenses, incomes, and transfers are separate. Transfers are not income and not expense.
- Do not claim you can only see 10 transactions. The provided aggregate groups are computed from the full query result.
- If detail rows are truncated, explain that the aggregates are complete but the raw row list is shortened for context size.
- When asked to break down a month, prefer grouped totals first, then notable merchants/categories.
- For calculations, show totals and counts.
- Current date is ${new Date().toISOString().split('T')[0]}.

Data range: ${rangeLabel}

Summary:
- Expense total: ${money(context.summary.totalExpenses)} (${context.summary.expenseCount} transactions)
- Income total: ${money(context.summary.totalIncomes)} (${context.summary.incomeCount} transactions)
- Net cashflow: ${money(context.summary.netCashflow)}
- Transfer movement: ${money(context.summary.totalTransfers)} (${context.summary.transferCount} transfers)
- Account balances total: ${money(context.summary.accountsTotal)}

Expense breakdown by category (complete for this data range):
${formatGroups(context.expenseGroups.byCategory)}

Expense breakdown by account (complete for this data range):
${formatGroups(context.expenseGroups.byAccount)}

Top merchant/description groups:
${formatGroups(context.expenseGroups.byMerchant)}

Income breakdown by source:
${formatGroups(context.incomeGroups.bySource)}

Accounts:
${context.accounts.map((account) => `- ${account.name} (${account.type}): balance ${money(account.balance)}${account.creditLimit ? `, limit ${money(account.creditLimit)}` : ''}`).join('\n') || '- none'}

Upcoming subscriptions:
${context.subscriptions.map((subscription) => `- ${subscription.name}${subscription.provider ? ` (${subscription.provider})` : ''}: ${money(subscription.amount)}/${subscription.billingCycle}, ${subscription.status}, next ${subscription.nextPayment || 'n/a'}`).join('\n') || '- none'}

Expense detail rows (${context.detailRows.expensesIncluded} of ${context.summary.expenseCount} included):
${formatDetailRows(context.detailRows.expenses)}

Income detail rows (${context.detailRows.incomesIncluded} of ${context.summary.incomeCount} included):
${formatDetailRows(context.detailRows.incomes)}`;
}

function normalizeMaleThaiTone(text: string) {
    return text
        .replace(/นะค่ะ/g, 'นะครับ')
        .replace(/นะคะ/g, 'นะครับ')
        .replace(/ค่ะ/g, 'ครับ')
        .replace(/คะ/g, 'ครับ')
        .replace(/จ้า/g, 'ครับ')
        .replace(/จ๊ะ/g, 'ครับ');
}

function titleFromMessage(message: string) {
    const cleaned = message.replace(/\s+/g, ' ').trim();
    return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned || 'New chat';
}

async function findOrCreateSession(userId: string, sessionId: string | null, message: string) {
    if (sessionId) {
        const existing = await prisma.chatSession.findFirst({
            where: { id: sessionId, user_id: userId },
        });
        if (existing) return existing;
    }

    return prisma.chatSession.create({
        data: {
            user_id: userId,
            title: titleFromMessage(message),
        },
    });
}

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (sessionId) {
            const session = await prisma.chatSession.findFirst({
                where: { id: sessionId, user_id: decoded.user_id },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                    },
                },
            });

            if (!session) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            return NextResponse.json({ session });
        }

        const sessions = await prisma.chatSession.findMany({
            where: { user_id: decoded.user_id },
            orderBy: { updatedAt: 'desc' },
            take: 30,
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        return NextResponse.json({ sessions });
    } catch (error) {
        console.error('Error loading chat sessions:', error);
        return NextResponse.json({ error: 'Failed to load chat sessions' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
        }

        const { message, sessionId } = await request.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const session = await findOrCreateSession(decoded.user_id, sessionId || null, message);
        await prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                role: 'user',
                content: message.trim(),
            },
        });

        const [financialContext, conversationMessages] = await Promise.all([
            getUserFinancialContext(decoded.user_id, message),
            prisma.chatMessage.findMany({
                where: { sessionId: session.id },
                orderBy: { createdAt: 'desc' },
                take: 24,
            }),
        ]);

        const systemPrompt = buildSystemPrompt(financialContext);
        const conversationContext = conversationMessages
            .reverse()
            .map((chatMessage) => `${chatMessage.role === 'assistant' ? 'Assistant' : 'User'}: ${chatMessage.content}`)
            .join('\n');

        const prompt = `${systemPrompt}

Conversation in this session:
${conversationContext}

Answer the latest user message now.`;

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const aiResponse = normalizeMaleThaiTone(result.response.text());

        await prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                role: 'assistant',
                content: aiResponse,
            },
        });
        await prisma.chatSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date() },
        });

        return NextResponse.json({
            response: aiResponse,
            sessionId: session.id,
            sessionTitle: session.title,
            dataRange: financialContext.range,
            counts: {
                expenses: financialContext.summary.expenseCount,
                incomes: financialContext.summary.incomeCount,
                transfers: financialContext.summary.transferCount,
            },
        });

    } catch (error) {
        console.error('Error in chatbot API:', error);

        if (error instanceof Error && error.message.includes('not found')) {
            console.log('Model not found. Available Gemini models typically include: gemini-pro, gemini-1.5-pro');
        }

        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { summarizeBudget } from '@/lib/budget';
import { getGeminiRuntimeConfig } from '@/lib/ai-settings';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const DETAIL_ROW_LIMIT = 350;

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

const DATE_REFERENCE_PATTERN = new RegExp([
    'all time',
    'ทั้งหมด',
    'ทุกเดือน',
    'all transactions',
    '20\\d{2}-(?:0?[1-9]|1[0-2])',
    '(?:0?[1-9]|1[0-2])/20\\d{2}',
    'last month',
    'เดือนที่แล้ว',
    'this month',
    'current month',
    'ทั้งเดือน',
    'เดือนนี้',
    'รายเดือน',
    'monthly',
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
].join('|'), 'i');

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

function contextMessageForDateRange(
    latestMessage: string,
    conversationMessages: Array<{ role: string; content: string }>
) {
    if (DATE_REFERENCE_PATTERN.test(latestMessage)) return latestMessage;

    const previousDateMessage = conversationMessages.find((chatMessage) => (
        chatMessage.role === 'user'
        && chatMessage.content.trim() !== latestMessage.trim()
        && DATE_REFERENCE_PATTERN.test(chatMessage.content)
    ));

    return previousDateMessage
        ? `${latestMessage}\nPrevious date context: ${previousDateMessage.content}`
        : latestMessage;
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

    const [expenses, incomes, transfers, accounts, categories, subscriptions, monthlyBudgets] = await Promise.all([
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
        prisma.monthlyBudget.findMany({
            where: { userId },
            include: { categoryLimits: true },
            orderBy: { month: 'desc' },
            take: 24,
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
    const requestedMonth = range.start?.slice(0, 7) || null;
    const monthlyBudget = requestedMonth
        ? monthlyBudgets.find((budget) => budget.month === requestedMonth) || null
        : null;
    const monthlyBudgetSummary = monthlyBudget
        ? summarizeBudget(monthlyBudget, expenses)
        : null;
    const allocatedCents = monthlyBudget?.categoryLimits.reduce(
        (total, limit) => total + limit.amountCents,
        0
    ) || 0;

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
        budget: monthlyBudget && monthlyBudgetSummary ? {
            month: monthlyBudget.month,
            goal: monthlyBudget.amountCents / 100,
            warningThreshold: monthlyBudget.warningThreshold,
            spent: monthlyBudgetSummary.spentCents / 100,
            remaining: monthlyBudgetSummary.remainingCents / 100,
            percentUsed: monthlyBudgetSummary.percentUsed,
            status: monthlyBudgetSummary.status,
            allocated: allocatedCents / 100,
            unallocated: (monthlyBudget.amountCents - allocatedCents) / 100,
            allocations: monthlyBudget.categoryLimits.map((limit) => {
                const actual = monthlyBudgetSummary.categoryBreakdown.find(
                    (category) => category.category === limit.category
                );
                return {
                    category: limit.category,
                    goal: limit.amountCents / 100,
                    spent: (actual?.spentCents || 0) / 100,
                    remaining: (limit.amountCents - (actual?.spentCents || 0)) / 100,
                    percentUsed: actual?.percentUsed || 0,
                    status: actual?.status || 'on-track',
                };
            }),
        } : null,
        budgetHistory: monthlyBudgets.map((budget) => ({
            month: budget.month,
            goal: budget.amountCents / 100,
            allocated: budget.categoryLimits.reduce(
                (total, limit) => total + limit.amountCents,
                0
            ) / 100,
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

function formatBudgetContext(context: Awaited<ReturnType<typeof getUserFinancialContext>>) {
    if (!context.budget) {
        const history = context.budgetHistory.length > 0
            ? context.budgetHistory
                .map((budget) => `- ${budget.month}: goal ${money(budget.goal)}, allocated ${money(budget.allocated)}`)
                .join('\n')
            : '- none';

        return `No monthly budget is set for ${context.range.label}.
Do not invent a budget goal for this range.

Available budget history:
${history}`;
    }

    const budget = context.budget;
    const remainingLabel = budget.remaining >= 0
        ? `Remaining: ${money(budget.remaining)}`
        : `Over budget by: ${money(Math.abs(budget.remaining))}`;
    const allocations = budget.allocations.length > 0
        ? budget.allocations.map((allocation) => {
            const allocationRemaining = allocation.remaining >= 0
                ? `${money(allocation.remaining)} remaining`
                : `${money(Math.abs(allocation.remaining))} over`;
            return `- ${allocation.category}: goal ${money(allocation.goal)}, spent ${money(allocation.spent)}, ${allocationRemaining}, ${allocation.percentUsed.toFixed(1)}% used`;
        }).join('\n')
        : '- none; the full budget is flexible';

    return `Monthly budget for ${budget.month}:
- Budget goal: ${money(budget.goal)}
- Actual expenses: ${money(budget.spent)}
- ${remainingLabel}
- Used: ${budget.percentUsed.toFixed(1)}%
- Status: ${budget.status}
- Warning threshold: ${budget.warningThreshold}%
- Allocated to categories: ${money(budget.allocated)}
- Flexible/unallocated: ${money(budget.unallocated)}

Category allocations:
${allocations}`;
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
- A budget goal is the planned MonthlyBudget amount. It is not income, account balance, credit limit, or past spending.
- When asked for the budget goal, state the exact goal first, then spent and remaining if useful.
- "Remaining budget" means budget goal minus actual expenses. "Unallocated" means the portion not assigned to a category; these are different values.
- Category allocations are parts of the monthly budget and must not be added on top of the monthly budget goal.
- If no budget exists for the requested month, say clearly that no budget is set. Never infer one from expenses or income.
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

Budget:
${formatBudgetContext(context)}

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

function cleanGeneratedTitle(value: string, fallback: string) {
    const cleaned = value
        .split('\n')[0]
        .replace(/^(title|session title|ชื่อแชต|ชื่อเรื่อง)\s*:\s*/i, '')
        .replace(/^[#*`"'“”‘’\s]+|[#*`"'“”‘’\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return titleFromMessage(fallback);
    return cleaned.length > 60 ? `${cleaned.slice(0, 57).trim()}...` : cleaned;
}

async function findOrCreateSession(userId: string, sessionId: string | null, message: string) {
    if (sessionId) {
        const existing = await prisma.chatSession.findFirst({
            where: { id: sessionId, user_id: userId },
        });
        if (existing) return { session: existing, isNew: false };
    }

    const session = await prisma.chatSession.create({
        data: {
            user_id: userId,
            title: titleFromMessage(message),
        },
    });
    return { session, isNew: true };
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

        const geminiConfig = await getGeminiRuntimeConfig(decoded.user_id);
        if (!geminiConfig) {
            return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
        }

        const { message, sessionId } = await request.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const { session, isNew } = await findOrCreateSession(decoded.user_id, sessionId || null, message);
        await prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                role: 'user',
                content: message.trim(),
            },
        });

        const conversationMessages = await prisma.chatMessage.findMany({
            where: { sessionId: session.id },
            orderBy: { createdAt: 'desc' },
            take: 24,
        });
        const contextMessage = contextMessageForDateRange(message, conversationMessages);
        const financialContext = await getUserFinancialContext(decoded.user_id, contextMessage);

        const systemPrompt = buildSystemPrompt(financialContext);
        const conversationContext = conversationMessages
            .reverse()
            .map((chatMessage) => `${chatMessage.role === 'assistant' ? 'Assistant' : 'User'}: ${chatMessage.content}`)
            .join('\n');

        const prompt = `${systemPrompt}

Conversation in this session:
${conversationContext}

Answer the latest user message now.`;

        const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
        const model = genAI.getGenerativeModel({ model: geminiConfig.model });
        const titlePromise = isNew
            ? model.generateContent(`Create a concise session title for the user's first message below.
Rules:
- Use the same language as the message.
- Summarize the main intent, not the exact full sentence.
- Use 3 to 7 words when the language naturally uses spaces.
- Do not answer the question.
- Return only the title with no quotes, markdown, label, or ending punctuation.

User message:
${message.trim()}`).then((titleResult) => cleanGeneratedTitle(titleResult.response.text(), message))
                .catch(() => titleFromMessage(message))
            : Promise.resolve(session.title);
        const [result, sessionTitle] = await Promise.all([
            model.generateContent(prompt),
            titlePromise,
        ]);
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
            data: {
                updatedAt: new Date(),
                ...(isNew ? { title: sessionTitle } : {}),
            },
        });

        return NextResponse.json({
            response: aiResponse,
            sessionId: session.id,
            sessionTitle,
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

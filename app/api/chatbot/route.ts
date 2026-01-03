/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set');
}

// Helper function to verify JWT token
function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { user_id: string; username: string; email: string; firstName: string; lastName: string };
    } catch {
        return null;
    }
}

// Helper function to get user financial data
async function getUserFinancialData(userId: string) {
    try {
        const [expenses, incomes, accounts, categories, subscriptions] = await Promise.all([
            prisma.expense.findMany({
                include: { account: true },
                orderBy: { date: 'desc' },
                take: 50
            }),
            prisma.income.findMany({
                include: { account: true },
                orderBy: { date: 'desc' },
                take: 50
            }),
            prisma.account.findMany(),
            prisma.category.findMany(),
            prisma.subscriptions.findMany({
                where: { user_id: userId },
                orderBy: { next_payment_date: 'asc' },
                take: 20
            })
        ]);

        return {
            expenses,
            incomes,
            accounts,
            categories,
            subscriptions
        };
    } catch (error) {
        console.error('Error fetching financial data:', error);
        return null;
    }
}

// Function to format financial data for AI context
function formatFinancialContext(data: {
    expenses: any[];
    incomes: any[];
    accounts: any[];
    categories: any[];
    subscriptions: any[];
}) {
    const { expenses, incomes, accounts, categories, subscriptions } = data;

    const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const totalIncomes = incomes.reduce((sum: number, inc: any) => sum + inc.amount, 0);
    const totalAssets = accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);

    const recentExpenses = expenses.slice(0, 10).map((exp: any) => ({
        amount: exp.amount,
        category: exp.category,
        date: exp.date,
        description: exp.description,
        account: exp.account?.name
    }));

    const recentIncomes = incomes.slice(0, 10).map((inc: any) => ({
        amount: inc.amount,
        category: inc.category,
        date: inc.date,
        description: inc.description,
        account: inc.account?.name
    }));

    const upcomingSubscriptions = subscriptions
        .filter((sub: any) => sub.next_payment_date)
        .slice(0, 5)
        .map((sub: any) => ({
            name: sub.name,
            provider: sub.provider,
            amount: (sub.price_cents / 100).toFixed(2),
            billingCycle: sub.billing_cycle,
            nextPayment: sub.next_payment_date
        }));

    return {
        summary: {
            totalExpenses: totalExpenses.toFixed(2),
            totalIncomes: totalIncomes.toFixed(2),
            totalAssets: totalAssets.toFixed(2),
            netWorth: (totalAssets - totalExpenses + totalIncomes).toFixed(2)
        },
        recentExpenses,
        recentIncomes,
        accounts: accounts.map((acc: any) => ({
            name: acc.name,
            type: acc.type,
            balance: acc.balance.toFixed(2)
        })),
        categories: categories.map((cat: any) => cat.name),
        upcomingSubscriptions
    };
}

export async function POST(request: NextRequest) {
    try {
        // Check for token in cookies first, then Authorization header
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

        const { message, conversationHistory } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Get user's financial data
        const financialData = await getUserFinancialData(decoded.user_id);
        if (!financialData) {
            return NextResponse.json({ error: 'Failed to fetch financial data' }, { status: 500 });
        }

        const context = formatFinancialContext(financialData);

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Create context prompt
        const systemPrompt = `You are a helpful financial assistant for an expense tracking app. You have access to the user's financial data and can answer questions about their accounts, expenses, incomes, subscriptions, and financial health.

User's Financial Summary:
- Total Expenses: $${context.summary.totalExpenses}
- Total Incomes: $${context.summary.totalIncomes}
- Total Assets: $${context.summary.totalAssets}
- Net Worth: $${context.summary.netWorth}

Recent Expenses (last 10):
${context.recentExpenses.map((exp: any) => `- $${exp.amount} for ${exp.description} in ${exp.category} on ${exp.date}${exp.account ? ` (${exp.account})` : ''}`).join('\n')}

Recent Incomes (last 10):
${context.recentIncomes.map((inc: any) => `- $${inc.amount} for ${inc.description} in ${inc.category} on ${inc.date}${inc.account ? ` (${inc.account})` : ''}`).join('\n')}

Accounts:
${context.accounts.map((acc: any) => `- ${acc.name} (${acc.type}): $${acc.balance}`).join('\n')}

Categories: ${context.categories.join(', ')}

Upcoming Subscriptions:
${context.upcomingSubscriptions.map((sub: any) => `- ${sub.name} (${sub.provider}): $${sub.amount}/${sub.billingCycle}, next payment: ${sub.nextPayment}`).join('\n')}

Instructions:
- Be helpful, accurate, and concise
- Use the financial data provided to answer questions
- If asked about trends or analysis, use the data to provide insights
- For calculations, show your work
- If data is not available, say so clearly
- Keep responses conversational but professional
- Current date is ${new Date().toLocaleDateString()}

${conversationHistory && conversationHistory.length > 0 ?
    `Previous conversation:\n${conversationHistory.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')}\n\n` : ''
}User question: ${message}`;

        // Generate response
        const result = await model.generateContent(systemPrompt);
        const response = result.response;
        const aiResponse = response.text();

        return NextResponse.json({ response: aiResponse });

    } catch (error) {
        console.error('Error in chatbot API:', error);

        // If model not found, try alternative models
        if (error instanceof Error && error.message && error.message.includes('not found')) {
            console.log('Model not found. Available Gemini models typically include: gemini-pro, gemini-1.5-pro');
        }

        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}
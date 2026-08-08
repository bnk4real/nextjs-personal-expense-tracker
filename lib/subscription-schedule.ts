import type { subscriptions } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
    firstPaymentOnOrAfter,
} from '@/lib/recurring-payments';

function startOfToday() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
}

export async function ensureNextSubscriptionPayment(subscription: subscriptions) {
    if (subscription.status !== 'active') {
        if (subscription.next_payment_date) {
            await prisma.subscriptions.update({
                where: { id: subscription.id },
                data: { next_payment_date: null },
            });
        }
        return null;
    }

    const today = startOfToday();
    const existingFuture = await prisma.subscriptionPayment.findFirst({
        where: {
            subscriptionId: subscription.id,
            status: 'pending',
            dueDate: { gte: today },
        },
        orderBy: { dueDate: 'asc' },
    });

    const latestPayment = await prisma.subscriptionPayment.findFirst({
        where: {
            subscriptionId: subscription.id,
            OR: [
                { dueDate: { lt: today } },
                { status: { not: 'pending' } },
            ],
        },
        orderBy: { dueDate: 'desc' },
    });
    let dueDate = firstPaymentOnOrAfter(
        subscription.start_date,
        subscription.billing_cycle,
        today,
        latestPayment?.dueDate
    );

    if (existingFuture?.dueDate.getTime() === dueDate.getTime()) {
        if (subscription.next_payment_date?.getTime() !== existingFuture.dueDate.getTime()) {
            await prisma.subscriptions.update({
                where: { id: subscription.id },
                data: { next_payment_date: existingFuture.dueDate },
            });
        }
        return existingFuture;
    }

    if (existingFuture) {
        await prisma.subscriptionPayment.delete({ where: { id: existingFuture.id } });
    }

    // Avoid reusing a date that already has a paid/cancelled historical record.
    for (let index = 0; index < 5000; index += 1) {
        const sameDate = await prisma.subscriptionPayment.findFirst({
            where: { subscriptionId: subscription.id, dueDate },
        });
        if (!sameDate) break;
        if (sameDate.status === 'pending') {
            await prisma.subscriptions.update({
                where: { id: subscription.id },
                data: { next_payment_date: sameDate.dueDate },
            });
            return sameDate;
        }
        dueDate = firstPaymentOnOrAfter(
            subscription.start_date,
            subscription.billing_cycle,
            today,
            dueDate
        );
    }

    if (subscription.end_date && dueDate > subscription.end_date) {
        await prisma.subscriptions.update({
            where: { id: subscription.id },
            data: { next_payment_date: null, status: 'cancelled' },
        });
        return null;
    }

    const payment = await prisma.subscriptionPayment.upsert({
        where: {
            subscriptionId_dueDate: {
                subscriptionId: subscription.id,
                dueDate,
            },
        },
        create: {
            subscriptionId: subscription.id,
            amount: subscription.price_cents,
            currency: subscription.currency,
            dueDate,
            status: 'pending',
        },
        update: {},
    });
    await prisma.subscriptions.update({
        where: { id: subscription.id },
        data: { next_payment_date: dueDate },
    });
    return payment;
}

export async function ensureUserSubscriptionSchedules(userId: string) {
    const subscriptions = await prisma.subscriptions.findMany({
        where: { user_id: userId },
    });
    await Promise.all(subscriptions.map(ensureNextSubscriptionPayment));
}

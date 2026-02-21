import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateNextPaymentDate } from '@/lib/recurring-payments';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to verify JWT token
function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { user_id: string; username: string; email: string; firstName: string; lastName: string };
    } catch {
        return null;
    }
}

// POST /api/admin/migrate-payments - Migrate existing subscription payments
export async function POST(request: NextRequest) {
    try {
        // Verify admin access (you might want to add an admin role check)
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        console.log('🚀 Starting migration of existing subscription payments...');
        
        // Get all existing subscriptions for this user
        const subscriptions = await prisma.subscriptions.findMany({
            where: {
                user_id: decoded.user_id,
                status: 'active'
            }
        });

        console.log(`📊 Found ${subscriptions.length} active subscriptions to process`);

        const results = [];
        let totalPaymentsCreated = 0;
        let totalSubscriptionsUpdated = 0;

        for (const subscription of subscriptions) {
            console.log(`\n🔄 Processing: ${subscription.name}`);
            
            // Check if payments already exist for this subscription
            const existingPayments = await prisma.subscriptionPayment.findMany({
                where: {
                    subscriptionId: subscription.id
                }
            });

            const subscriptionResult = {
                name: subscription.name,
                existingPayments: existingPayments.length,
                newPayments: 0,
                skipped: existingPayments.length > 0,
                billingCycle: subscription.billing_cycle,
                startDate: subscription.start_date
            };

            if (existingPayments.length > 0) {
                console.log(`⏭️  Skipping ${subscription.name} - already has ${existingPayments.length} payments`);
                results.push(subscriptionResult);
                continue;
            }

            const paymentsToCreate = [];
            let currentDate = new Date(subscription.start_date);
            const now = new Date();

            // Generate payment history from start date to now
            while (currentDate < now) {
                const nextPaymentDate = calculateNextPaymentDate(currentDate, subscription.billing_cycle);
                
                // Only create payments that are due before now
                if (nextPaymentDate <= now) {
                    paymentsToCreate.push({
                        subscriptionId: subscription.id,
                        amount: subscription.price_cents,
                        currency: subscription.currency,
                        dueDate: nextPaymentDate,
                        paymentDate: nextPaymentDate, // Assume past payments were made on time
                        status: 'paid' as const,
                        paymentMethod: 'migrated' as const,
                    });
                    
                    currentDate = nextPaymentDate;
                } else {
                    break;
                }
            }

            // Create the next upcoming payment
            const nextPaymentDate = calculateNextPaymentDate(currentDate, subscription.billing_cycle);
            paymentsToCreate.push({
                subscriptionId: subscription.id,
                amount: subscription.price_cents,
                currency: subscription.currency,
                dueDate: nextPaymentDate,
                status: 'pending' as const,
            });

            // Update the subscription's next_payment_date if it's not set or outdated
            if (!subscription.next_payment_date || new Date(subscription.next_payment_date) < nextPaymentDate) {
                await prisma.subscriptions.update({
                    where: { id: subscription.id },
                    data: { next_payment_date: nextPaymentDate }
                });
                totalSubscriptionsUpdated++;
            }

            // Create payments in batches
            if (paymentsToCreate.length > 0) {
                await prisma.subscriptionPayment.createMany({
                    data: paymentsToCreate,
                    skipDuplicates: true
                });
                
                totalPaymentsCreated += paymentsToCreate.length;
                subscriptionResult.newPayments = paymentsToCreate.length;
                
                console.log(`✅ Created ${paymentsToCreate.length} payments for ${subscription.name}`);
                console.log(`   - ${paymentsToCreate.filter(p => p.status === 'paid').length} paid payments`);
                console.log(`   - ${paymentsToCreate.filter(p => p.status === 'pending').length} upcoming payments`);
            }

            results.push(subscriptionResult);
        }

        console.log(`\n🎉 Migration completed successfully!`);
        console.log(`📈 Total payments created: ${totalPaymentsCreated}`);
        console.log(`🔄 Total subscriptions updated: ${totalSubscriptionsUpdated}`);

        return NextResponse.json({
            success: true,
            message: 'Migration completed successfully',
            summary: {
                totalSubscriptions: subscriptions.length,
                totalPaymentsCreated,
                totalSubscriptionsUpdated,
                results
            }
        });

    } catch (error) {
        console.error('❌ Migration failed:', error);
        return NextResponse.json(
            { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

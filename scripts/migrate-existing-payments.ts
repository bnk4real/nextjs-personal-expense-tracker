/**
 * Migration script to backfill existing subscription payments
 * This script creates payment records for existing subscriptions based on their start dates
 */

import { PrismaClient } from '@prisma/client';
import { calculateNextPaymentDate } from '../lib/recurring-payments';

const prisma = new PrismaClient();

async function migrateExistingPayments() {
    console.log('🚀 Starting migration of existing subscription payments...');
    
    try {
        // Get all existing subscriptions
        const subscriptions = await prisma.subscriptions.findMany({
            where: {
                status: 'active'
            }
        });

        console.log(`📊 Found ${subscriptions.length} active subscriptions to process`);

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

            if (existingPayments.length > 0) {
                console.log(`⏭️  Skipping ${subscription.name} - already has ${existingPayments.length} payments`);
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
                console.log(`✅ Created ${paymentsToCreate.length} payments for ${subscription.name}`);
                console.log(`   - ${paymentsToCreate.filter(p => p.status === 'paid').length} paid payments`);
                console.log(`   - ${paymentsToCreate.filter(p => p.status === 'pending').length} upcoming payments`);
            }
        }

        console.log(`\n🎉 Migration completed successfully!`);
        console.log(`📈 Total payments created: ${totalPaymentsCreated}`);
        console.log(`🔄 Total subscriptions updated: ${totalSubscriptionsUpdated}`);
        
        // Summary by billing cycle
        const paymentsByCycle = await prisma.$queryRaw`
            SELECT 
                s.billing_cycle,
                COUNT(*) as payment_count,
                COUNT(CASE WHEN sp.status = 'paid' THEN 1 END) as paid_count,
                COUNT(CASE WHEN sp.status = 'pending' THEN 1 END) as pending_count
            FROM subscriptions s
            JOIN subscription_payments sp ON s.id = sp."subscriptionId"
            GROUP BY s.billing_cycle
            ORDER BY payment_count DESC
        `;
        
        console.log('\n📊 Payment summary by billing cycle:');
        console.table(paymentsByCycle);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the migration
if (require.main === module) {
    migrateExistingPayments()
        .then(() => {
            console.log('✨ Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

export { migrateExistingPayments };

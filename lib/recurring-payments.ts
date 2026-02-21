/**
 * Recurring payment calculation and management utilities
 */

export interface PaymentSchedule {
  dueDate: Date;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
}

export interface RecurringPaymentOptions {
  billingCycle: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  priceCents: number;
  currency: string;
}

/**
 * Calculate the next payment date based on billing cycle
 */
export function calculateNextPaymentDate(
  fromDate: Date,
  billingCycle: string
): Date {
  const date = new Date(fromDate.getTime());

  switch (billingCycle) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case 'quarterly':
      date.setUTCMonth(date.getUTCMonth() + 3);
      break;
    case 'yearly':
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
    default:
      date.setUTCMonth(date.getUTCMonth() + 1);
  }

  return date;
}

/**
 * Generate a payment schedule for a subscription
 */
export function generatePaymentSchedule(
  options: RecurringPaymentOptions,
  maxPayments: number = 12
): PaymentSchedule[] {
  const schedule: PaymentSchedule[] = [];
  let currentDate = new Date(options.startDate.getTime());

  for (let i = 0; i < maxPayments; i++) {
    currentDate = calculateNextPaymentDate(currentDate, options.billingCycle);
    
    // Stop if we have an end date and we've passed it
    if (options.endDate && currentDate > options.endDate) {
      break;
    }

    schedule.push({
      dueDate: new Date(currentDate.getTime()),
      amount: options.priceCents,
      currency: options.currency,
      status: 'pending'
    });
  }

  return schedule;
}

/**
 * Get upcoming payments within a date range
 */
export function getUpcomingPayments(
  payments: PaymentSchedule[],
  fromDate: Date = new Date(),
  daysAhead: number = 30
): PaymentSchedule[] {
  const toDate = new Date(fromDate.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  return payments.filter(payment => 
    payment.dueDate >= fromDate && 
    payment.dueDate <= toDate &&
    payment.status === 'pending'
  ).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Get overdue payments
 */
export function getOverduePayments(
  payments: PaymentSchedule[],
  asOfDate: Date = new Date()
): PaymentSchedule[] {
  return payments.filter(payment => 
    payment.dueDate < asOfDate && 
    payment.status === 'pending'
  ).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Calculate monthly cost from payment schedule
 */
export function calculateMonthlyCost(payments: PaymentSchedule[]): number {
  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  
  return payments
    .filter(payment => {
      const paymentDate = new Date(payment.dueDate);
      return paymentDate.getUTCMonth() === currentMonth &&
             paymentDate.getUTCFullYear() === currentYear &&
             payment.status === 'paid';
    })
    .reduce((total, payment) => total + (payment.amount / 100), 0);
}

/**
 * Estimate monthly cost from subscription billing cycles
 */
export function estimateMonthlyCost(subscriptions: Array<{
  price_cents: number;
  billing_cycle: string;
  status: string;
}>): number {
  return subscriptions.reduce((total, sub) => {
    if (sub.status !== 'active') return total;
    
    switch (sub.billing_cycle) {
      case 'monthly':
        return total + (sub.price_cents / 100);
      case 'yearly':
        return total + (sub.price_cents / 100) / 12;
      case 'quarterly':
        return total + (sub.price_cents / 100) / 3;
      case 'weekly':
        return total + (sub.price_cents / 100) * 4.33; // Average weeks per month
      case 'daily':
        return total + (sub.price_cents / 100) * 30;
      default:
        return total;
    }
  }, 0);
}

/**
 * Check if a payment is overdue
 */
export function isPaymentOverdue(dueDate: Date, asOfDate: Date = new Date()): boolean {
  return dueDate < asOfDate;
}

/**
 * Get payment status with overdue check
 */
export function getPaymentStatus(
  payment: PaymentSchedule,
  asOfDate: Date = new Date()
): 'pending' | 'paid' | 'overdue' | 'cancelled' {
  if (payment.status === 'cancelled') return 'cancelled';
  if (payment.status === 'paid') return 'paid';
  
  if (isPaymentOverdue(payment.dueDate, asOfDate)) {
    return 'overdue';
  }
  
  return 'pending';
}

/**
 * Format payment amount for display
 */
export function formatPaymentAmount(amountCents: number, currency: string): string {
    // Map currencies to their appropriate locales
    const currencyLocales: { [key: string]: string } = {
        'USD': 'en-US',
        'CAD': 'en-CA',
        'EUR': 'de-DE', // German locale for Euro formatting
        'GBP': 'en-GB',
        'AUD': 'en-AU',
        'JPY': 'ja-JP'
    };
    
    const locale = currencyLocales[currency] || 'en-US';
    
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amountCents / 100);
}

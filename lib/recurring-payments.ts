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

function addUtcMonths(fromDate: Date, months: number): Date {
  const date = new Date(fromDate.getTime());
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0
  )).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return date;
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
      return addUtcMonths(date, 1);
    case 'quarterly':
      return addUtcMonths(date, 3);
    case 'yearly':
      return addUtcMonths(date, 12);
    default:
      return addUtcMonths(date, 1);
  }

  return date;
}

export function firstPaymentOnOrAfter(
  startDate: Date,
  billingCycle: string,
  targetDate: Date,
  afterDate?: Date
): Date {
  const target = new Date(targetDate.getTime());
  target.setUTCHours(0, 0, 0, 0);
  const after = afterDate ? new Date(afterDate.getTime()) : null;
  let candidate = scheduledPaymentDate(startDate, billingCycle, 1);

  for (let occurrence = 2; occurrence <= 5000; occurrence += 1) {
    if (candidate >= target && (!after || candidate > after)) return candidate;
    candidate = scheduledPaymentDate(startDate, billingCycle, occurrence);
  }

  return candidate;
}

function scheduledPaymentDate(
  startDate: Date,
  billingCycle: string,
  occurrence: number
): Date {
  const date = new Date(startDate.getTime());

  switch (billingCycle) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + occurrence);
      return date;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + (7 * occurrence));
      return date;
    case 'quarterly':
      return addUtcMonths(date, 3 * occurrence);
    case 'yearly':
      return addUtcMonths(date, 12 * occurrence);
    case 'monthly':
    default:
      return addUtcMonths(date, occurrence);
  }
}

/**
 * Generate a payment schedule for a subscription
 */
export function generatePaymentSchedule(
  options: RecurringPaymentOptions,
  maxPayments: number = 12
): PaymentSchedule[] {
  const schedule: PaymentSchedule[] = [];

  for (let i = 1; i <= maxPayments; i++) {
    const currentDate = scheduledPaymentDate(options.startDate, options.billingCycle, i);
    
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
  company_coverage_percent?: number;
}>): number {
  return subscriptions.reduce((total, sub) => {
    if (sub.status !== 'active') return total;
    const personalPriceCents = personalSubscriptionCostCents(
      sub.price_cents,
      sub.company_coverage_percent || 0
    );
    
    switch (sub.billing_cycle) {
      case 'monthly':
        return total + (personalPriceCents / 100);
      case 'yearly':
        return total + (personalPriceCents / 100) / 12;
      case 'quarterly':
        return total + (personalPriceCents / 100) / 3;
      case 'weekly':
        return total + (personalPriceCents / 100) * 4.33; // Average weeks per month
      case 'daily':
        return total + (personalPriceCents / 100) * 30;
      default:
        return total;
    }
  }, 0);
}

export function normalizeCoveragePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function companySubscriptionContributionCents(
  priceCents: number,
  coveragePercent: number
): number {
  return Math.round(priceCents * normalizeCoveragePercent(coveragePercent) / 100);
}

export function personalSubscriptionCostCents(
  priceCents: number,
  coveragePercent: number
): number {
  return priceCents - companySubscriptionContributionCents(priceCents, coveragePercent);
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

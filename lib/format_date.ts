/**
 * Date utility functions for handling UTC dates consistently across the app
 */

/**
 * Parse a date string (YYYY-MM-DD) and return a Date object at UTC midnight
 */
export function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Create a UTC date at midnight for the given Date object
 */
export function toUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Format a date string (YYYY-MM-DD) or Date object for display using locale formatting
 */
export function formatDateForDisplay(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'No date set';

  if (dateInput instanceof Date) {
    // Check if the Date object is valid
    if (isNaN(dateInput.getTime())) return 'Invalid Date';
    return dateInput.toLocaleDateString();
  }

  if (typeof dateInput === 'string') {
    // Try to parse as ISO string or other formats
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }

    // Try YYYY-MM-DD format
    const ymdDate = new Date(dateInput + 'T00:00:00');
    if (!isNaN(ymdDate.getTime())) {
      return ymdDate.toLocaleDateString();
    }
  }

  return 'Invalid Date';
}

/**
 * Check if two dates represent the same day in UTC
 */
export function isSameUTCDay(date1: Date, date2: Date): boolean {
  const utc1 = toUTCMidnight(date1);
  const utc2 = toUTCMidnight(date2);
  return utc1.getTime() === utc2.getTime();
}

/**
 * Check if a date string (YYYY-MM-DD) matches a Date object in UTC
 */
export function doesDateStringMatchUTC(dateString: string, date: Date): boolean {
  const expenseDate = parseUTCDate(dateString);
  const selectedUTC = toUTCMidnight(date);
  return expenseDate.getTime() === selectedUTC.getTime();
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}
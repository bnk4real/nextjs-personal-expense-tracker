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
    // For YYYY-MM-DD format stored as UTC, convert to local date for display
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const localDate = utcStringToLocalDate(dateInput);
      return localDate.toLocaleDateString();
    }

    // Try to parse as ISO string or other formats
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
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
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
export function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a local date string (YYYY-MM-DD) to UTC date string for storage
 */
export function localDateToUTCString(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  const utcDate = new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000));
  const utcYear = utcDate.getUTCFullYear();
  const utcMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const utcDay = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${utcYear}-${utcMonth}-${utcDay}`;
}

/**
 * Convert a UTC date string (YYYY-MM-DD) to local date for display
 */
export function utcStringToLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}
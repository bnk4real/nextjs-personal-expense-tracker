/**
 * Date utility functions for date-only values.
 *
 * Expenses store a calendar day as a string. Treating those strings as UTC
 * instants shifts the visible day in non-UTC timezones, so these helpers keep
 * date-only values anchored to the local calendar.
 */

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

/**
 * Normalize a string or Date to YYYY-MM-DD.
 */
export function getDateKey(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    return formatLocalDateKey(dateInput);
  }

  const dateOnlyMatch = dateInput.match(DATE_KEY_PATTERN);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const parsedDate = new Date(dateInput);
  if (isNaN(parsedDate.getTime())) return '';
  return formatLocalDateKey(parsedDate);
}

/**
 * Parse a date string and return a Date object at local midnight.
 */
export function parseUTCDate(dateString: string): Date {
  const dateKey = getDateKey(dateString);
  if (!dateKey) return new Date(NaN);

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Create a local date at midnight for the given Date object.
 */
export function toUTCMidnight(date: Date): Date {
  const dateKey = getDateKey(date);
  if (!dateKey) return new Date(NaN);

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
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
    const dateKey = getDateKey(dateInput);
    if (dateKey) {
      const localDate = utcStringToLocalDate(dateKey);
      return localDate.toLocaleDateString();
    }
  }

  return 'Invalid Date';
}

/**
 * Check if two dates represent the same local calendar day.
 */
export function isSameUTCDay(date1: Date, date2: Date): boolean {
  const utc1 = toUTCMidnight(date1);
  const utc2 = toUTCMidnight(date2);
  return utc1.getTime() === utc2.getTime();
}

/**
 * Check if a date string (YYYY-MM-DD) matches a Date object by calendar day.
 */
export function doesDateStringMatchUTC(dateString: string, date: Date): boolean {
  return getDateKey(dateString) === getDateKey(date);
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
 * Normalize a local date string (YYYY-MM-DD) for storage.
 */
export function localDateToUTCString(dateString: string): string {
  return getDateKey(dateString);
}

/**
 * Convert a date string (YYYY-MM-DD) to a local date for display.
 */
export function utcStringToLocalDate(dateString: string): Date {
  const dateKey = getDateKey(dateString);
  if (!dateKey) return new Date(NaN);

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

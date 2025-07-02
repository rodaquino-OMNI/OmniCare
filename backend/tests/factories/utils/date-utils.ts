/**
 * Date Utilities for Test Factories
 * Fixes date format issues and provides consistent date handling
 */

import { faker } from '@faker-js/faker';

/**
 * Format a date to valid ISO string format (YYYY-MM-DD)
 * Fixes issues like 199-1-1 → 1990-01-01
 */
export function formatValidDate(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    // Return a default valid date if invalid date provided
    const defaultISOString = new Date(1990, 0, 1).toISOString().split('T')[0];
    return defaultISOString || '1990-01-01';
  }
  
  // Ensure year is at least 1900 and at most current year + 10
  const year = Math.max(1900, Math.min(date.getFullYear(), new Date().getFullYear() + 10));
  const validDate = new Date(year, date.getMonth(), date.getDate());
  
  const isoString = validDate.toISOString().split('T')[0];
  return isoString || '1990-01-01';
}

/**
 * Format a datetime to valid ISO string format
 */
export function formatValidDateTime(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    // Return a default valid datetime if invalid date provided
    return new Date(1990, 0, 1).toISOString();
  }
  
  // Ensure year is at least 1900 and at most current year + 10
  const year = Math.max(1900, Math.min(date.getFullYear(), new Date().getFullYear() + 10));
  const validDate = new Date(year, date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
  
  return validDate.toISOString();
}

/**
 * Generate a random date between two dates
 */
export function randomDateBetween(start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

/**
 * Generate a random birth date for adults (18-90 years old)
 */
export function randomAdultBirthDate(): string {
  const now = new Date();
  const minAge = 18;
  const maxAge = 90;
  
  const minBirthYear = now.getFullYear() - maxAge;
  const maxBirthYear = now.getFullYear() - minAge;
  
  const birthDate = faker.date.between({
    from: new Date(minBirthYear, 0, 1),
    to: new Date(maxBirthYear, 11, 31)
  });
  
  return formatValidDate(birthDate);
}

/**
 * Generate a random birth date for children (0-17 years old)
 */
export function randomChildBirthDate(): string {
  const now = new Date();
  const maxAge = 17;
  
  const minBirthYear = now.getFullYear() - maxAge;
  const maxBirthYear = now.getFullYear();
  
  const birthDate = faker.date.between({
    from: new Date(minBirthYear, 0, 1),
    to: new Date(maxBirthYear, 11, 31)
  });
  
  return formatValidDate(birthDate);
}

/**
 * Generate a random date in the past (up to 5 years ago)
 */
export function randomPastDate(yearsBack = 5): string {
  const date = faker.date.recent({
    days: yearsBack * 365,
    refDate: new Date()
  });
  return formatValidDate(date);
}

/**
 * Generate a random date in the future (up to 2 years ahead)
 */
export function randomFutureDate(yearsAhead = 2): string {
  const date = faker.date.soon({
    days: yearsAhead * 365,
    refDate: new Date()
  });
  return formatValidDate(date);
}

/**
 * Generate a random datetime in the past (up to 1 year ago)
 */
export function randomPastDateTime(daysBack = 365): string {
  const date = faker.date.recent({
    days: daysBack,
    refDate: new Date()
  });
  return formatValidDateTime(date);
}

/**
 * Generate a random datetime in the future (up to 1 year ahead)
 */
export function randomFutureDateTime(daysAhead = 365): string {
  const date = faker.date.soon({
    days: daysAhead,
    refDate: new Date()
  });
  return formatValidDateTime(date);
}

/**
 * Generate a random hire date (between 1 and 30 years ago)
 */
export function randomHireDate(): string {
  const now = new Date();
  const startDate = new Date(now.getFullYear() - 30, 0, 1);
  const endDate = new Date(now.getFullYear() - 1, 11, 31);
  
  const hireDate = randomDateBetween(startDate, endDate);
  return formatValidDate(hireDate);
}

/**
 * Generate a random license expiration date (1-5 years in the future)
 */
export function randomLicenseExpirationDate(): string {
  const now = new Date();
  const startDate = new Date(now.getFullYear() + 1, 0, 1);
  const endDate = new Date(now.getFullYear() + 5, 11, 31);
  
  const expirationDate = randomDateBetween(startDate, endDate);
  return formatValidDate(expirationDate);
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return Math.max(0, age);
}

/**
 * Common date constants
 */
export const DateConstants = {
  MIN_BIRTH_YEAR: 1900,
  MAX_FUTURE_YEARS: 10,
  ADULT_MIN_AGE: 18,
  ADULT_MAX_AGE: 90,
  CHILD_MAX_AGE: 17
} as const;
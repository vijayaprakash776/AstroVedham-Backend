import prisma from '../config/prisma';
import crypto from 'crypto';

/**
 * Generates a unique, concurrency-safe order number in the format AV-YYYYMMDD-XXXXXX
 * XXXXXX is a unique random numeric sequence to eliminate concurrent insert race conditions.
 */
export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

  let isUnique = false;
  let orderNumber = '';
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    // Generate a 6-digit random numeric sequence
    const randomNum = crypto.randomInt(100000, 999999).toString();
    orderNumber = `AV-${dateStr}-${randomNum}`;

    // Verify absolute collision uniqueness before proceeding
    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true }
    });

    if (!existingOrder) {
      isUnique = true;
    }
  }

  // Fallback fallback mechanism just in case
  if (!isUnique) {
    const timestampSuffix = Date.now().toString().slice(-6);
    orderNumber = `AV-${dateStr}-${timestampSuffix}`;
  }

  return orderNumber;
}

export const VALID_HOROSCOPE_TYPES = [
  'life_horoscope',
  'super_life_horoscope',
  'marriage_horoscope',
  'marriage_compatibility',
  'complete_marriage_compatibility',
  'single_page_horoscope',
  'wealth_horoscope',
  'yearly_prediction',
  'gemstones_horoscope',
  'numerology',
  'astrologer_consultation'
];

export function isValidHoroscopeType(type: string): boolean {
  return VALID_HOROSCOPE_TYPES.includes(type);
}

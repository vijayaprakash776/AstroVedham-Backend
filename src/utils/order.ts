import prisma from '../config/prisma';

/**
 * Generates a unique order number in the format AV-YYYYMMDD-XXXXXX
 * XXXXXX is a sequential number for the day.
 */
export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

  // Find the count of orders created today to generate the sequence
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const count = await prisma.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const sequence = (count + 1).toString().padStart(6, '0');
  return `AV-${dateStr}-${sequence}`;
}

export const VALID_HOROSCOPE_TYPES = [
  'life_horoscope',
  'super_life_horoscope',
  'marriage_horoscope',
  'marriage_matching',
  'single_page_horoscope',
  'wealth_horoscope',
  'yearly_prediction',
  'gemstones_horoscope',
  'numerology_horoscope',
  'career_horoscope',
];

export function isValidHoroscopeType(type: string): boolean {
  return VALID_HOROSCOPE_TYPES.includes(type);
}

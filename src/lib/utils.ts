import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric amount as USD currency. Null/undefined/0 render as $0.00.
 * Used across reports so "disbursed" totals display consistently.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'USD',
): string {
  const n = typeof value === 'number' && isFinite(value) ? value : 0;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Premium card: border, hover ring, inner shine. Use with Card + inner .card-premium-shine. */
export const cardPremium =
  "card-premium border-purple-200/80 hover:border-purple-300 shadow-lg"

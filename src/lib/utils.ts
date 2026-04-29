import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns up to 2 uppercase initials from a name. Falls back to the first
 * letter of `email` (or '?') when the name is empty.
 */
export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email && email.trim()) {
    return email.trim()[0]?.toUpperCase() ?? "?";
  }
  return "?";
}

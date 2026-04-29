import { z } from "zod";

/**
 * Shared Zod primitives. Reuse across all forms for consistent validation
 * messages and constraints.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email is required" })
  .email({ message: "Please enter a valid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d\s().-]{7,20}$/, { message: "Please enter a valid phone number" });

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || /^[+\d\s().-]{7,20}$/.test(v), {
    message: "Please enter a valid phone number",
  })
  .optional()
  .or(z.literal(""));

/**
 * Strong password: 8+ chars, upper, lower, digit, special.
 */
export const strongPasswordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be at most 72 characters" })
  .regex(/[A-Z]/, { message: "Must contain an uppercase letter" })
  .regex(/[a-z]/, { message: "Must contain a lowercase letter" })
  .regex(/[0-9]/, { message: "Must contain a number" })
  .regex(/[^A-Za-z0-9]/, { message: "Must contain a special character" });

export const uuidSchema = z.string().uuid({ message: "Invalid identifier" });

export const nonEmptyTrimmedString = (label = "This field") =>
  z.string().trim().min(1, { message: `${label} is required` });

export const boundedString = (label: string, max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, { message: `${label} is required` })
    .max(max, { message: `${label} must be less than ${max} characters` });

/**
 * Confirms password fields match. Apply via `.refine` on a parent schema:
 *   schema.refine(passwordsMatch('password', 'confirmPassword'), { ... })
 */
export const passwordsMatch =
  <T extends Record<string, unknown>>(pwField: keyof T, confirmField: keyof T) =>
  (data: T) =>
    data[pwField] === data[confirmField];

/**
 * Shared validation schemas.
 *
 * These are the single source of truth for field contracts. The same schemas
 * are imported by React forms (client-side UX) and by edge functions
 * (server-side integrity). Database constraints and triggers back them up as
 * the final boundary — see the Phase 1 migration.
 *
 * Rules encoded here intentionally mirror the database checks:
 *   support_requests_text_limits, support_requests_amounts_nonneg,
 *   file_notes_text_limits, validate_profile_row().
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  requestTitle: 200,
  requestDescription: 5000,
  fundingPurpose: 1000,
  noteContent: 20000,
  noteTitle: 200,
  name: 100,
  email: 255,
  phone: 32,
  addressLine: 200,
  city: 100,
  region: 100,
  postalCode: 20,
  country: 100,
  freeText: 2000,
  /** Largest currency amount a single request may ask for. */
  maxRequestedAmount: 1_000_000,
} as const;

/** Normalizes to lowercase + trimmed, matching validate_profile_row(). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: 'Email is required' })
  .max(LIMITS.email, { message: `Email must be ${LIMITS.email} characters or fewer` })
  .email({ message: 'Enter a valid email address' });

export const optionalEmailSchema = z
  .union([emailSchema, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

/**
 * Accepts common North American and international formats, then stores the
 * digits-and-plus normalization so reporting can group reliably.
 */
export const phoneSchema = z
  .string()
  .trim()
  .max(LIMITS.phone, { message: `Phone must be ${LIMITS.phone} characters or fewer` })
  .refine((v) => v === '' || /^[+()\-.\s\d]{7,32}$/.test(v), {
    message: 'Enter a valid phone number',
  })
  .transform((v) => normalizePhone(v));

export const optionalPhoneSchema = phoneSchema.nullable().optional();

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

/** ISO date (yyyy-mm-dd) that must be strictly in the past. */
export const pastDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use the format YYYY-MM-DD' })
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime());
  }, { message: 'Enter a real date' })
  .refine((v) => new Date(`${v}T00:00:00Z`) < startOfTodayUtc(), {
    message: 'Date must be in the past',
  })
  .refine((v) => new Date(`${v}T00:00:00Z`) >= new Date('1900-01-01T00:00:00Z'), {
    message: 'Date is too far in the past',
  });

export const optionalPastDateSchema = z
  .union([pastDateSchema, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Non-negative money, capped so a typo can't create an absurd figure. */
export const currencyAmountSchema = z
  .number({ invalid_type_error: 'Enter an amount' })
  .finite({ message: 'Enter a valid amount' })
  .nonnegative({ message: 'Amount cannot be negative' })
  .max(LIMITS.maxRequestedAmount, {
    message: `Amount cannot exceed ${LIMITS.maxRequestedAmount.toLocaleString()}`,
  })
  .refine((v) => Math.round(v * 100) === v * 100, {
    message: 'Amount can have at most two decimal places',
  });

/** 1-5 Likert style rating used by check-ins and life-skills surveys. */
export const ratingSchema = z
  .number()
  .int({ message: 'Choose a whole number' })
  .min(1, { message: 'Choose a value between 1 and 5' })
  .max(5, { message: 'Choose a value between 1 and 5' });

/* ------------------------------------------------------------------ */
/* Support requests                                                    */
/* ------------------------------------------------------------------ */

export const REQUEST_CATEGORIES = ['academic', 'financial', 'mental_health', 'housing', 'other'] as const;
export const REQUEST_PRIORITIES = ['low', 'medium', 'high', 'emergency'] as const;

export const supportRequestSchema = z
  .object({
    category: z.enum(REQUEST_CATEGORIES, { required_error: 'Choose a category' }),
    title: z
      .string()
      .trim()
      .min(5, { message: 'Give your request a short title (at least 5 characters)' })
      .max(LIMITS.requestTitle, { message: `Title must be ${LIMITS.requestTitle} characters or fewer` }),
    description: z
      .string()
      .trim()
      .min(20, { message: 'Please describe your situation in at least 20 characters' })
      .max(LIMITS.requestDescription, {
        message: `Description must be ${LIMITS.requestDescription} characters or fewer`,
      }),
    priority: z.enum(REQUEST_PRIORITIES),
    isEmergency: z.boolean().default(false),
    requestedAmount: currencyAmountSchema.optional(),
    fundingPurpose: z
      .string()
      .trim()
      .max(LIMITS.fundingPurpose, {
        message: `Funding purpose must be ${LIMITS.fundingPurpose} characters or fewer`,
      })
      .optional(),
  })
  // Conditional requirement: money only makes sense for financial requests.
  .superRefine((v, ctx) => {
    if (v.category === 'financial') {
      if (v.requestedAmount == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['requestedAmount'],
          message: 'Enter the amount you are requesting',
        });
      } else if (v.requestedAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['requestedAmount'],
          message: 'Amount must be greater than zero',
        });
      }
    }
    if (v.isEmergency && v.priority !== 'emergency') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority'],
        message: 'Emergency requests must use the emergency priority',
      });
    }
  });

export type SupportRequestInput = z.input<typeof supportRequestSchema>;
export type SupportRequestParsed = z.output<typeof supportRequestSchema>;

/** Attachment metadata accepted by the transactional submission endpoint. */
export const stagedAttachmentSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(512)
    // Staging paths are always `staging/<uid>/<token>/<file>`; reject traversal.
    .refine((p) => !p.includes('..') && p.startsWith('staging/'), {
      message: 'Invalid staged attachment path',
    }),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().nonnegative().max(10 * 1024 * 1024),
  mimeType: z.string().trim().max(255).nullable().optional(),
});

export const submitRequestPayloadSchema = z.object({
  request: supportRequestSchema,
  attachments: z.array(stagedAttachmentSchema).max(10).default([]),
  qrSessionId: z.string().uuid().nullable().optional(),
  /** Idempotency key so a retried submit can't create a second request. */
  submissionToken: z.string().uuid(),
});

export type SubmitRequestPayload = z.output<typeof submitRequestPayloadSchema>;

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

export const profileEditSchema = z.object({
  legal_first_name: z.string().trim().max(LIMITS.name).nullable().optional(),
  legal_last_name: z.string().trim().max(LIMITS.name).nullable().optional(),
  preferred_name: z.string().trim().max(LIMITS.name).nullable().optional(),
  full_name: z
    .string()
    .trim()
    .min(1, { message: 'Full name is required' })
    .max(LIMITS.name, { message: `Name must be ${LIMITS.name} characters or fewer` }),
  email: emailSchema,
  phone: optionalPhoneSchema,
  date_of_birth: optionalPastDateSchema,
  address_line1: z.string().trim().max(LIMITS.addressLine).nullable().optional(),
  address_line2: z.string().trim().max(LIMITS.addressLine).nullable().optional(),
  city: z.string().trim().max(LIMITS.city).nullable().optional(),
  state_region: z.string().trim().max(LIMITS.region).nullable().optional(),
  postal_code: z
    .string()
    .trim()
    .max(LIMITS.postalCode)
    .refine((v) => v === '' || /^[A-Za-z0-9 \-]{3,20}$/.test(v), {
      message: 'Enter a valid postal code',
    })
    .nullable()
    .optional(),
  country: z.string().trim().max(LIMITS.country).nullable().optional(),
});

export type ProfileEditInput = z.input<typeof profileEditSchema>;

/* ------------------------------------------------------------------ */
/* Case notes                                                          */
/* ------------------------------------------------------------------ */

export const caseNoteSchema = z.object({
  title: z.string().trim().max(LIMITS.noteTitle).nullable().optional(),
  content: z
    .string()
    .trim()
    .min(1, { message: 'A note cannot be empty' })
    .max(LIMITS.noteContent, { message: `Note must be ${LIMITS.noteContent} characters or fewer` }),
  note_type: z.string().trim().min(1).max(64),
  contact_date: optionalPastDateSchema,
  duration_minutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
});

/* ------------------------------------------------------------------ */
/* Surveys and intake                                                  */
/* ------------------------------------------------------------------ */

/**
 * A single coded answer. `answer_code` is the analytical source of truth;
 * `answer_label` exists for display only and must never be aggregated on.
 */
export const codedAnswerSchema = z.object({
  question_id: z.string().regex(/^[a-z0-9_]{1,64}$/, {
    message: 'question_id must be lowercase snake_case',
  }),
  answer_code: z.string().regex(/^[a-z0-9_]{1,64}$/, {
    message: 'answer_code must be lowercase snake_case',
  }),
  answer_label: z.string().max(500).nullable().optional(),
  numeric_value: z.number().finite().nullable().optional(),
});

export type CodedAnswer = z.output<typeof codedAnswerSchema>;

export const codedResponseSetSchema = z.object({
  survey_slug: z.string().trim().min(1).max(120),
  survey_version: z.number().int().positive(),
  answers: z.array(codedAnswerSchema).min(1),
});

export const intakeSectionSchema = z.object({
  section: z.string().trim().min(1).max(120),
  intake_version: z.number().int().positive().default(1),
  responses: z.record(z.unknown()),
  correction_reason: z.string().trim().max(LIMITS.freeText).nullable().optional(),
});

export const checkinSchema = z.object({
  mood_rating: ratingSchema,
  progress_rating: ratingSchema,
  blockers: z.string().trim().max(LIMITS.freeText).nullable().optional(),
  wins: z.string().trim().max(LIMITS.freeText).nullable().optional(),
  additional_notes: z.string().trim().max(LIMITS.freeText).nullable().optional(),
});

const requiredPlanText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} is required` })
    .max(LIMITS.freeText, { message: `${label} must be ${LIMITS.freeText} characters or fewer` });

export const postGraduationPlanSchema = z.object({
  graduation_date: z
    .union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  career_goals: requiredPlanText('Career goals'),
  education_goals: requiredPlanText('Education goals'),
  housing_plan: requiredPlanText('Housing plan'),
  financial_plan: requiredPlanText('Financial plan'),
  health_wellness: requiredPlanText('Health and wellness'),
  support_needed: requiredPlanText('Support needed'),
  month_1_3_actions: requiredPlanText('Months 1-3 actions'),
  month_4_6_actions: requiredPlanText('Months 4-6 actions'),
  month_7_9_actions: requiredPlanText('Months 7-9 actions'),
  month_10_12_actions: requiredPlanText('Months 10-12 actions'),
  additional_notes: z.string().trim().max(LIMITS.freeText).nullable().optional(),
  correction_reason: z.string().trim().max(LIMITS.freeText).nullable().optional(),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Flattens a ZodError into `{ field: message }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Age in whole years from an ISO date, or null when unknown/invalid. */
export function ageFromDateOfBirth(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(`${dob.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const today = startOfTodayUtc();
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < d.getUTCMonth() ||
    (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

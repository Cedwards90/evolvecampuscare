// Maps student intake/request signals -> candidate resource categories.
// Keeps the AI agent grounded by narrowing the candidate set before the model call.

export const RESOURCE_CATEGORIES = [
  'Basic Needs & Stability',
  'Housing & Stability',
  'Health & Wellness',
  'Workforce & Economic Empowerment',
  'Legal & Reentry Support',
  'Transportation Services',
  'Youth & Family Services',
  'Senior Services',
  'Community & Civic Engagement',
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export interface IntakeSignals {
  living_situation?: string | null;
  work_status?: string | null;
  support_network?: string | null;
  basic_needs_comfort?: number | null;
  daily_challenges?: string[] | null;
  stress_level?: number | null;
  interested_resources?: string[] | null;
  currently_employed?: string | null;
  main_reason?: string | null;
}

export interface RequestSignals {
  category?: string | null;
  title?: string | null;
  description?: string | null;
  is_emergency?: boolean | null;
}

export function categoriesForIntake(s: IntakeSignals): ResourceCategory[] {
  const out = new Set<ResourceCategory>();
  const challenges = (s.daily_challenges || []).map((c) => c.toLowerCase());
  const interests = (s.interested_resources || []).map((c) => c.toLowerCase());

  if (challenges.some((c) => c.includes('food'))) out.add('Basic Needs & Stability');
  if (challenges.some((c) => c.includes('transport'))) out.add('Transportation Services');
  if (challenges.some((c) => c.includes('childcare'))) out.add('Youth & Family Services');
  if ((s.basic_needs_comfort ?? 0) >= 4) out.add('Basic Needs & Stability');

  if (s.main_reason === 'Housing concerns') out.add('Housing & Stability');
  if (s.living_situation === 'Transitional/temporary') out.add('Housing & Stability');

  if (
    s.main_reason === 'Personal/emotional wellbeing' ||
    (s.stress_level ?? 0) >= 4 ||
    interests.some((i) => /counsel|crisis|wellness/.test(i))
  ) {
    out.add('Health & Wellness');
  }

  if (
    s.main_reason === 'Financial hardship' ||
    s.work_status === 'Not working' ||
    s.currently_employed === 'No'
  ) {
    out.add('Workforce & Economic Empowerment');
    out.add('Basic Needs & Stability');
  }

  if (interests.some((i) => i.includes('peer mentor'))) {
    out.add('Community & Civic Engagement');
  }

  // Always include at least one fallback so the model has something to look at
  if (out.size === 0) out.add('Community & Civic Engagement');
  return Array.from(out);
}

export function categoriesForRequest(r: RequestSignals): ResourceCategory[] {
  const out = new Set<ResourceCategory>();
  const cat = (r.category || '').toLowerCase();
  const text = `${r.title || ''} ${r.description || ''}`.toLowerCase();

  if (cat.includes('legal') || /legal|lawyer|court|reentry|immigration/.test(text)) {
    out.add('Legal & Reentry Support');
  }
  if (cat.includes('financial') || /financial|money|rent|bill|food|utility/.test(text)) {
    out.add('Basic Needs & Stability');
    out.add('Workforce & Economic Empowerment');
  }
  if (cat.includes('housing') || /housing|homeless|evict|shelter|rent/.test(text)) {
    out.add('Housing & Stability');
  }
  if (cat.includes('health') || /health|mental|therapy|counsel|wellness|clinic/.test(text)) {
    out.add('Health & Wellness');
  }
  if (cat.includes('academic') || cat.includes('career') || /job|career|resume|employment|work/.test(text)) {
    out.add('Workforce & Economic Empowerment');
  }
  if (/transport|bus|ride|commute/.test(text)) {
    out.add('Transportation Services');
  }
  if (/child|family|youth|kid/.test(text)) {
    out.add('Youth & Family Services');
  }

  if (out.size === 0) {
    out.add('Community & Civic Engagement');
    out.add('Basic Needs & Stability');
  }
  return Array.from(out);
}

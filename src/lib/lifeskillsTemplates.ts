// Life Skills curriculum metadata — used by survey UI and the seed.
// Single source of truth so display labels stay in sync with template slugs.

export interface LifeSkillsModule {
  id: string; // m01..m07
  number: number;
  title: string;
  topicPhrase: string; // injected into question copy
}

export const LIFESKILLS_MODULES: LifeSkillsModule[] = [
  { id: 'm01', number: 1, title: 'Personal Empowerment', topicPhrase: 'your emotions and resilience' },
  { id: 'm02', number: 2, title: 'Communication Skills', topicPhrase: 'communicating your needs' },
  { id: 'm03', number: 3, title: 'Navigating Systems', topicPhrase: 'advocating within complex systems' },
  { id: 'm04', number: 4, title: 'Financial Literacy', topicPhrase: 'your personal finances' },
  { id: 'm05', number: 5, title: 'Workforce Readiness', topicPhrase: 'your job search and workplace professionalism' },
  { id: 'm06', number: 6, title: 'Digital Literacy', topicPhrase: 'your digital tools' },
  { id: 'm07', number: 7, title: 'AI Literacy', topicPhrase: 'using AI as a helpful tool' },
];

export const LIFESKILLS_FINAL_SLUG = 'lifeskills-final';

export function preSlug(moduleId: string) { return `lifeskills-${moduleId}-pre`; }
export function postSlug(moduleId: string) { return `lifeskills-${moduleId}-post`; }

export function moduleFromSlug(slug: string): { module?: LifeSkillsModule; kind: 'pre' | 'post' | 'final' | 'unknown' } {
  if (slug === LIFESKILLS_FINAL_SLUG) return { kind: 'final' };
  const m = slug.match(/^lifeskills-(m\d{2})-(pre|post)$/);
  if (!m) return { kind: 'unknown' };
  const mod = LIFESKILLS_MODULES.find((x) => x.id === m[1]);
  return { module: mod, kind: m[2] as 'pre' | 'post' };
}

export type SurveyQuestion =
  | { id: string; type: 'scale_1_5'; label: string }
  | { id: string; type: 'open'; label: string; placeholder?: string; maxLength?: number }
  | { id: string; type: 'choice_5'; label: string; options: string[] }
  | { id: string; type: 'nps'; label: string };

export interface LifeSkillsTemplateBlueprint {
  slug: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
}

export function buildPreTemplate(mod: LifeSkillsModule): LifeSkillsTemplateBlueprint {
  return {
    slug: preSlug(mod.id),
    title: `Module ${String(mod.number).padStart(2, '0')}: ${mod.title} — Pre-Module Survey`,
    description: `A 60-second baseline check before the ${mod.title} lesson.`,
    questions: [
      { id: 'confidence', type: 'scale_1_5', label: `How would you rate your current knowledge/confidence regarding ${mod.title}?` },
      { id: 'current_habit', type: 'scale_1_5', label: `On a scale of 1-5, how effectively do you currently manage ${mod.topicPhrase} in your daily life?` },
      { id: 'goal', type: 'open', label: 'What is one specific thing you hope to gain from this workshop?', maxLength: 500 },
    ],
  };
}

export function buildPostTemplate(mod: LifeSkillsModule): LifeSkillsTemplateBlueprint {
  return {
    slug: postSlug(mod.id),
    title: `Module ${String(mod.number).padStart(2, '0')}: ${mod.title} — Post-Module Check-In`,
    description: `Tell us what landed from the ${mod.title} lesson — under 2 minutes.`,
    questions: [
      { id: 'confidence', type: 'scale_1_5', label: `How would you rate your knowledge/confidence regarding ${mod.title} now?` },
      { id: 'action_commitment', type: 'open', label: 'You learned several new skills today. Which one specific action step from the "Action Plan" are you committed to implementing this week?', maxLength: 500 },
      { id: 'resource_likelihood', type: 'scale_1_5', label: 'How likely are you to utilize the resources identified in this module to support your goals?' },
    ],
  };
}

export const FINAL_TEMPLATE: LifeSkillsTemplateBlueprint = {
  slug: LIFESKILLS_FINAL_SLUG,
  title: 'Life Skills — Final Course Wrap-Up',
  description: 'Looking back across all 7 modules — your honest reflection helps us improve.',
  questions: [
    { id: 'eff_m01', type: 'scale_1_5', label: 'Managing emotions and building resilience (Module 01)' },
    { id: 'eff_m02', type: 'scale_1_5', label: 'Communicating needs effectively (Module 02)' },
    { id: 'eff_m03', type: 'scale_1_5', label: 'Advocating for myself within complex systems (Module 03)' },
    { id: 'eff_m04', type: 'scale_1_5', label: 'Managing my personal finances (Module 04)' },
    { id: 'eff_m05', type: 'scale_1_5', label: 'Navigating job search and workplace professionalism (Module 05)' },
    { id: 'eff_m06', type: 'scale_1_5', label: 'Operating safely and effectively in digital spaces (Module 06)' },
    { id: 'eff_m07', type: 'scale_1_5', label: 'Utilizing AI as a helpful tool (Module 07)' },
    { id: 'most_valuable', type: 'open', label: 'Which module had the greatest impact on your life or professional path, and why?', maxLength: 800 },
    { id: 'behavioral_change', type: 'open', label: 'Can you provide one example of a new habit, system, or "Action Plan" you have adopted since starting this course?', maxLength: 800 },
    {
      id: 'future_outlook',
      type: 'choice_5',
      label: 'How prepared do you feel to pursue your professional or personal goals compared to before you started this course?',
      options: ['Much less prepared', 'Less prepared', 'About the same', 'More prepared', 'Much more prepared'],
    },
    { id: 'pacing_feedback', type: 'open', label: 'Did the pacing of the modules allow you enough time to practice the skills (e.g., Active Listening or Budgeting exercises)?', maxLength: 600 },
    { id: 'content_gaps', type: 'open', label: 'Was there any skill or topic you wish the curriculum covered in more detail?', maxLength: 600 },
    { id: 'nps', type: 'nps', label: 'How likely are you to recommend the Evolve Foundation curriculum to a friend or colleague? (0 = not at all likely, 10 = extremely likely)' },
  ],
};

export function allBlueprints(): LifeSkillsTemplateBlueprint[] {
  const list: LifeSkillsTemplateBlueprint[] = [];
  for (const m of LIFESKILLS_MODULES) {
    list.push(buildPreTemplate(m));
    list.push(buildPostTemplate(m));
  }
  list.push(FINAL_TEMPLATE);
  return list;
}

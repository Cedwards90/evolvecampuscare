// 16-type (MBTI-style) personality quiz.
// 32 statements, Likert -2..+2. Each statement loads positively or
// negatively onto one of the four binary axes plus a fifth Identity axis.
//
// Axis convention (matches PersonalityCard left/right labels):
//   energy:    + = Extraverted (E)        - = Introverted (I)
//   mind:      + = Observant   (S)        - = Intuitive   (N)
//   nature:    + = Feeling     (F)        - = Thinking    (T)
//   tactics:   + = Prospecting (P)        - = Judging     (J)
//   identity:  + = Turbulent   (T)        - = Assertive   (A)

export type QuizAxis = 'energy' | 'mind' | 'nature' | 'tactics' | 'identity';

export interface QuizQuestion {
  id: string;
  text: string;
  axis: QuizAxis;
  /** +1 if agreement loads toward the "+" side of the axis, -1 if it loads toward the "-" side. */
  direction: 1 | -1;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ENERGY (E vs I) — 7 questions
  { id: 'e1', axis: 'energy', direction: 1, text: 'You enjoy being the center of attention at social gatherings.' },
  { id: 'e2', axis: 'energy', direction: 1, text: 'You feel energized after spending time with a large group of people.' },
  { id: 'e3', axis: 'energy', direction: -1, text: 'You prefer a quiet evening alone over a lively party.' },
  { id: 'e4', axis: 'energy', direction: 1, text: 'You find it easy to introduce yourself to strangers.' },
  { id: 'e5', axis: 'energy', direction: -1, text: 'Too much social interaction leaves you drained.' },
  { id: 'e6', axis: 'energy', direction: 1, text: 'You often think out loud rather than internally.' },
  { id: 'e7', axis: 'energy', direction: -1, text: 'You need significant alone time to recharge.' },

  // MIND (S vs N) — 7 questions
  { id: 'm1', axis: 'mind', direction: -1, text: 'You spend more time thinking about future possibilities than the present.' },
  { id: 'm2', axis: 'mind', direction: 1, text: 'You trust concrete facts more than abstract theories.' },
  { id: 'm3', axis: 'mind', direction: -1, text: 'You often imagine how things could be, rather than how they are.' },
  { id: 'm4', axis: 'mind', direction: 1, text: 'You prefer practical solutions to creative speculation.' },
  { id: 'm5', axis: 'mind', direction: -1, text: 'You enjoy exploring symbolism and hidden meanings.' },
  { id: 'm6', axis: 'mind', direction: 1, text: 'You focus on what is happening now rather than what might happen later.' },
  { id: 'm7', axis: 'mind', direction: -1, text: 'Abstract ideas excite you more than physical details.' },

  // NATURE (T vs F) — 7 questions
  { id: 'n1', axis: 'nature', direction: 1, text: 'You make decisions based primarily on how they will affect people.' },
  { id: 'n2', axis: 'nature', direction: -1, text: 'You prioritize logic over emotions when solving problems.' },
  { id: 'n3', axis: 'nature', direction: 1, text: 'You find it easy to empathize with others.' },
  { id: 'n4', axis: 'nature', direction: -1, text: 'You can stay objective even when others are upset.' },
  { id: 'n5', axis: 'nature', direction: 1, text: 'Harmony in a group matters more to you than being right.' },
  { id: 'n6', axis: 'nature', direction: -1, text: 'You enjoy debating ideas, even with people you care about.' },
  { id: 'n7', axis: 'nature', direction: 1, text: 'You often consider others\u2019 feelings before your own opinions.' },

  // TACTICS (J vs P) — 7 questions
  { id: 't1', axis: 'tactics', direction: -1, text: 'You like to plan things well in advance.' },
  { id: 't2', axis: 'tactics', direction: 1, text: 'You prefer to keep your options open rather than commit early.' },
  { id: 't3', axis: 'tactics', direction: -1, text: 'A clear schedule helps you feel in control.' },
  { id: 't4', axis: 'tactics', direction: 1, text: 'You work best when you can improvise as you go.' },
  { id: 't5', axis: 'tactics', direction: -1, text: 'You finish tasks well before their deadlines.' },
  { id: 't6', axis: 'tactics', direction: 1, text: 'Last-minute changes don\u2019t bother you much.' },
  { id: 't7', axis: 'tactics', direction: -1, text: 'You prefer a tidy environment to a creative mess.' },

  // IDENTITY (A vs T) — 4 questions
  { id: 'i1', axis: 'identity', direction: 1, text: 'You often worry about whether you\u2019re doing the right thing.' },
  { id: 'i2', axis: 'identity', direction: -1, text: 'You feel confident in your decisions even when others disagree.' },
  { id: 'i3', axis: 'identity', direction: 1, text: 'Criticism affects your mood more than you\u2019d like.' },
  { id: 'i4', axis: 'identity', direction: -1, text: 'You bounce back quickly from setbacks.' },
];

export type LikertValue = -2 | -1 | 0 | 1 | 2;
export const LIKERT_OPTIONS: { value: LikertValue; label: string }[] = [
  { value: -2, label: 'Strongly disagree' },
  { value: -1, label: 'Disagree' },
  { value: 0, label: 'Neutral' },
  { value: 1, label: 'Agree' },
  { value: 2, label: 'Strongly agree' },
];

export interface QuizScore {
  type_code: string;          // e.g. "INTJ-T"
  type_name: string;
  energy_pct: number;         // 0..100 (toward Extraverted)
  mind_pct: number;           // 0..100 (toward Observant)
  nature_pct: number;         // 0..100 (toward Feeling)
  tactics_pct: number;        // 0..100 (toward Prospecting)
  identity_pct: number;       // 0..100 (toward Turbulent)
  energy_label: string;
  mind_label: string;
  nature_label: string;
  tactics_label: string;
  identity_label: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

function axisPercent(answers: Record<string, LikertValue>, axis: QuizAxis): number {
  const qs = QUIZ_QUESTIONS.filter((q) => q.axis === axis);
  if (qs.length === 0) return 50;
  let total = 0;
  let max = 0;
  for (const q of qs) {
    const v = answers[q.id] ?? 0;
    total += v * q.direction;
    max += 2;
  }
  // Map [-max..+max] to [0..100]
  return Math.round(((total + max) / (2 * max)) * 100);
}

const TYPE_INFO: Record<string, { name: string; summary: string; strengths: string[]; weaknesses: string[] }> = {
  INTJ: { name: 'The Architect', summary: 'Imaginative and strategic thinkers, with a plan for everything.', strengths: ['Strategic', 'Independent', 'Determined', 'Insightful'], weaknesses: ['Overly analytical', 'Dismissive of emotions', 'Perfectionistic'] },
  INTP: { name: 'The Logician', summary: 'Innovative inventors with an unquenchable thirst for knowledge.', strengths: ['Analytical', 'Original', 'Open-minded', 'Curious'], weaknesses: ['Disconnected', 'Insensitive', 'Procrastinating'] },
  ENTJ: { name: 'The Commander', summary: 'Bold, imaginative and strong-willed leaders.', strengths: ['Efficient', 'Energetic', 'Confident', 'Strategic'], weaknesses: ['Stubborn', 'Impatient', 'Intolerant'] },
  ENTP: { name: 'The Debater', summary: 'Smart and curious thinkers who cannot resist an intellectual challenge.', strengths: ['Knowledgeable', 'Quick thinking', 'Charismatic'], weaknesses: ['Argumentative', 'Easily bored', 'Insensitive'] },
  INFJ: { name: 'The Advocate', summary: 'Quiet and mystical, yet very inspiring and tireless idealists.', strengths: ['Insightful', 'Principled', 'Passionate', 'Altruistic'], weaknesses: ['Sensitive to criticism', 'Perfectionistic', 'Private'] },
  INFP: { name: 'The Mediator', summary: 'Poetic, kind and altruistic people, always eager to help a good cause.', strengths: ['Empathetic', 'Creative', 'Idealistic', 'Open-minded'], weaknesses: ['Impractical', 'Self-isolating', 'Emotionally vulnerable'] },
  ENFJ: { name: 'The Protagonist', summary: 'Charismatic and inspiring leaders, able to mesmerize their listeners.', strengths: ['Charismatic', 'Reliable', 'Altruistic', 'Natural leader'], weaknesses: ['Overly idealistic', 'Too selfless', 'Approval-seeking'] },
  ENFP: { name: 'The Campaigner', summary: 'Enthusiastic, creative and sociable free spirits.', strengths: ['Curious', 'Energetic', 'Excellent communicators'], weaknesses: ['Unfocused', 'Overthinkers', 'Easily stressed'] },
  ISTJ: { name: 'The Logistician', summary: 'Practical and fact-minded individuals, whose reliability cannot be doubted.', strengths: ['Responsible', 'Honest', 'Calm', 'Practical'], weaknesses: ['Stubborn', 'Insensitive', 'Judgmental'] },
  ISFJ: { name: 'The Defender', summary: 'Very dedicated and warm protectors, always ready to defend their loved ones.', strengths: ['Supportive', 'Reliable', 'Patient', 'Observant'], weaknesses: ['Overly humble', 'Takes things personally', 'Reluctant to change'] },
  ESTJ: { name: 'The Executive', summary: 'Excellent administrators, unsurpassed at managing things \u2014 or people.', strengths: ['Dedicated', 'Direct', 'Honest', 'Loyal'], weaknesses: ['Inflexible', 'Judgmental', 'Difficulty expressing emotion'] },
  ESFJ: { name: 'The Consul', summary: 'Extraordinarily caring, social and popular people, always eager to help.', strengths: ['Strong sense of duty', 'Loyal', 'Sensitive', 'Warm'], weaknesses: ['Inflexible', 'Reluctant to innovate', 'Vulnerable to criticism'] },
  ISTP: { name: 'The Virtuoso', summary: 'Bold and practical experimenters, masters of all kinds of tools.', strengths: ['Optimistic', 'Creative', 'Practical', 'Spontaneous'], weaknesses: ['Stubborn', 'Insensitive', 'Easily bored'] },
  ISFP: { name: 'The Adventurer', summary: 'Flexible and charming artists, always ready to explore something new.', strengths: ['Charming', 'Sensitive', 'Imaginative', 'Curious'], weaknesses: ['Fiercely independent', 'Unpredictable', 'Easily stressed'] },
  ESTP: { name: 'The Entrepreneur', summary: 'Smart, energetic and very perceptive people who truly enjoy living on the edge.', strengths: ['Bold', 'Rational', 'Original', 'Perceptive'], weaknesses: ['Insensitive', 'Impatient', 'Risk-prone'] },
  ESFP: { name: 'The Entertainer', summary: 'Spontaneous, energetic and enthusiastic \u2014 life is never boring around them.', strengths: ['Bold', 'Original', 'Showmanship', 'Practical'], weaknesses: ['Sensitive', 'Conflict-averse', 'Easily bored'] },
};

export function scoreQuiz(answers: Record<string, LikertValue>): QuizScore {
  const energy_pct = axisPercent(answers, 'energy');
  const mind_pct = axisPercent(answers, 'mind');
  const nature_pct = axisPercent(answers, 'nature');
  const tactics_pct = axisPercent(answers, 'tactics');
  const identity_pct = axisPercent(answers, 'identity');

  const code =
    (energy_pct >= 50 ? 'E' : 'I') +
    (mind_pct >= 50 ? 'S' : 'N') +
    (nature_pct >= 50 ? 'F' : 'T') +
    (tactics_pct >= 50 ? 'P' : 'J');
  const suffix = identity_pct >= 50 ? 'T' : 'A';
  const info = TYPE_INFO[code] ?? { name: code, summary: '', strengths: [], weaknesses: [] };

  return {
    type_code: `${code}-${suffix}`,
    type_name: info.name,
    energy_pct,
    mind_pct,
    nature_pct,
    tactics_pct,
    identity_pct,
    energy_label: energy_pct >= 50 ? 'Extraverted' : 'Introverted',
    mind_label: mind_pct >= 50 ? 'Observant' : 'Intuitive',
    nature_label: nature_pct >= 50 ? 'Feeling' : 'Thinking',
    tactics_label: tactics_pct >= 50 ? 'Prospecting' : 'Judging',
    identity_label: identity_pct >= 50 ? 'Turbulent' : 'Assertive',
    strengths: info.strengths,
    weaknesses: info.weaknesses,
    summary: info.summary,
  };
}

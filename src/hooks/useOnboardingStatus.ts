import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type OnboardingStep =
  | 'complete-profile'
  | 'intake-survey'
  | 'career-intake'
  | 'cmf-basics'
  | 'personality-quiz'
  | null;

export const ONBOARDING_STEP_PATH: Record<Exclude<OnboardingStep, null>, string> = {
  'complete-profile': '/complete-profile',
  'intake-survey': '/intake-survey',
  'career-intake': '/onboarding/career-intake',
  'cmf-basics': '/onboarding/cmf-basics',
  'personality-quiz': '/onboarding/personality-quiz',
};

export const ONBOARDING_PATHS = new Set<string>([
  '/complete-profile',
  '/intake-survey',
  '/onboarding/career-intake',
  '/onboarding/cmf-basics',
  '/onboarding/personality-quiz',
]);

export interface OnboardingStatus {
  profileDone: boolean;
  intakeDone: boolean;
  careerDone: boolean;
  cmfDone: boolean;
  personalityDone: boolean;
  nextStep: OnboardingStep;
  loading: boolean;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { user, profile, role, isLoading: authLoading } = useAuth();
  const enabled = !!user && role === 'student';

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status', user?.id],
    enabled,
    queryFn: async () => {
      const [fileRes, careerRes, personalityRes] = await Promise.all([
        supabase
          .from('student_files')
          .select('intake_completed_at, primary_reason_for_contact')
          .eq('student_id', user!.id)
          .maybeSingle(),
        (supabase as any)
          .from('career_intake_responses')
          .select('completed_at')
          .eq('student_id', user!.id)
          .maybeSingle(),
        (supabase as any)
          .from('student_personality_profiles')
          .select('type_code')
          .eq('student_id', user!.id)
          .maybeSingle(),
      ]);
      return {
        intake_completed_at: fileRes.data?.intake_completed_at ?? null,
        primary_reason_for_contact: fileRes.data?.primary_reason_for_contact ?? null,
        career_completed_at: careerRes.data?.completed_at ?? null,
        personality_type: personalityRes.data?.type_code ?? null,
      };
    },
  });

  if (!enabled) {
    return {
      profileDone: true,
      intakeDone: true,
      careerDone: true,
      cmfDone: true,
      personalityDone: true,
      nextStep: null,
      loading: authLoading,
    };
  }

  // Fast-path: profile flagged as onboarded.
  const onboardedAt = (profile as any)?.onboarding_completed_at as string | null | undefined;
  if (onboardedAt) {
    return {
      profileDone: true,
      intakeDone: true,
      careerDone: true,
      cmfDone: true,
      personalityDone: true,
      nextStep: null,
      loading: false,
    };
  }

  const profileDone = !!profile?.full_name && profile.full_name.trim().length >= 2;
  const intakeDone = !!data?.intake_completed_at;
  const careerDone = !!data?.career_completed_at;
  const cmfDone = !!data?.primary_reason_for_contact;
  const personalityDone = !!data?.personality_type;

  let nextStep: OnboardingStep = null;
  if (!profileDone) nextStep = 'complete-profile';
  else if (!intakeDone) nextStep = 'intake-survey';
  else if (!careerDone) nextStep = 'career-intake';
  else if (!cmfDone) nextStep = 'cmf-basics';
  else if (!personalityDone) nextStep = 'personality-quiz';

  return {
    profileDone,
    intakeDone,
    careerDone,
    cmfDone,
    personalityDone,
    nextStep,
    loading: isLoading || authLoading,
  };
}

import { useState } from 'react';
import { UserCircle, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { isProfileStale } from '@/lib/age';
import { EditProfileDialog } from './EditProfileDialog';

const DISMISS_KEY = 'profile-review-dismissed-until';

/**
 * Nudges students (and any user with never-reviewed or stale profile data) to
 * review their contact info. Dismissal is remembered locally for 7 days.
 */
export function ProfileReviewBanner() {
  const { profile, user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const until = Number(localStorage.getItem(DISMISS_KEY) || '0');
    return Date.now() < until;
  });

  if (!user || !profile) return null;
  const reviewedAt = (profile as any).profile_last_reviewed_at as string | null | undefined;
  if (!isProfileStale(reviewedAt) || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch { /* ignore */ }
    setDismissed(true);
  };

  const isFirstReview = !reviewedAt;

  return (
    <>
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <UserCircle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">
                {isFirstReview
                  ? 'Please review your profile information'
                  : "It's been a while — please review your profile"}
              </p>
              <p className="text-xs text-muted-foreground">
                Confirm your name, contact details, date of birth, and address so we can support you accurately.
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:flex-shrink-0">
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Review now
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        userId={user.id}
        isSelfEdit
        initial={{
          full_name: profile.full_name,
          legal_first_name: (profile as any).legal_first_name ?? null,
          legal_last_name: (profile as any).legal_last_name ?? null,
          preferred_name: (profile as any).preferred_name ?? null,
          email: profile.email,
          phone: profile.phone,
          date_of_birth: (profile as any).date_of_birth ?? null,
          address_line1: (profile as any).address_line1 ?? null,
          address_line2: (profile as any).address_line2 ?? null,
          city: (profile as any).city ?? null,
          state_region: (profile as any).state_region ?? null,
          postal_code: (profile as any).postal_code ?? null,
          country: (profile as any).country ?? null,
          profile_last_reviewed_at: reviewedAt ?? null,
        }}
      />
    </>
  );
}

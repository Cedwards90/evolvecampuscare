/** Compute integer age in years from a YYYY-MM-DD date-of-birth string. */
export function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

/** True if a profile's contact information is considered "stale" (never reviewed or > 180 days old). */
export function isProfileStale(
  reviewedAt: string | null | undefined,
  staleAfterDays = 180,
): boolean {
  if (!reviewedAt) return true;
  const t = new Date(reviewedAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > staleAfterDays * 24 * 60 * 60 * 1000;
}

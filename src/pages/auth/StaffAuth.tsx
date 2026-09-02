import Auth from '@/pages/Auth';

/**
 * Staff-facing auth entry point (/auth/staff).
 * Sign-in only — staff accounts are created via invitation, and MFA
 * enrollment/verification is revealed only once it is actually required.
 */
export default function StaffAuth() {
  return <Auth mode="staff" />;
}

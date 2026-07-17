import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEditProfile, type EditableProfileFields } from '@/hooks/useEditProfile';
import { calculateAge } from '@/lib/age';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  legal_first_name: z.string().trim().max(80).optional().or(z.literal('')),
  legal_last_name: z.string().trim().max(80).optional().or(z.literal('')),
  preferred_name: z.string().trim().max(80).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').max(255),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^\+?[\d\s\-()]{7,20}$/.test(v), 'Enter a valid phone number'),
  date_of_birth: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use YYYY-MM-DD'),
  address_line1: z.string().trim().max(200).optional().or(z.literal('')),
  address_line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state_region: z.string().trim().max(100).optional().or(z.literal('')),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Initial profile values keyed by column name. */
  initial: EditableProfileFields & { profile_last_reviewed_at?: string | null };
  /** True when the current user is editing themselves (marks profile as reviewed on save). */
  isSelfEdit?: boolean;
  /** Optional label shown in the dialog header for staff-editing another user. */
  targetLabel?: string;
}

const emptyToNull = (v: string | undefined | null) => {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t === '' ? null : t;
};

export function EditProfileDialog({
  open,
  onOpenChange,
  userId,
  initial,
  isSelfEdit = false,
  targetLabel,
}: EditProfileDialogProps) {
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const editProfile = useEditProfile();
  const [saving, setSaving] = useState(false);

  const defaults = useMemo<FormData>(
    () => ({
      full_name: initial.full_name ?? '',
      legal_first_name: initial.legal_first_name ?? '',
      legal_last_name: initial.legal_last_name ?? '',
      preferred_name: initial.preferred_name ?? '',
      email: initial.email ?? '',
      phone: initial.phone ?? '',
      date_of_birth: initial.date_of_birth ?? '',
      address_line1: initial.address_line1 ?? '',
      address_line2: initial.address_line2 ?? '',
      city: initial.city ?? '',
      state_region: initial.state_region ?? '',
      postal_code: initial.postal_code ?? '',
      country: initial.country ?? '',
    }),
    [initial],
  );

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const dob = form.watch('date_of_birth');
  const age = calculateAge(dob || null);

  const onSubmit = async (values: FormData) => {
    setSaving(true);
    try {
      await editProfile.mutateAsync({
        userId,
        changes: {
          full_name: emptyToNull(values.full_name),
          legal_first_name: emptyToNull(values.legal_first_name),
          legal_last_name: emptyToNull(values.legal_last_name),
          preferred_name: emptyToNull(values.preferred_name),
          email: emptyToNull(values.email) ?? undefined,
          phone: emptyToNull(values.phone),
          date_of_birth: emptyToNull(values.date_of_birth),
          address_line1: emptyToNull(values.address_line1),
          address_line2: emptyToNull(values.address_line2),
          city: emptyToNull(values.city),
          state_region: emptyToNull(values.state_region),
          postal_code: emptyToNull(values.postal_code),
          country: emptyToNull(values.country),
        },
        markReviewed: isSelfEdit,
      });
      if (isSelfEdit) await refreshProfile();
      toast({
        title: 'Profile updated',
        description: isSelfEdit
          ? 'Thanks for keeping your information current.'
          : `Profile changes saved${targetLabel ? ` for ${targetLabel}` : ''}.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Profile update failed:', err);
      toast({
        variant: 'destructive',
        title: 'Could not save profile',
        description:
          err?.message?.includes('row-level security') || err?.code === '42501'
            ? 'You do not have permission to edit this profile.'
            : err?.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isSelfEdit ? 'Review your profile information' : `Edit profile${targetLabel ? ` — ${targetLabel}` : ''}`}
          </DialogTitle>
          <DialogDescription>
            {isSelfEdit
              ? 'Please confirm your contact details so we can support you accurately.'
              : 'Changes are logged in the profile audit trail.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="full_name">Display name</Label>
              <Input id="full_name" {...form.register('full_name')} />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="legal_first_name">Legal first name</Label>
              <Input id="legal_first_name" {...form.register('legal_first_name')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="legal_last_name">Legal last name</Label>
              <Input id="legal_last_name" {...form.register('legal_last_name')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="preferred_name">Preferred name</Label>
              <Input id="preferred_name" {...form.register('preferred_name')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" inputMode="tel" placeholder="+1 (555) 000-0000" {...form.register('phone')} />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input id="date_of_birth" type="date" {...form.register('date_of_birth')} />
              {age !== null && (
                <p className="text-xs text-muted-foreground">Age: {age}</p>
              )}
              {form.formState.errors.date_of_birth && (
                <p className="text-xs text-destructive">{form.formState.errors.date_of_birth.message}</p>
              )}
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="address_line1">Address line 1</Label>
              <Input id="address_line1" {...form.register('address_line1')} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="address_line2">Address line 2</Label>
              <Input id="address_line2" {...form.register('address_line2')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...form.register('city')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state_region">State / Region</Label>
              <Input id="state_region" {...form.register('state_region')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="postal_code">Postal code</Label>
              <Input id="postal_code" {...form.register('postal_code')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...form.register('country')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

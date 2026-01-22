import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  UserPlus, 
  Loader2,
  Mail,
  Shield,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSendInvitation } from '@/hooks/useInvitations';
import type { AppRole } from '@/types/database';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['student', 'case_manager', 'admin'] as const),
  notes: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  trigger?: React.ReactNode;
}

const roleConfig: Record<AppRole, { label: string; icon: typeof Shield; description: string }> = {
  student: {
    label: 'Student',
    icon: GraduationCap,
    description: 'Can submit support requests and track their status',
  },
  case_manager: {
    label: 'Case Manager',
    icon: UserCheck,
    description: 'Can manage student requests and provide support',
  },
  admin: {
    label: 'Administrator',
    icon: Shield,
    description: 'Full access to all features and user management',
  },
};

export function InviteUserDialog({ trigger }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const sendInvitation = useSendInvitation();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'student',
      notes: '',
    },
  });

  const selectedRole = form.watch('role');
  const RoleIcon = roleConfig[selectedRole]?.icon || GraduationCap;

  const onSubmit = async (data: InviteFormData) => {
    await sendInvitation.mutateAsync({
      email: data.email,
      role: data.role,
      notes: data.notes,
    });
    
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new user to the platform.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="user@university.edu"
                className="pl-9"
                {...form.register('email')}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={form.watch('role')} 
              onValueChange={(value: AppRole) => form.setValue('role', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
              <RoleIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {roleConfig[selectedRole]?.description}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Personal Note (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add a personal message to include in the invitation email..."
              rows={3}
              {...form.register('notes')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sendInvitation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sendInvitation.isPending}>
              {sendInvitation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

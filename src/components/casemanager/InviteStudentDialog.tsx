import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  UserPlus, 
  Loader2,
  Mail,
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
import { Checkbox } from '@/components/ui/checkbox';
import { useSendInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/contexts/AuthContext';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  notes: z.string().optional(),
  autoAssign: z.boolean().default(true),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteStudentDialogProps {
  trigger?: React.ReactNode;
}

export function InviteStudentDialog({ trigger }: InviteStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const sendInvitation = useSendInvitation();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      notes: '',
      autoAssign: true,
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    await sendInvitation.mutateAsync({
      email: data.email,
      role: 'student',
      notes: data.notes,
      autoAssignCaseManager: data.autoAssign ? user?.id : undefined,
    });
    
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Student
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Invite New Student
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a new student to your caseload.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student-email">Student Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="student-email"
                type="email"
                placeholder="student@university.edu"
                className="pl-9"
                {...form.register('email')}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg border bg-muted/30">
            <Checkbox
              id="auto-assign"
              checked={form.watch('autoAssign')}
              onCheckedChange={(checked) => form.setValue('autoAssign', checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="auto-assign" className="font-medium cursor-pointer">
                Auto-assign to my caseload
              </Label>
              <p className="text-sm text-muted-foreground">
                When this student signs up, they will automatically be assigned to you as their case manager.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-notes">Welcome Message (Optional)</Label>
            <Textarea
              id="student-notes"
              placeholder="Add a personal welcome message to include in the invitation email..."
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

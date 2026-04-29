import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  UserPlus, 
  Loader2,
  Mail,
  GraduationCap,
  CheckCircle,
  Copy,
  AlertTriangle,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSendInvitation } from '@/hooks/useInvitations';
import { useToast } from '@/hooks/use-toast';
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

interface InviteResultState {
  url: string;
  email: string;
  emailSent: boolean;
}

export function InviteStudentDialog({ trigger }: InviteStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResultState | null>(null);
  const { user } = useAuth();
  const sendInvitation = useSendInvitation();
  const { toast } = useToast();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      notes: '',
      autoAssign: true,
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    const result = await sendInvitation.mutateAsync({
      email: data.email,
      role: 'student',
      notes: data.notes,
      autoAssignCaseManager: data.autoAssign ? user?.id : undefined,
    });
    
    setInviteResult({
      url: result.inviteUrl,
      email: data.email,
      emailSent: result.emailSent,
    });
    form.reset();
  };

  const copyToClipboard = async () => {
    if (inviteResult?.url) {
      await navigator.clipboard.writeText(inviteResult.url);
      toast({
        title: 'Copied!',
        description: 'Invitation link copied to clipboard.',
      });
    }
  };

  const handleClose = () => {
    setInviteResult(null);
    setOpen(false);
  };

  const handleInviteAnother = () => {
    setInviteResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setInviteResult(null);
      }
      setOpen(isOpen);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Student
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {inviteResult ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <CheckCircle className="h-5 w-5" />
                Invitation Created!
              </DialogTitle>
              <DialogDescription>
                {inviteResult.emailSent 
                  ? `An invitation email has been sent to ${inviteResult.email}.`
                  : `The invitation for ${inviteResult.email} has been created.`
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {!inviteResult.emailSent && (
                <Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Email delivery failed due to domain verification. Please share the link below manually.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Invitation Link</Label>
                <div className="flex gap-2">
                  <Input 
                    value={inviteResult.url} 
                    readOnly 
                    className="text-sm font-mono"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" aria-label="Copy invite link"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This link expires in 7 days. Share it with the student to complete their registration.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleInviteAnother}>
                Invite Another
              </Button>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

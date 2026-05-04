import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, DollarSign, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PriorityBadge } from '@/components/PriorityBadge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type {
  RequestCategory,
  RequestPriority,
  SupportRequest,
} from '@/types/database';

const schema = z.object({
  category: z.enum(['academic', 'financial', 'mental_health', 'housing', 'other']),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  description: z.string().min(20, 'Please provide more details (at least 20 characters)').max(2000),
  priority: z.enum(['low', 'medium', 'high', 'emergency']),
  isEmergency: z.boolean(),
  requestedAmount: z.number().min(0).optional().nullable(),
});

type FormData = z.infer<typeof schema>;

const priorities: { value: RequestPriority; description: string }[] = [
  { value: 'low', description: 'General inquiry, no time pressure' },
  { value: 'medium', description: 'Needs attention within a few days' },
  { value: 'high', description: 'Urgent, needs attention soon' },
  { value: 'emergency', description: 'Critical situation, immediate help needed' },
];

interface EditRequestDialogProps {
  request: SupportRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRequestDialog({ request, open, onOpenChange }: EditRequestDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: request.category,
      title: request.title,
      description: request.description,
      priority: request.priority,
      isEmergency: request.is_emergency,
      requestedAmount: request.requested_amount ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        category: request.category,
        title: request.title,
        description: request.description,
        priority: request.priority,
        isEmergency: request.is_emergency,
        requestedAmount: request.requested_amount ?? undefined,
      });
    }
  }, [open, request, form]);

  const watchCategory = form.watch('category');
  const watchPriority = form.watch('priority');
  const watchIsEmergency = form.watch('isEmergency');

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('support_requests')
        .update({
          category: data.category,
          title: data.title,
          description: data.description,
          priority: data.priority,
          is_emergency: data.isEmergency,
          requested_amount:
            data.category === 'financial' ? data.requestedAmount ?? null : null,
        })
        .eq('id', request.id);

      if (error) throw error;

      // Log edit in activity timeline
      await supabase.from('request_updates').insert({
        request_id: request.id,
        user_id: user.id,
        note: 'Student edited the request details.',
        is_internal: false,
      });

      await queryClient.invalidateQueries({ queryKey: ['request', request.id] });
      await queryClient.invalidateQueries({ queryKey: ['requests'] });

      toast({
        title: 'Request updated',
        description: 'Your changes have been saved.',
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Edit request failed:', err);
      toast({
        variant: 'destructive',
        title: 'Could not save changes',
        description:
          err?.message?.includes('row-level security') || err?.code === '42501'
            ? 'This request can no longer be edited.'
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
          <DialogTitle>Edit Request</DialogTitle>
          <DialogDescription>
            You can update your request while it's still pending review.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={watchCategory}
              onValueChange={(v) => form.setValue('category', v as RequestCategory)}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="mental_health">Mental Health</SelectItem>
                <SelectItem value="housing">Housing</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={6} {...form.register('description')} />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Priority</Label>
            <RadioGroup
              value={watchPriority}
              onValueChange={(v) => form.setValue('priority', v as RequestPriority)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {priorities.map((p) => (
                <div key={p.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={p.value} id={`edit-${p.value}`} />
                  <Label htmlFor={`edit-${p.value}`} className="flex flex-col cursor-pointer">
                    <PriorityBadge priority={p.value} />
                    <span className="text-xs text-muted-foreground font-normal">{p.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {watchCategory === 'financial' && (
            <div className="space-y-2">
              <Label htmlFor="requestedAmount">Requested Amount (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="requestedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  {...form.register('requestedAmount', {
                    setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                  })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <Label htmlFor="edit-emergency" className="text-base">This is an emergency</Label>
                <p className="text-sm text-muted-foreground">
                  Check this if you need immediate assistance
                </p>
              </div>
            </div>
            <Switch
              id="edit-emergency"
              checked={watchIsEmergency}
              onCheckedChange={(checked) => {
                form.setValue('isEmergency', checked);
                if (checked) form.setValue('priority', 'emergency');
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { 
  GraduationCap, 
  DollarSign, 
  Heart, 
  Home, 
  HelpCircle,
  Save,
  Send,
  Trash2,
  WifiOff,
  Wifi,
  Cloud,
  CloudOff,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useOffline } from '@/contexts/OfflineContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { mockOfflineDrafts } from '@/lib/mock-data';
import type { RequestCategory, RequestPriority } from '@/types/database';

const categories: { value: RequestCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'academic', label: 'Academic', icon: GraduationCap },
  { value: 'financial', label: 'Financial', icon: DollarSign },
  { value: 'mental_health', label: 'Mental Health', icon: Heart },
  { value: 'housing', label: 'Housing', icon: Home },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const priorities: { value: RequestPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
];

const draftSchema = z.object({
  category: z.enum(['academic', 'financial', 'mental_health', 'housing', 'other']),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Please provide more details'),
  priority: z.enum(['low', 'medium', 'high', 'emergency']),
  isEmergency: z.boolean(),
});

type DraftFormData = z.infer<typeof draftSchema>;

interface Draft {
  id: string;
  draft_data: DraftFormData;
  synced: boolean;
  created_at: string;
  updated_at: string;
}

export default function OfflineDraft() {
  const [drafts, setDrafts] = useState<Draft[]>(mockOfflineDrafts as Draft[]);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isOnline, isServiceWorkerReady } = useOffline();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<DraftFormData>({
    resolver: zodResolver(draftSchema),
    defaultValues: {
      category: 'academic',
      title: '',
      description: '',
      priority: 'medium',
      isEmergency: false,
    },
  });

  useEffect(() => {
    if (editingDraft) {
      form.reset(editingDraft.draft_data);
    } else {
      form.reset({
        category: 'academic',
        title: '',
        description: '',
        priority: 'medium',
        isEmergency: false,
      });
    }
  }, [editingDraft, form]);

  const saveDraft = async () => {
    const data = form.getValues();
    if (!data.title || data.title.length < 5) {
      toast({
        variant: 'destructive',
        title: 'Cannot save draft',
        description: 'Please enter a title with at least 5 characters.',
      });
      return;
    }

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    if (editingDraft) {
      setDrafts(drafts.map(d => 
        d.id === editingDraft.id 
          ? { ...d, draft_data: data, updated_at: new Date().toISOString(), synced: false }
          : d
      ));
    } else {
      const newDraft: Draft = {
        id: `draft-${Date.now()}`,
        draft_data: data,
        synced: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setDrafts([newDraft, ...drafts]);
    }

    toast({
      title: 'Draft saved',
      description: isOnline ? 'Your draft has been saved.' : 'Your draft has been saved locally and will sync when online.',
    });

    setEditingDraft(null);
    form.reset();
    setIsSaving(false);
  };

  const deleteDraft = (draftId: string) => {
    setDrafts(drafts.filter(d => d.id !== draftId));
    if (editingDraft?.id === draftId) {
      setEditingDraft(null);
      form.reset();
    }
    toast({
      title: 'Draft deleted',
      description: 'The draft has been removed.',
    });
  };

  const syncDrafts = async () => {
    if (!isOnline) {
      toast({
        variant: 'destructive',
        title: 'Cannot sync',
        description: 'You are currently offline. Please connect to the internet to sync.',
      });
      return;
    }

    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setDrafts(drafts.map(d => ({ ...d, synced: true })));
    
    toast({
      title: 'Drafts synced',
      description: `${drafts.filter(d => !d.synced).length} drafts have been synced.`,
    });
    setIsSyncing(false);
  };

  const submitDraft = async (draft: Draft) => {
    if (!isOnline) {
      toast({
        variant: 'destructive',
        title: 'Cannot submit',
        description: 'You need to be online to submit a request.',
      });
      return;
    }

    // Navigate to submit page with pre-filled data (in a real app)
    navigate('/student-submitting-a-support-request');
  };

  const unsyncedCount = drafts.filter(d => !d.synced).length;

  return (
    <AppLayout>
      <div className="space-y-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title="Offline Drafts"
            description="Create and save request drafts that work even without internet connection"
          />
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/50">
                <Wifi className="mr-1 h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/50">
                <WifiOff className="mr-1 h-3 w-3" />
                Offline
              </Badge>
            )}
            {unsyncedCount > 0 && (
              <Button variant="outline" size="sm" onClick={syncDrafts} disabled={!isOnline || isSyncing}>
                {isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync ({unsyncedCount})
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Draft Form */}
          <section className="space-y-4">
            <h2 className="font-display text-h3">
              {editingDraft ? 'Edit Draft' : 'New Draft'}
            </h2>
            <Card className="border border-border/50">
              <CardContent className="pt-6 space-y-6">
                {/* Category Selection */}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categories.map((cat) => (
                      <Button
                        key={cat.value}
                        type="button"
                        variant={form.watch('category') === cat.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => form.setValue('category', cat.value)}
                        className="justify-start"
                      >
                        <cat.icon className="mr-2 h-4 w-4" />
                        {cat.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Brief summary of your request"
                    {...form.register('title')}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your situation and what kind of help you need..."
                    rows={4}
                    {...form.register('description')}
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                  )}
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <RadioGroup
                    value={form.watch('priority')}
                    onValueChange={(value) => form.setValue('priority', value as RequestPriority)}
                    className="flex flex-wrap gap-4"
                  >
                    {priorities.map((p) => (
                      <div key={p.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={p.value} id={`priority-${p.value}`} />
                        <Label htmlFor={`priority-${p.value}`} className="cursor-pointer">
                          <PriorityBadge priority={p.value} />
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Emergency Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emergency">Emergency Request</Label>
                    <p className="text-sm text-muted-foreground">
                      Mark if you need immediate assistance
                    </p>
                  </div>
                  <Switch
                    id="emergency"
                    checked={form.watch('isEmergency')}
                    onCheckedChange={(checked) => {
                      form.setValue('isEmergency', checked);
                      if (checked) form.setValue('priority', 'emergency');
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button onClick={saveDraft} disabled={isSaving} className="flex-1">
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Draft
                  </Button>
                  {editingDraft && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingDraft(null);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Saved Drafts */}
          <section className="space-y-4">
            <h2 className="font-display text-h3">Saved Drafts</h2>
            
            {drafts.length === 0 ? (
              <EmptyState
                icon={CloudOff}
                title="No drafts saved"
                description="Create a draft to save it for later submission"
              />
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <Card 
                    key={draft.id} 
                    className={cn(
                      'border border-border/50 transition-colors',
                      editingDraft?.id === draft.id && 'border-primary'
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-base">
                            {draft.draft_data.title || 'Untitled Draft'}
                          </CardTitle>
                          <div className="flex flex-wrap gap-2">
                            <CategoryBadge category={draft.draft_data.category} />
                            <PriorityBadge priority={draft.draft_data.priority} />
                            {draft.synced ? (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/50">
                                <Cloud className="mr-1 h-3 w-3" />
                                Synced
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/50">
                                <CloudOff className="mr-1 h-3 w-3" />
                                Not Synced
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {draft.draft_data.description || 'No description'}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Last updated: {format(new Date(draft.updated_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingDraft(draft)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => submitDraft(draft)}
                          disabled={!isOnline}
                          className="flex-1"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Submit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this draft? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteDraft(draft.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  GraduationCap, 
  DollarSign, 
  Heart, 
  Home, 
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Upload,
  Check,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { RequestCategory, RequestPriority } from '@/types/database';

const categories: { value: RequestCategory; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: 'academic', label: 'Academic', icon: GraduationCap, description: 'Course registration, grades, academic advising' },
  { value: 'financial', label: 'Financial', icon: DollarSign, description: 'Financial aid, scholarships, tuition' },
  { value: 'mental_health', label: 'Mental Health', icon: Heart, description: 'Counseling, wellness, support services' },
  { value: 'housing', label: 'Housing', icon: Home, description: 'Dorms, housing assignments, maintenance' },
  { value: 'other', label: 'Other', icon: HelpCircle, description: 'Parking, events, general inquiries' },
];

const priorities: { value: RequestPriority; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'General inquiry, no time pressure' },
  { value: 'medium', label: 'Medium', description: 'Needs attention within a few days' },
  { value: 'high', label: 'High', description: 'Urgent, needs attention soon' },
  { value: 'emergency', label: 'Emergency', description: 'Critical situation, immediate help needed' },
];

const requestSchema = z.object({
  category: z.enum(['academic', 'financial', 'mental_health', 'housing', 'other']),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(20, 'Please provide more details (at least 20 characters)').max(2000, 'Description must be less than 2000 characters'),
  priority: z.enum(['low', 'medium', 'high', 'emergency']),
  isEmergency: z.boolean(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function SubmitRequest() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      category: undefined,
      title: '',
      description: '',
      priority: 'medium',
      isEmergency: false,
    },
  });

  const watchCategory = form.watch('category');
  const watchPriority = form.watch('priority');
  const watchIsEmergency = form.watch('isEmergency');

  const nextStep = () => {
    if (step === 1 && !watchCategory) {
      toast({
        variant: 'destructive',
        title: 'Please select a category',
        description: 'Choose the type of support you need.',
      });
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const onSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: 'Request submitted successfully!',
      description: 'A case manager will review your request shortly.',
    });
    
    navigate('/student-tracking-request-status-scheduling-meeting');
  };

  return (
    <SidebarLayout>
      <div className="space-y-12 max-w-3xl mx-auto">
        <PageHeader
          title="Submit a Support Request"
          description="Tell us how we can help you. Your request will be reviewed by a dedicated case manager."
        />

        {/* Progress Indicator */}
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors',
                  s < step && 'border-primary bg-primary text-primary-foreground',
                  s === step && 'border-primary text-primary',
                  s > step && 'border-muted text-muted-foreground'
                )}
              >
                {s < step ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={cn(
                    'h-1 w-12 sm:w-24 mx-2',
                    s < step ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="font-display">What type of support do you need?</CardTitle>
                <CardDescription>Select the category that best describes your request</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.value}
                      onClick={() => form.setValue('category', cat.value)}
                      className={cn(
                        'flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors hover:border-primary/50',
                        watchCategory === cat.value && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <cat.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{cat.label}</h3>
                        <p className="text-sm text-muted-foreground">{cat.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Request Details */}
          {step === 2 && (
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="font-display">Describe your request</CardTitle>
                <CardDescription>Provide details so we can better assist you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                  <Input
                    id="title"
                    placeholder="Brief summary of your request"
                    {...form.register('title')}
                    aria-invalid={!!form.formState.errors.title}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="description"
                    placeholder="Please provide as much detail as possible about your situation and what kind of help you need..."
                    rows={6}
                    {...form.register('description')}
                    aria-invalid={!!form.formState.errors.description}
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {form.watch('description')?.length || 0}/2000 characters
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Priority Level</Label>
                  <RadioGroup
                    value={watchPriority}
                    onValueChange={(value) => form.setValue('priority', value as RequestPriority)}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {priorities.map((p) => (
                      <div key={p.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={p.value} id={p.value} />
                        <Label htmlFor={p.value} className="flex flex-col cursor-pointer">
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={p.value} />
                          </div>
                          <span className="text-xs text-muted-foreground font-normal">{p.description}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <Label htmlFor="emergency" className="text-base">This is an emergency</Label>
                      <p className="text-sm text-muted-foreground">
                        Check this if you need immediate assistance
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="emergency"
                    checked={watchIsEmergency}
                    onCheckedChange={(checked) => {
                      form.setValue('isEmergency', checked);
                      if (checked) form.setValue('priority', 'emergency');
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Attachments */}
          {step === 3 && (
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="font-display">Add Supporting Documents</CardTitle>
                <CardDescription>Upload any files that might help us understand your situation (optional)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-12">
                  <Upload className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, DOC, DOCX, PNG, JPG up to 10MB each
                  </p>
                  <Button type="button" variant="outline" className="mt-4">
                    Browse Files
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  You can skip this step if you don't have any documents to attach.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && (
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="font-display">Review Your Request</CardTitle>
                <CardDescription>Please review the details before submitting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Category</span>
                    <CategoryBadge category={watchCategory} />
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Priority</span>
                    <PriorityBadge priority={watchPriority} />
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Emergency</span>
                    <span className={watchIsEmergency ? 'text-destructive font-semibold' : ''}>
                      {watchIsEmergency ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="py-2 border-b">
                    <span className="text-muted-foreground">Title</span>
                    <p className="mt-1 font-medium">{form.watch('title')}</p>
                  </div>
                  <div className="py-2">
                    <span className="text-muted-foreground">Description</span>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{form.watch('description')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={step === 1 ? () => navigate(-1) : prevStep}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 4 ? (
              <Button type="button" onClick={nextStep}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            )}
          </div>
        </form>
      </div>
    </SidebarLayout>
  );
}

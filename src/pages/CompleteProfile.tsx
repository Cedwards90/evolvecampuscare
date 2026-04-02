import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Phone, GraduationCap, Building, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  student_id: z.string().optional(),
  department: z.string().optional(),
  year_of_study: z.string().optional(),
  preferred_contact: z.string().default('email'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const yearOptions = [
  { value: 'freshman', label: 'Freshman (1st Year)' },
  { value: 'sophomore', label: 'Sophomore (2nd Year)' },
  { value: 'junior', label: 'Junior (3rd Year)' },
  { value: 'senior', label: 'Senior (4th Year)' },
  { value: 'graduate', label: 'Graduate Student' },
  { value: 'other', label: 'Other' },
];

const departmentOptions = [
  { value: 'arts_sciences', label: 'Arts & Sciences' },
  { value: 'business', label: 'Business' },
  { value: 'education', label: 'Education' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'health_sciences', label: 'Health Sciences' },
  { value: 'law', label: 'Law' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'social_work', label: 'Social Work' },
  { value: 'other', label: 'Other' },
];

const contactOptions = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'text', label: 'Text Message' },
];

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      preferred_contact: 'email',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          student_id: data.student_id || null,
          department: data.department || null,
          year_of_study: data.year_of_study || null,
          preferred_contact: data.preferred_contact,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshProfile();

      toast({
        title: 'Profile completed!',
        description: 'Your profile has been updated successfully.',
      });

      navigate('/intake-survey');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Help us serve you better by providing some additional information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="full_name"
                  className="pl-10"
                  placeholder="Enter your full name"
                  {...register('full_name')}
                />
              </div>
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  className="pl-10"
                  placeholder="(555) 123-4567"
                  {...register('phone')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="student_id">Student ID</Label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="student_id"
                  className="pl-10"
                  placeholder="Enter your student ID"
                  {...register('student_id')}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Department/School</Label>
                <Select
                  onValueChange={(value) => setValue('department', value)}
                  defaultValue={watch('department')}
                >
                  <SelectTrigger>
                    <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year_of_study">Year of Study</Label>
                <Select
                  onValueChange={(value) => setValue('year_of_study', value)}
                  defaultValue={watch('year_of_study')}
                >
                  <SelectTrigger>
                    <GraduationCap className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_contact">Preferred Contact Method</Label>
              <Select
                onValueChange={(value) => setValue('preferred_contact', value)}
                defaultValue={watch('preferred_contact') || 'email'}
              >
                <SelectTrigger>
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select contact method" />
                </SelectTrigger>
                <SelectContent>
                  {contactOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSkip}
              >
                Skip for Now
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Complete Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

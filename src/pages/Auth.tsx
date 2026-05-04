import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, Loader2, Mail, Check, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useValidateInvitation } from '@/hooks/useInvitations';
import { useMFA } from '@/hooks/useMFA';
import { MFAVerification } from '@/components/auth/MFAVerification';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export default function Auth() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false);
  const { user, role, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isEnrolled, isLoading: mfaLoading, checkMFAStatus } = useMFA();
  const isLoading = isSubmitting || mfaLoading;
  
  // Validate invitation token if present
  const { data: invitation } = useValidateInvitation(inviteToken);

  useEffect(() => {
    // If MFA screens are showing, don't navigate
    if (showMFAVerification || showMFAEnrollment) {
      return;
    }
    
    if (user && role) {
      // Check if privileged user needs MFA enrollment (first time setup)
      const isPrivilegedRole = role === 'admin' || role === 'case_manager';
      if (isPrivilegedRole && !isEnrolled && !isLoading) {
        setShowMFAEnrollment(true);
        return;
      }
      
      // If we get here, user is fully authenticated
      navigate('/dashboard', { replace: true });
    }
  }, [user, role, isEnrolled, isLoading, showMFAVerification, showMFAEnrollment, navigate]);

  // Handle invitation token - switch to signup and pre-fill email
  useEffect(() => {
    if (invitation) {
      setActiveTab('signup');
      signupForm.setValue('email', invitation.email);
    }
  }, [invitation]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false as any,
    },
  });

  const onLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Sign in failed',
          description: error.message === 'Invalid login credentials' 
            ? 'Invalid email or password. Please try again.'
            : error.message,
        });
        return;
      }
      
      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });
      
      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check MFA status DIRECTLY (not relying on hook state which may be stale)
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = factorsData?.totp.filter(f => f.status === 'verified') || [];
      
      if (verifiedFactors.length > 0) {
        // User has MFA enrolled - check if verification needed
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aalData && aalData.currentLevel !== aalData.nextLevel) {
          // MFA verification required - show the prompt
          setShowMFAVerification(true);
          return;
        }
      }
      
      // Also update the hook state for consistency
      await checkMFAStatus();
      
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignup = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        let errorMessage = error.message;
        if (error.message.includes('already registered')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        }
        toast({
          variant: 'destructive',
          title: 'Sign up failed',
          description: errorMessage,
        });
      } else {
        toast({
          title: 'Account created!',
          description: 'Welcome! You can now access your dashboard.',
        });
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(signupForm.watch('password') || '');
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-success', 'bg-success'];

  const onGoogleAuth = async () => {
    setIsSubmitting(true);
    try {
      const redirectPath = inviteToken ? `/auth?invite=${encodeURIComponent(inviteToken)}` : '/auth';
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + redirectPath,
      });
      if (result.redirected) return;
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Google sign-in failed',
          description: result.error.message || 'Please try again or use email and password.',
        });
        setIsSubmitting(false);
      }
      // On success without redirect, session is set; the useEffect handles routing.
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Google sign-in failed',
        description: err?.message || 'An unexpected error occurred. Please try again.',
      });
      setIsSubmitting(false);
    }
  };

  const GoogleButton = ({ label }: { label: string }) => (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-full"
        onClick={onGoogleAuth}
        disabled={isLoading}
      >
        {isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
        )}
        {label}
      </Button>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
        </div>
      </div>
    </>
  );


  // Handle MFA verification screen
  if (showMFAVerification) {
    return (
      <AuthLayout>
        <MFAVerification
          onVerificationComplete={() => {
            setShowMFAVerification(false);
            navigate('/dashboard', { replace: true });
          }}
          onCancel={() => {
            setShowMFAVerification(false);
          }}
        />
      </AuthLayout>
    );
  }

  // Handle MFA enrollment for privileged users (admin/case_manager)
  // MFA is REQUIRED for privileged roles - no skip option provided
  if (showMFAEnrollment) {
    return (
      <AuthLayout>
        <MFAEnrollment
          onEnrollmentComplete={() => {
            setShowMFAEnrollment(false);
            navigate('/dashboard', { replace: true });
          }}
          // No onSkip callback - MFA is mandatory for privileged roles
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="border-border/50">
        {/* Invitation Banner */}
        {invitation && (
          <div className="mx-6 mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  You've been invited!
                </p>
                <p className="text-sm text-muted-foreground">
                  Join as a <span className="capitalize font-medium text-primary">{invitation.invited_role.replace('_', ' ')}</span>
                </p>
              </div>
            </div>
          </div>
        )}
        
        <CardHeader className="text-center">
          <CardTitle className="font-display text-h2">
            {invitation ? 'Complete Your Registration' : activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {invitation
              ? 'Create your account to accept the invitation'
              : activeTab === 'login' 
                ? 'Sign in to access your dashboard'
                : 'Join Evolve to get the support you need'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <GoogleButton label="Continue with Google" />
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@university.edu"
                    {...loginForm.register('email')}
                    aria-invalid={!!loginForm.formState.errors.email}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...loginForm.register('password')}
                      aria-invalid={!!loginForm.formState.errors.password}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <GoogleButton label="Sign up with Google" />
              <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    {...signupForm.register('fullName')}
                    aria-invalid={!!signupForm.formState.errors.fullName}
                  />
                  {signupForm.formState.errors.fullName && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@university.edu"
                    disabled={!!invitation}
                    className={invitation ? 'bg-muted' : ''}
                    {...signupForm.register('email')}
                    aria-invalid={!!signupForm.formState.errors.email}
                  />
                  {invitation && (
                    <p className="text-xs text-muted-foreground">
                      This email is linked to your invitation and cannot be changed.
                    </p>
                  )}
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...signupForm.register('password')}
                      aria-invalid={!!signupForm.formState.errors.password}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {/* Password Requirements Checklist */}
                  <div className="space-y-1.5 mt-2">
                    {[
                      { label: 'At least 8 characters', met: (signupForm.watch('password') || '').length >= 8 },
                      { label: 'One uppercase letter', met: /[A-Z]/.test(signupForm.watch('password') || '') },
                      { label: 'One lowercase letter', met: /[a-z]/.test(signupForm.watch('password') || '') },
                      { label: 'One number', met: /[0-9]/.test(signupForm.watch('password') || '') },
                    ].map((req) => (
                      <div key={req.label} className="flex items-center gap-2 text-xs">
                        {req.met ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className={req.met ? 'text-success' : 'text-muted-foreground'}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...signupForm.register('confirmPassword')}
                      aria-invalid={!!signupForm.formState.errors.confirmPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {signupForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                {/* Terms of Service Checkbox */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms"
                      checked={signupForm.watch('termsAccepted')}
                      onCheckedChange={(checked) => signupForm.setValue('termsAccepted', checked === true ? true : false as any, { shouldValidate: true })}
                      aria-invalid={!!signupForm.formState.errors.termsAccepted}
                    />
                    <label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                      I agree to the{' '}
                      <a href="#" className="text-primary underline hover:no-underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-primary underline hover:no-underline">Privacy Policy</a>
                    </label>
                  </div>
                  {signupForm.formState.errors.termsAccepted && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.termsAccepted.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

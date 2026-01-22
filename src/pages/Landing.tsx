import { Link } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  Users, 
  Shield, 
  Zap, 
  HeartHandshake,
  ArrowRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const features = [
  {
    icon: FileText,
    title: 'Easy Request Submission',
    description: 'Submit support requests for academic advising, financial aid, mental health, or housing with a simple, guided form.',
  },
  {
    icon: Clock,
    title: 'Real-Time Tracking',
    description: 'Track the status of your requests in real-time. Know exactly where your request is in the process.',
  },
  {
    icon: Users,
    title: 'Dedicated Case Managers',
    description: 'Get assigned to dedicated case managers who understand your needs and provide personalized support.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your data is protected with enterprise-grade security. We take your privacy seriously.',
  },
  {
    icon: Zap,
    title: 'AI-Powered Insights',
    description: 'Smart suggestions and prioritization help case managers respond faster to urgent needs.',
  },
  {
    icon: HeartHandshake,
    title: 'Comprehensive Support',
    description: 'From academic challenges to personal crises, we\'re here to help you navigate university life.',
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <img 
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp" 
            alt="Evolve Foundation" 
            className="h-8 w-auto"
          />
          <div className="flex items-center gap-4">
            {user ? (
              <Button asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth?tab=signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        <div className="absolute top-20 left-1/4 h-72 w-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 h-64 w-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container relative space-y-12 py-16 md:py-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <h1 className="font-display text-h1 md:text-5xl lg:text-6xl font-bold tracking-tight">
              Student Support,{' '}
              <span className="text-primary relative">
                Simplified
                <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none">
                  <path d="M2 6C50 2 150 2 198 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/30"/>
                </svg>
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl max-w-2xl leading-relaxed">
              Evolve Foundation connects students with the support they need. Submit requests, track progress, 
              and schedule meetings with dedicated case managers—all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {user ? (
                <Button size="lg" className="shadow-lg shadow-primary/25" asChild>
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="shadow-lg shadow-primary/25" asChild>
                    <Link to="/auth?tab=signup">
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="backdrop-blur-sm" asChild>
                    <Link to="/auth">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container space-y-12 py-12 md:py-24 bg-muted/30">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-display text-h2 md:text-4xl font-bold">
            Everything You Need
          </h2>
          <p className="mt-4 text-muted-foreground">
            Evolve Foundation provides comprehensive tools for students, case managers, and administrators.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="font-display text-h3 mt-4">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container space-y-12 py-12 md:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-display text-h2 md:text-4xl font-bold">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join thousands of students who have simplified their support experience with Evolve Foundation.
          </p>
          {!user && (
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link to="/auth?tab=signup">
                  Create Your Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <img 
              src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp" 
              alt="Evolve Foundation" 
              className="h-6 w-auto"
            />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Evolve Foundation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

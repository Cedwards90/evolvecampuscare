import { GraduationCap } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <a href="/" className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-semibold">Evolve Foundation</span>
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Evolve Foundation. All rights reserved.
          © {new Date().getFullYear()} CampusCare. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

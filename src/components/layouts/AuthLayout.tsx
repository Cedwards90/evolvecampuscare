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
            <img 
              src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp" 
              alt="Evolve Foundation" 
              className="h-8 w-auto"
            />
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
        </div>
      </footer>
    </div>
  );
}

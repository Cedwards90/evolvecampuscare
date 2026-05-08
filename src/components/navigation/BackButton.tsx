import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPreviousEntry } from '@/lib/navigationHistory';

interface BackButtonProps {
  fallback?: string;
  label?: string;
  className?: string;
}

export function BackButton({ fallback = '/dashboard', label = 'Back', className }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    const prev = getPreviousEntry(location.pathname);
    if (prev) {
      navigate(`${prev.pathname}${prev.search}`);
      // Restore scroll after paint.
      const targetY = prev.scrollY;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: 'auto' });
        });
      });
    } else {
      navigate(fallback);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label="Go back"
      className={cn('rounded-full gap-1.5 -ml-2', className)}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

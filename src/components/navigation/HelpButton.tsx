import { useNavigate } from 'react-router-dom';
import { HelpCircle, PlayCircle, BookOpen, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProductTour } from '@/hooks/useProductTour';

export function HelpButton() {
  const navigate = useNavigate();
  const { startTour } = useProductTour();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help & support">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Help & Walkthrough</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={startTour} className="cursor-pointer">
          <PlayCircle className="mr-2 h-4 w-4" />
          Replay guided tour
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/support')} className="cursor-pointer">
          <BookOpen className="mr-2 h-4 w-4" />
          Help Center & FAQs
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="mailto:support@evolvefoundation.us" className="cursor-pointer">
            <Mail className="mr-2 h-4 w-4" />
            Email support
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

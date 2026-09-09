import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from 'react-router-dom';
import type { RequestCategory } from '@/types/database';

const categoryFaqs: Record<RequestCategory, { q: string; a: string }[]> = {
  academic: [
    { q: 'What counts as a training or program request?', a: 'Training attendance, schedule conflicts, make-up hours, certifications, exams, and career readiness support.' },
    { q: 'How quickly will I get a response?', a: 'Most requests are reviewed within 1-2 business days. Mark it as High priority if there\'s a deadline.' },
  ],
  financial: [
    { q: 'What can financial assistance cover?', a: 'Costs that keep you in training or on the job: transportation, work gear and tools, childcare, and similar needs. Describe the need and the amount.' },
    { q: 'What documents should I attach?', a: 'A quote, invoice, bill, or receipt for the item or service you need.' },
  ],
  mental_health: [
    { q: 'Is my wellbeing request confidential?', a: 'Yes. Only your assigned case manager and administrators can see your request details. All data is encrypted.' },
    { q: 'What if I need immediate help?', a: 'Toggle "This is an emergency" or call the 988 Suicide & Crisis Lifeline for immediate support.' },
  ],
  housing: [
    { q: 'What housing issues can I report here?', a: 'Being behind on rent, facing eviction, needing emergency shelter, or an unsafe or unstable living situation.' },
    { q: 'What if I am unsafe right now?', a: 'If you are in immediate danger, call 911 first, then file a request here so your case manager can follow up.' },
  ],
  other: [
    { q: 'Not sure which category to pick?', a: '"Other" is perfect. Your case manager will review your request and route it to the right department.' },
    { q: 'Can I change the category later?', a: 'You can\'t change it after submitting, but your case manager can reclassify it on their end.' },
  ],
};

interface ContextualFaqTipsProps {
  selectedCategory?: RequestCategory;
}

export function ContextualFaqTips({ selectedCategory }: ContextualFaqTipsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const faqs = selectedCategory ? categoryFaqs[selectedCategory] : null;
  if (!faqs) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <HelpCircle className="h-4 w-4" />
        <span>Need help with this step?</span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-4">
        {faqs.map((faq, i) => (
          <div key={i}>
            <p className="text-sm font-medium">{faq.q}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{faq.a}</p>
          </div>
        ))}
        <Link to="/support" className="text-xs text-primary underline block mt-2">
          Browse all FAQs →
        </Link>
      </CollapsibleContent>
    </Collapsible>
  );
}

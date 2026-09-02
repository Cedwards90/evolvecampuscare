import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  HelpCircle, 
  FileText, 
  MessageCircle, 
  Phone, 
  Mail, 
  AlertTriangle,
  BookOpen,
  Users,
  Shield,
  Clock,
  ChevronRight,
  Search
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useAuth } from '@/contexts/AuthContext';
import { GettingStartedSection } from '@/components/support/GettingStartedSection';
import { HowItWorks } from '@/components/support/HowItWorks';

// ── FAQ Data ────────────────────────────────────────────────

type FaqCategory = 'Account & Profile' | 'Submitting Requests' | 'Tracking & Scheduling' | 'Privacy & Security' | 'Getting More Help';

interface Faq {
  question: string;
  answer: string;
  category: FaqCategory;
  relatedLink?: string;
}

const studentFaqData: Faq[] = [
  // Account & Profile
  { category: 'Account & Profile', question: 'How do I complete my profile and intake survey?', answer: 'After signing up, you\'ll be guided to an intake survey that helps us understand your needs. You can also access it anytime from your Dashboard if you skipped it initially. The survey covers areas like academic goals, financial situation, and wellbeing -- all optional and confidential.', relatedLink: '/intake-survey' },
  { category: 'Account & Profile', question: 'How do I reset my password?', answer: 'Click "Forgot Password?" on the login page and enter your email. You\'ll receive a link to create a new password. The link expires after 24 hours. If you have two-factor authentication enabled, you\'ll need your authenticator app after clicking the reset link.', relatedLink: '/forgot-password' },
  { category: 'Account & Profile', question: 'How do I change my notification preferences?', answer: 'Go to Settings → Notifications. You can choose to receive email alerts for request updates, new messages, and appointment reminders. You can turn each type on or off independently.', relatedLink: '/settings' },
  { category: 'Account & Profile', question: 'Who can see my personal information?', answer: 'Only your assigned case manager and platform administrators can view your profile details and requests. Other students cannot see your information. All data is encrypted and handled according to FERPA and GDPR standards.' },

  // Submitting Requests
  { category: 'Submitting Requests', question: 'How do I submit a support request?', answer: 'Navigate to "Submit Request" from the sidebar. You\'ll walk through four steps: 1) Choose a category, 2) Describe your situation and set priority, 3) Attach any supporting documents, and 4) Review and submit. You\'ll receive a confirmation and can track your request anytime.', relatedLink: '/requests/new' },
  { category: 'Submitting Requests', question: 'What do the categories mean?', answer: 'Academic -- course enrollment, grades, advising, academic probation.\nFinancial -- tuition, scholarships, emergency funds, payment plans.\nMental Health -- counseling referrals, stress, wellness support.\nHousing -- dorm issues, roommate conflicts, housing insecurity.\nOther -- anything that doesn\'t fit above; we\'ll route it to the right team.' },
  { category: 'Submitting Requests', question: 'What are the priority levels and how do they affect response time?', answer: 'Low -- general inquiry, no time pressure (reviewed within 3-5 business days).\nMedium -- needs attention within a few days (1-3 business days).\nHigh -- urgent, needs attention soon (within 24 hours).\nEmergency -- critical situation requiring immediate help (escalated automatically, typically addressed within hours).' },
  { category: 'Submitting Requests', question: 'What qualifies as an emergency request?', answer: 'Emergency requests are for situations requiring immediate attention, such as housing crises, immediate financial hardship affecting basic needs, or mental health emergencies. These are escalated automatically and receive priority handling. If you\'re in immediate danger, please call 911 or the 988 Suicide & Crisis Lifeline.' },
  { category: 'Submitting Requests', question: 'Can I save a draft and submit later?', answer: 'Yes! If you lose connectivity or navigate away, the platform can save your request as an offline draft. You\'ll find your drafts on the Offline Drafts page and can submit them once you\'re back online.', relatedLink: '/requests/drafts' },
  { category: 'Submitting Requests', question: 'Can I attach files to my request?', answer: 'Yes. In Step 3 of the submission process you can upload supporting documents like PDFs, images, or Word files (up to 10 MB each). Attachments are stored securely and only visible to your case manager and administrators.' },

  // Tracking & Scheduling
  { category: 'Tracking & Scheduling', question: 'How do I track my request status?', answer: 'Go to "Track Requests" in the sidebar. Each request shows a visual timeline with stages: Submitted → Assigned → In Progress → Resolved. You\'ll also receive notifications when the status changes.', relatedLink: '/requests/mine' },
  { category: 'Tracking & Scheduling', question: 'What do the status stages mean?', answer: 'Submitted -- your request has been received and is awaiting review.\nIn Progress -- a case manager is actively working on your request.\nEscalated -- your request has been flagged for higher-level attention.\nResolved -- your request has been addressed and closed.\nCancelled -- the request was withdrawn.' },
  { category: 'Tracking & Scheduling', question: 'How can I schedule a meeting with my case manager?', answer: 'Open one of your requests from the Track Requests page and click "Schedule Meeting." You\'ll see available time slots to choose from. Your case manager will be notified and the meeting will appear on both your calendars.', relatedLink: '/requests/mine' },
  { category: 'Tracking & Scheduling', question: 'Can I edit my request after submitting?', answer: 'You can add comments and messages to any active request. However, once a request is submitted, the original details (title, category, description) cannot be modified to preserve an accurate record.' },
  { category: 'Tracking & Scheduling', question: 'How long does it take to get a response?', answer: 'Most requests are reviewed within 24-48 business hours. Emergency requests are prioritized and typically addressed within a few hours. You\'ll receive a notification when your case manager responds or updates your request.' },

  // Privacy & Security
  { category: 'Privacy & Security', question: 'Is my data secure?', answer: 'Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We follow FERPA, GDPR, and CCPA guidelines. Access is restricted through role-based permissions -- only authorized staff can view your information.' },
  { category: 'Privacy & Security', question: 'Who can access my requests and messages?', answer: 'Your assigned case manager and platform administrators can view your requests, messages, and uploaded files. Other students and unassigned staff members cannot see your data.' },
  { category: 'Privacy & Security', question: 'How do I delete my account or request data removal?', answer: 'Go to Settings → Account and select "Delete My Account." This will remove your profile and personal data. You can also contact support to request selective data removal in accordance with GDPR/CCPA rights.', relatedLink: '/settings' },

  // Getting More Help
  { category: 'Getting More Help', question: 'What if I can\'t find the right category for my issue?', answer: 'Choose "Other" when submitting your request. Your case manager will review it and route it to the appropriate department. You can also describe your situation in the description field and we\'ll figure out the best way to help.' },
  { category: 'Getting More Help', question: 'What happens if my request is escalated?', answer: 'Escalation means your request has been flagged for higher-level review -- usually because it requires additional resources or a faster response. An administrator or senior case manager will take over. You\'ll be notified of any changes.' },
  { category: 'Getting More Help', question: 'Where can I find campus resources without filing a request?', answer: 'Check the "Self-Help Resources" section below for direct links to Academic Tutoring, Financial Aid, Counseling Services, and Housing. You can also visit the Evolve Foundation website for additional support.', relatedLink: 'https://www.evolvefoundation.us' },
];

const caseManagerFaqs: Faq[] = [
  { category: 'Getting More Help', question: 'How do I prioritize my caseload?', answer: 'Your dashboard shows requests sorted by priority and age. Emergency cases appear at the top with red indicators. Use the filters to focus on specific categories or priorities. AI-generated insights can help identify urgent cases.' },
  { category: 'Getting More Help', question: 'How do I reassign a request to another case manager?', answer: 'Contact an administrator to reassign requests. Admins can reassign requests from the Admin Dashboard by clicking on the request and selecting a new case manager.' },
  { category: 'Getting More Help', question: 'How do I mark a request as resolved?', answer: 'Open the request details and click the "Resolve" button. You\'ll be asked to add resolution notes. The student will be notified automatically when their request is marked as resolved.' },
  { category: 'Getting More Help', question: 'How do AI insights work?', answer: 'AI analyzes request patterns, priorities, and content to provide suggestions. These insights appear on your dashboard and help identify trends or cases that may need attention. You can dismiss insights once reviewed.' },
];

const adminFaqs: Faq[] = [
  { category: 'Getting More Help', question: 'How do I assign students to case managers?', answer: 'Go to User Management → Student Assignments tab. You can assign individual students or use bulk assignment for multiple students. When students are assigned, their future requests automatically route to their assigned case manager.' },
  { category: 'Getting More Help', question: 'How do I invite new users?', answer: 'Navigate to User Management and click "Invite User". Enter the email address and select a role (student, case manager, or admin). The user will receive an email invitation to create their account.' },
  { category: 'Getting More Help', question: 'How do I monitor case manager workloads?', answer: 'The Admin Dashboard shows real-time workload metrics for each case manager including active requests, emergency cases, and average response times. Click on a case manager to see their full caseload.' },
  { category: 'Getting More Help', question: 'How do I handle escalated requests?', answer: 'Escalated requests appear with orange indicators on your dashboard. You can reassign them to a different case manager, or work directly with the assigned case manager to resolve the issue.' },
];

const faqCategories: FaqCategory[] = [
  'Account & Profile',
  'Submitting Requests',
  'Tracking & Scheduling',
  'Privacy & Security',
  'Getting More Help',
];

const quickLinks = [
  { title: 'Submit a Request', description: 'Create a new support request', icon: FileText, href: '/requests/new', roles: ['student'] },
  { title: 'Track Requests', description: 'View and manage your requests', icon: Clock, href: '/requests/mine', roles: ['student'] },
  { title: 'Manage Requests', description: 'Review and process student requests', icon: Users, href: '/requests/queue', roles: ['case_manager'] },
  { title: 'Admin Dashboard', description: 'Monitor system and manage users', icon: Shield, href: '/admin', roles: ['admin'] },
];

// ── Component ───────────────────────────────────────────────

export default function SupportCenter() {
  const { role } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FaqCategory | 'All'>('All');

  const allFaqs = useMemo(() => {
    switch (role) {
      case 'admin':
        return [...studentFaqData, ...caseManagerFaqs, ...adminFaqs];
      case 'case_manager':
        return [...studentFaqData, ...caseManagerFaqs];
      default:
        return studentFaqData;
    }
  }, [role]);

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allFaqs.filter(faq => {
      const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
      const matchesSearch = !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allFaqs, searchQuery, activeCategory]);

  const filteredQuickLinks = quickLinks.filter(
    link => !role || link.roles.includes(role)
  );

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <PageHeader
          title="Support Center"
          description="Find answers, resources, and ways to get help"
        />

        {/* Getting Started: guided tour + first-5-minutes checklist */}
        <GettingStartedSection />

        {/* How the platform works */}
        <HowItWorks />

        {/* Emergency Contact Banner */}
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-destructive">Emergency Support</h3>
              <p className="text-sm text-muted-foreground">
                For immediate crisis support, contact our emergency line or submit an emergency request.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href="tel:+1-800-123-4567">
                  <Phone className="h-4 w-4" />
                  Crisis Line
                </a>
              </Button>
              {role === 'student' && (
                <Button size="sm" className="gap-2" asChild>
                  <Link to="/requests/new?emergency=true">
                    <AlertTriangle className="h-4 w-4" />
                    Emergency Request
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredQuickLinks.map((link) => (
              <Card key={link.href} className="hover:border-primary/50 transition-colors">
                <Link to={link.href}>
                  <CardHeader className="pb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-base flex items-center gap-2">
                      {link.title}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </h2>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge
              variant={activeCategory === 'All' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveCategory('All')}
            >
              All
            </Badge>
            {faqCategories.map((cat) => (
              <Badge
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          {/* Result Count */}
          <p className="text-sm text-muted-foreground mb-3">
            Showing {filteredFaqs.length} of {allFaqs.length} questions
          </p>

          {filteredFaqs.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`} className="px-6">
                      <AccordionTrigger className="text-left">
                        <div>
                          <span>{faq.question}</span>
                          <Badge variant="secondary" className="ml-2 text-[10px] font-normal hidden sm:inline-flex">
                            {faq.category}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground whitespace-pre-line">
                        {faq.answer}
                        {faq.relatedLink && (
                          <div className="mt-3">
                            {faq.relatedLink.startsWith('http') ? (
                              <a href={faq.relatedLink} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                                Learn more →
                              </a>
                            ) : (
                              <Link to={faq.relatedLink} className="text-primary underline text-sm">
                                Go to this page →
                              </Link>
                            )}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No matching questions found</p>
                <p className="text-sm text-muted-foreground mt-1">Try different keywords or browse all categories</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Still Need Help? CTA */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
            <div>
              <h3 className="font-semibold text-lg">Still need help?</h3>
              <p className="text-sm text-muted-foreground">
                Didn't find what you were looking for? We're here to help.
              </p>
            </div>
            <div className="flex gap-3">
              {role === 'student' && (
                <Button asChild>
                  <Link to="/requests/new">Submit a Request</Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <a href="mailto:support@evolvefoundation.us">Contact Support</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Options */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Contact Us
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Email Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">For general inquiries and non-urgent questions</p>
                <Button variant="outline" size="sm" asChild>
                  <a href="mailto:support@evolvefoundation.us">support@evolvefoundation.us</a>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Phone Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Available Monday-Friday, 9am-5pm EST</p>
                <Button variant="outline" size="sm" asChild>
                  <a href="tel:+1-800-123-4567">1-800-123-4567</a>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Guides and tutorials for using the platform</p>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://www.evolvefoundation.us" target="_blank" rel="noopener noreferrer">View Guides</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Self-Help Resources */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Self-Help Resources
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Before submitting a request, check if one of these resources can help right away.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Academic Tutoring', desc: 'Free peer tutoring, writing labs, and study groups.', icon: BookOpen, href: '#' },
              { title: 'Financial Aid Office', desc: 'Scholarship deadlines, FAFSA help, and payment plans.', icon: FileText, href: '#' },
              { title: 'Counseling Services', desc: 'Confidential counseling, support groups, and wellness workshops.', icon: Users, href: '#' },
              { title: 'Housing Office', desc: 'Room changes, maintenance requests, and housing contracts.', icon: Shield, href: '#' },
            ].map((res) => (
              <Card key={res.title} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <res.icon className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-base">{res.title}</CardTitle>
                  <CardDescription className="mt-1">{res.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Crisis & External Resources */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Crisis & External Resources
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">National Hotlines</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>988 Suicide & Crisis Lifeline</strong> -- Call or text 988</li>
                    <li>• <strong>Crisis Text Line</strong> -- Text HOME to 741741</li>
                    <li>• <strong>SAMHSA Helpline</strong> -- 1-800-662-4357</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Campus Quick Contacts</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Counseling & Psychological Services</li>
                    <li>• Campus Security / Emergency</li>
                    <li>• <a href="https://www.evolvefoundation.us" target="_blank" rel="noopener noreferrer" className="text-primary underline">Evolve Foundation</a></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </SidebarLayout>
  );
}

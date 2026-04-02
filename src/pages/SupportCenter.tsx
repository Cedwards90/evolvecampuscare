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
  ChevronRight
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useAuth } from '@/contexts/AuthContext';

const studentFaqs = [
  {
    question: "How do I submit a support request?",
    answer: "Navigate to 'Submit Request' from the sidebar menu. Fill out the form with your request details, select the appropriate category and priority, and click Submit. You'll receive a confirmation and can track your request status anytime."
  },
  {
    question: "How long does it take to get a response?",
    answer: "Most requests are reviewed within 24-48 business hours. Emergency requests are prioritized and typically addressed within a few hours. You'll receive notifications when your request status changes."
  },
  {
    question: "How can I schedule a meeting with my case manager?",
    answer: "Go to 'Track Requests' and select a request. You'll find a 'Schedule Meeting' button that opens a calendar to choose an available time slot. Your case manager will receive a notification and the meeting will be added to both calendars."
  },
  {
    question: "What qualifies as an emergency request?",
    answer: "Emergency requests are for situations requiring immediate attention, such as housing crises, immediate financial hardship affecting basic needs, or mental health emergencies. These are escalated automatically and receive priority handling."
  },
  {
    question: "Can I edit my request after submitting?",
    answer: "You can edit requests that are still in 'Submitted' status. Once a case manager begins working on your request, you can add comments but cannot modify the original details."
  },
];

const caseManagerFaqs = [
  {
    question: "How do I prioritize my caseload?",
    answer: "Your dashboard shows requests sorted by priority and age. Emergency cases appear at the top with red indicators. Use the filters to focus on specific categories or priorities. AI-generated insights can help identify urgent cases."
  },
  {
    question: "How do I reassign a request to another case manager?",
    answer: "Contact an administrator to reassign requests. Admins can reassign requests from the Admin Dashboard by clicking on the request and selecting a new case manager."
  },
  {
    question: "How do I mark a request as resolved?",
    answer: "Open the request details and click the 'Resolve' button. You'll be asked to add resolution notes. The student will be notified automatically when their request is marked as resolved."
  },
  {
    question: "How do AI insights work?",
    answer: "AI analyzes request patterns, priorities, and content to provide suggestions. These insights appear on your dashboard and help identify trends or cases that may need attention. You can dismiss insights once reviewed."
  },
];

const adminFaqs = [
  {
    question: "How do I assign students to case managers?",
    answer: "Go to User Management → Student Assignments tab. You can assign individual students or use bulk assignment for multiple students. When students are assigned, their future requests automatically route to their assigned case manager."
  },
  {
    question: "How do I invite new users?",
    answer: "Navigate to User Management and click 'Invite User'. Enter the email address and select a role (student, case manager, or admin). The user will receive an email invitation to create their account."
  },
  {
    question: "How do I monitor case manager workloads?",
    answer: "The Admin Dashboard shows real-time workload metrics for each case manager including active requests, emergency cases, and average response times. Click on a case manager to see their full caseload."
  },
  {
    question: "How do I handle escalated requests?",
    answer: "Escalated requests appear with orange indicators on your dashboard. You can reassign them to a different case manager, or work directly with the assigned case manager to resolve the issue."
  },
];

const quickLinks = [
  {
    title: "Submit a Request",
    description: "Create a new support request",
    icon: FileText,
    href: "/student-submitting-a-support-request",
    roles: ['student'],
  },
  {
    title: "Track Requests",
    description: "View and manage your requests",
    icon: Clock,
    href: "/student-tracking-request-status-scheduling-meeting",
    roles: ['student'],
  },
  {
    title: "Manage Requests",
    description: "Review and process student requests",
    icon: Users,
    href: "/case-manager-managing-student-requests",
    roles: ['case_manager'],
  },
  {
    title: "Admin Dashboard",
    description: "Monitor system and manage users",
    icon: Shield,
    href: "/admin-monitoring-reassigning-requests",
    roles: ['admin'],
  },
];

export default function SupportCenter() {
  const { role } = useAuth();

  const getFaqsForRole = () => {
    switch (role) {
      case 'admin':
        return [...adminFaqs, ...caseManagerFaqs, ...studentFaqs];
      case 'case_manager':
        return [...caseManagerFaqs, ...studentFaqs];
      default:
        return studentFaqs;
    }
  };

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
                  <Link to="/student-submitting-a-support-request?emergency=true">
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
          <Card>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {getFaqsForRole().map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="px-6">
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

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
                <p className="text-sm text-muted-foreground mb-3">
                  For general inquiries and non-urgent questions
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="mailto:support@evolvefoundation.us">
                    support@evolvefoundation.us
                  </a>
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
                <p className="text-sm text-muted-foreground mb-3">
                  Available Monday-Friday, 9am-5pm EST
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="tel:+1-800-123-4567">
                    1-800-123-4567
                  </a>
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
                <p className="text-sm text-muted-foreground mb-3">
                  Guides and tutorials for using the platform
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://www.evolvefoundation.us" target="_blank" rel="noopener noreferrer">
                    View Guides
                  </a>
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

        {/* Additional Resources */}
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
                    <li>• <strong>988 Suicide & Crisis Lifeline</strong> — Call or text 988</li>
                    <li>• <strong>Crisis Text Line</strong> — Text HOME to 741741</li>
                    <li>• <strong>SAMHSA Helpline</strong> — 1-800-662-4357</li>
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

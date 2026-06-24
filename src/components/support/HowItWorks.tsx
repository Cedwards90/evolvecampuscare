import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const sections = [
  {
    title: 'Who does what on the platform',
    body: `Students submit requests, message their assigned case manager, complete check-ins and Life Skills surveys, and plan for life after graduation.
Case Managers respond to requests, manage student folders, send surveys, log time, and generate reports.
Org Admins oversee a single organization — its case managers, students, requests, and analytics.
Admins manage the whole platform: users, organizations, NDA, QR codes, and global settings.`,
  },
  {
    title: 'How a support request flows',
    body: `1. A student submits a request (academic, financial, mental health, housing, or other) and sets a priority.
2. The request auto-routes to the student's assigned case manager. If none is assigned, it lands in the admin's "unassigned" queue.
3. The case manager reviews, optionally messages the student, schedules a meeting, and updates the status.
4. Emergencies are escalated automatically and notify admins and case managers.
5. Once resolved, the student is notified and can view the full timeline in Track Requests.`,
  },
  {
    title: 'Messaging rules',
    body: `Messaging is strictly 1-to-1 between a student and their assigned case manager — no group chats, no peer messaging.
This protects privacy and keeps a clear paper trail. Admins can view threads when needed for support but don't participate.`,
  },
  {
    title: 'Surveys, check-ins, and impact reports',
    body: `Weekly check-ins capture mood, progress, wins, and blockers.
Life Skills surveys are sent per module with a pre/post pair to measure confidence gains.
Post-graduation plans capture a student's 12-month roadmap.
Admins and Org Admins can generate per-survey impact reports with PDF and CSV export.`,
  },
  {
    title: 'Security & privacy',
    body: `All staff (Admin, Case Manager, Org Admin) must enable two-factor authentication.
Students never use MFA but are protected by strong password rules.
Data is encrypted at rest (AES-256) and in transit (TLS 1.3).
Org Admins only see data for users in their organization(s); Case Managers only see their assigned students.
Access is governed by Row-Level Security policies enforced at the database layer.`,
  },
  {
    title: 'Notifications',
    body: `You'll get in-app notifications for request status changes, new messages, survey invitations, and meeting confirmations.
Email notifications can be customized in Settings → Notifications.
Admins can adjust site-wide notification settings in the admin area.`,
  },
];

export function HowItWorks() {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5" />
        How the platform works
      </h2>
      <Card>
        <CardContent className="p-0">
          <Accordion type="single" collapsible className="w-full">
            {sections.map((s, i) => (
              <AccordionItem key={i} value={`hiw-${i}`} className="px-6">
                <AccordionTrigger className="text-left text-sm font-medium">
                  {s.title}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground whitespace-pre-line text-sm">
                  {s.body}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}

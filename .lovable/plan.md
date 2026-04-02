

## Plan: UX Polish — Five Targeted Improvements

### 1. Enhanced Category Selection with Examples
**File:** `src/pages/SubmitRequest.tsx`

The categories array already has a `description` field (e.g. "Course registration, grades, academic advising"). Currently these are shown as short descriptions. Expand each with 2-3 concrete example scenarios so students can confidently classify ambiguous issues. Also add a small "Not sure?" hint below the category grid pointing to "Other" as a catch-all.

### 2. Visual Request Timeline on Track Requests Page
**File:** `src/pages/TrackRequests.tsx`

Currently the tracking page shows request cards with status/priority badges. Add a compact visual stepper/timeline beneath each request card showing the progression: Submitted → Assigned → In Progress → Meeting Scheduled → Resolved. Highlight the current step and grey out future steps. This reuses the status data already available on each request and the `appointments` query.

### 3. Automated Welcome Message for New Conversations
**File:** `src/hooks/useSubmitRequest.ts`

After a request is successfully created and a case manager is auto-assigned, insert an automated `staff_messages` entry from the system (using the case manager's ID as sender) with a templated acknowledgement: "Your request has been received and assigned to [Case Manager Name]. You'll hear back within 24-48 hours." This ensures the Messages page is never empty for students who have an assigned case manager.

**File:** `src/pages/TrackRequests.tsx` — Add a small info banner for unassigned requests: "Your request is being reviewed. A case manager will be assigned shortly."

### 4. Privacy & Compliance Banner on Landing Page
**File:** `src/pages/Landing.tsx`

Expand the existing "Secure & Private" feature card into a dedicated "Your Privacy Matters" section near the footer. List specific compliance measures: GDPR/CCPA data rights, AES-256 encryption at rest, TLS 1.3 in transit, MFA for staff accounts, session timeouts, and a link to the privacy policy.

### 5. Self-Help Resource Links in Support Center
**File:** `src/pages/SupportCenter.tsx`

Add a "Self-Help Resources" section above or alongside the FAQ with categorized external/internal resource links: academic tutoring centers, financial aid office hours, campus counseling services, housing office contacts. This helps students resolve routine questions without filing a request.

---

### File Summary

| File | Change |
|------|--------|
| `src/pages/SubmitRequest.tsx` | Richer category descriptions with examples, "Not sure?" hint |
| `src/pages/TrackRequests.tsx` | Visual step-progress timeline per request, unassigned info banner |
| `src/hooks/useSubmitRequest.ts` | Auto-send welcome message when case manager is assigned |
| `src/pages/Landing.tsx` | Privacy & compliance details section |
| `src/pages/SupportCenter.tsx` | Self-help resource links section |


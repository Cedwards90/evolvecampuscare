

## Plan: Enhanced Student FAQ with Categories, Search, and Contextual Help

### Overview
Transform the current flat FAQ list into a structured, searchable, category-organized knowledge base for students. Add a search bar with filtering, group FAQs by portal categories, expand content to cover all workflows, and add contextual FAQ tips inside the request submission page.

### 1. Restructure FAQ Data with Categories
**File:** `src/pages/SupportCenter.tsx`

Replace the flat `studentFaqs` array with a categorized structure:

```text
Categories:
- Account & Profile (sign up, password reset, profile settings, notifications)
- Submitting Requests (how to submit, categories explained, priorities, emergency, drafts)
- Tracking & Scheduling (status tracking, timeline stages, scheduling meetings, editing requests)
- Privacy & Security (data handling, who sees my info, password security)
- Resources & Escalation (self-help links, what if FAQ doesn't help, escalation process)
```

Each FAQ gets a `category` tag and optional `relatedLink` for deep-linking to the relevant page.

### 2. Add Search Bar and Category Filter Tabs
**File:** `src/pages/SupportCenter.tsx`

- Add a search `Input` above the FAQ accordion with a `Search` icon and placeholder "Search for help..."
- Add horizontal filter tabs/badges for each FAQ category (using existing `Badge` or `Button` components)
- Client-side filtering: match search text against question + answer, filter by selected category
- Show result count (e.g. "Showing 4 of 22 questions")
- If no results, show "No matching questions" with a link to submit a request

### 3. Expand Student FAQ Content (~20-25 questions)
**File:** `src/pages/SupportCenter.tsx`

Add FAQs covering all portal workflows:

**Account & Profile** (4 questions)
- How do I complete my profile / intake survey?
- How do I reset my password?
- How do I change my notification preferences?
- Who can see my personal information?

**Submitting Requests** (6 questions)
- How do I submit a support request? (existing, enhanced with step list)
- What do the categories mean? (Academic, Financial, Mental Health, Housing, Other — with examples)
- What are the priority levels and how do they affect response time?
- What qualifies as an emergency request? (existing)
- Can I save a draft and submit later?
- Can I attach files to my request?

**Tracking & Scheduling** (5 questions)
- How do I track my request status? (with timeline stages explained)
- What do the status stages mean? (Submitted → Assigned → In Progress → Resolved)
- How can I schedule a meeting with my case manager? (existing)
- Can I edit my request after submitting? (existing)
- How long does it take to get a response? (existing)

**Privacy & Security** (3 questions)
- Is my data secure?
- Who can access my requests and messages?
- How do I delete my account or request data removal?

**Getting More Help** (3 questions)
- What if I can't find the right category for my issue?
- What happens if my request is escalated?
- Where can I find campus resources without filing a request?

### 4. Add "Still Need Help?" CTA
**File:** `src/pages/SupportCenter.tsx`

After the FAQ accordion, add a card with:
- "Didn't find what you were looking for?"
- Buttons: "Submit a Request" and "Contact Support"

### 5. Add Contextual FAQ Tips to Request Submission Page
**File:** `src/pages/SubmitRequest.tsx`

Add a small collapsible "Need help?" section in the sidebar or below the category selector showing 2-3 context-relevant FAQs based on the currently selected category. Uses the `Collapsible` component already available.

### Summary

| File | Change |
|------|--------|
| `src/pages/SupportCenter.tsx` | Restructure FAQs into categories, add search bar + category filters, expand to ~22 student questions, add "Still Need Help?" CTA |
| `src/pages/SubmitRequest.tsx` | Add contextual FAQ tips based on selected category |


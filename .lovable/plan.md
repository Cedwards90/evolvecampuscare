# Fund Eligibility, Partial Approvals & Platform Chatbot

## 1. Students never touch fund allocation

Students only submit a request (category, amount, purpose, documentation). Fund routing (Barrier Mitigation vs Alumni Support), balances, caps, approval tiers, and recommendations stay staff-only.

- Audit every student-visible surface (submit wizard, request tracking, request detail, dashboard, PDFs) and confirm no fund label, balance, cap, or recommendation is rendered for the student role; remove anything that leaks.
- Keep the policy card and recommendation gated to admin / case manager / org admin, and never send fund fields into student-facing exports.

## 2. Recommendations based on eligibility, not just amount

Encode the Program Operations Manual rules so the decision reflects *what* is being requested, not only how much.

Fund routing (unchanged concept, now with a window):
- Barrier Mitigation: active enrollment (request before graduation date).
- Alumni Support: post-graduation, only within 12 months of graduation. Beyond 12 months is flagged as outside the Alumni window.

Eligibility rules per fund, from the manual:
- Barrier eligible: state ID / birth certificate, work tools & boots, transportation passes, background check / expungement filing fees, initial work uniforms, emergency food & utilities.
- Barrier ineligible: personal cash loans, traffic tickets / fines, entertainment, gift cards without itemized receipts, tobacco / alcohol, secondary party transfers.
- Alumni eligible: professional licensing fees, advanced training tuition, auto repairs for commuting, specialized equipment, emergency rental assistance.
- Alumni ineligible: recurring monthly personal bills, legal defense fees, bail / bond payments, non-essential travel.
- Universal rules: third-party documentation required (invoice, estimate, vendor bill); direct cash to participants prohibited; expense that belongs to the *other* fund is flagged as wrong-fund rather than silently approved.

The engine classifies the request into eligible / ineligible / unclear expense types from category, purpose, and description, and states plainly which manual rule drove the result. When classification is unclear it says "needs reviewer confirmation" instead of guessing — no fabricated certainty.

## 3. Partial approvals in the decision

Two complementary paths:

- **Recommended reduced amount** (default): the engine computes a qualifying amount — the portion within the remaining fund balance, within the $500 single-disbursement cap, and attributable to eligible expenses — and recommends `Approve reduced` with the exact figure and the reason for the reduction (cap, balance, or ineligible portion).
- **Optional line items**: a reviewer can itemize the request (e.g. work boots $180, traffic ticket $120), mark each line eligible / ineligible, and the approved total is the sum of approved lines. Line items feed the recommendation and are stored with the request for audit.

Decision output shown to reviewers: Approve, Approve reduced (with amount), Approve with Executive Leadership (Tier 2, $501–$1,000 or any single disbursement over $500), Deny, or Needs more information — each with the blockers, the rationale, and the balance math (approved to date, this request, balance after, overage). Rationale remains required whenever the decision isn't a clean approval, and it is written to the request timeline. Everything stays advisory: staff make the final call.

## 4. Platform chatbot (role-aware, knowledge only)

A chat assistant available to all signed-in users, answering from curated platform knowledge — no access to any user's records.

- Knowledge base: financial assistance policy (two funds, caps, tiers, eligible/ineligible lists, documentation rules), how to submit and track a request, surveys and check-ins, meetings, reporting basics, and staff workflows.
- Role-aware: students get how-to and general eligibility guidance; staff also get policy detail, fund routing, approval tiers, and reporting guidance. Staff-only content is never returned to a student.
- Explicitly declines personal-data questions ("how much do I have left?") and points the user to their case manager or the request page instead.
- Clear AI disclosure, streamed answers, markdown rendering, and honest "I don't know — contact your case manager" when the knowledge base doesn't cover the question.

## Technical notes

- Policy engine (`src/lib/financialAssistancePolicy.ts`): add expense classification (fund-scoped eligible/ineligible keyword sets from the manual), a 12-month alumni window check, wrong-fund detection, documentation-required rule, qualifying-amount math, line-item support, and extend `PolicyDecision` with a `needs_more_info` state. Unit tests cover each rule, each decision branch, both funds, and partial-approval math.
- UI: `FinancialPolicyRecommendation` / `RequestPolicyCard` gain the eligibility verdict with the cited rule, reduction reason, and an optional line-item editor inside `RequestActions`.
- Database: a small `request_line_items` table (request id, label, amount, eligible flag, note) with RLS restricted to staff who can access the request, plus service_role grants. No changes to existing amount columns.
- Chatbot: new `platform-assistant` edge function calling Lovable AI (`google/gemini-3.7-flash`) with a role-aware system prompt plus a curated knowledge document in the repo; JWT validated in-code, role read server-side, streamed response. Client is a floating chat panel using existing UI primitives; no chat history persistence.
- Scope limited to the files above plus the new chatbot files; no other behavior changes.

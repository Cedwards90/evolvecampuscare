

## Plan: Survey Question Preview for Staff

### Overview
Add a "Preview" button to the Survey Responses page that lets admins and case managers view the actual survey forms (read-only) exactly as students see them -- without needing to submit anything.

### Changes

**1. `src/pages/admin/SurveyResponses.tsx`** — Add preview tabs/buttons
- Add a "Preview Check-In Form" and "Preview Post-Graduation Plan" button at the top of the page (or as a third tab called "Survey Templates")
- Each button opens a dialog showing the survey form in read-only mode with all questions, labels, placeholders, and rating scales visible
- No database changes needed -- this is purely a UI preview of the hardcoded form structure

**2. `src/components/admin/SurveyPreviewDialog.tsx`** — New component
- A dialog that renders a read-only version of either the check-in or post-graduation plan form
- Shows all questions with their labels, helper text, and input types (sliders, textareas, date pickers) but disabled/non-interactive
- Clearly labeled as "Preview -- this is what students see"

### File Summary

| File | Action |
|------|--------|
| `src/components/admin/SurveyPreviewDialog.tsx` | Create -- read-only survey preview |
| `src/pages/admin/SurveyResponses.tsx` | Add preview buttons/tab |

No database or RLS changes needed.


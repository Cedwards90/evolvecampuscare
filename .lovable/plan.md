## Goal
Make the Life Skills row descriptions read horizontally instead of wrapping into a narrow column. Only touch the Surveys index card layout; wording text is unchanged.

## Change
In `src/pages/admin/SurveysIndex.tsx` (`SurveyCard`):

1. Change the card's outer flex from `sm:flex-row sm:items-center` to `lg:flex-row lg:items-center` so the info block gets the card's full width until a wide viewport, letting the description sit on a single line at typical widths.
2. Put title, badge, description, and count on one horizontal row (flex-wrap) instead of stacked paragraphs:
   - `<div class="flex flex-wrap items-center gap-x-3 gap-y-1">` containing: title, optional badge, muted-dot separator, description, muted-dot separator, count.
   - Dots use `<span class="text-muted-foreground/60">·</span>` and hide when the adjacent field is empty.
3. Keep the actions row as-is (already wraps).

## Out of scope
- `topicPhrase` copy, template descriptions, or the "Pre + Post surveys combined…" sentence.
- Non–Life Skills rows (they use the same `SurveyCard` and will benefit from the same horizontal layout automatically — no separate behavior needed).
- Any other page.

## Files touched
- `src/pages/admin/SurveysIndex.tsx` (SurveyCard JSX only)

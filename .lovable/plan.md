## Goal
In the Life Skills section on `/admin/surveys`, move the module description onto its own line across the top of each card, instead of sitting inline with the title.

## Change
In `src/pages/admin/SurveysIndex.tsx` (`SurveyCard` component only):

- Restructure the info block so the description renders as a full-width row at the top of the card.
- Below it, keep title + optional badge + count on a single horizontal row separated by muted `·` dots.
- Actions row on the right stays unchanged.

Resulting card layout:
```text
[ description across top, full width, muted ]
[ Title  ·  Badge  ·  Count ]           [ Preview | Completions | ... ]
```

- Description hidden when empty (fragments guard it).
- Dots (`text-muted-foreground/60`, `aria-hidden`) only render between non-empty fields.
- All other rows using `SurveyCard` (Core, Intake) get the same layout automatically — matches the current shared-component pattern and requires no separate handling.

## Out of scope
- Wording of `topicPhrase`, template descriptions, or the "Pre + Post surveys combined…" sentence.
- LifeSkillsSurveys page, actions, or any other card/page.

## Files touched
- `src/pages/admin/SurveysIndex.tsx` (SurveyCard JSX only)

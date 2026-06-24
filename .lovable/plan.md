# Fix: Description textarea loses focus on every keystroke

## Root cause

In `src/pages/SubmitRequest.tsx`, a component is defined **inside** the render body:

```tsx
// line 243 — runs on every render, creates a brand-new component type each time
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  standalone ? <>{children}</> : <SidebarLayout>{children}</SidebarLayout>;
```

The page also calls `form.watch('description')` on line 369 to render the live "x/2000 characters" counter, which triggers a re-render on every keystroke. Each re-render produces a *new* `Wrapper` function reference, so React treats it as a different component type and **unmounts + remounts the whole subtree** (sidebar, form, inputs). The textarea is destroyed and recreated → focus is lost.

This matches every symptom in the report and is the single most common cause of "click back into the field after each character" in Lovable/React apps.

## Fix

Stop creating a component inside the render. Inline the conditional wrapping instead, so the JSX tree's component identities stay stable across renders.

### Edit: `src/pages/SubmitRequest.tsx`

1. Delete the `Wrapper` definition (line 243-244).
2. Replace `<Wrapper>…</Wrapper>` in the `return` with an inline conditional that renders the same DOM:

```tsx
const content = (
  <div className="space-y-12 max-w-3xl mx-auto">
    {/* …existing children unchanged… */}
  </div>
);

return standalone ? content : <SidebarLayout>{content}</SidebarLayout>;
```

`SidebarLayout` is a stable import, so its component identity no longer changes between renders, and the textarea keeps its DOM node + focus.

## Verification

- Type a long sentence into the Description field on `/student-submitting-a-support-request` (both the standalone QR flow and the in-app flow) and confirm focus is retained and the character counter still updates.
- Confirm Title, Priority radio, Requested Amount, file upload, emergency switch, and step navigation still work.
- No other behavioral changes — only the Wrapper indirection is removed.

## Out of scope

- No changes to `react-hook-form` config, schema, autosave, or any other field.
- No changes to `SidebarLayout`, routing, or `App.tsx`.
- No styling changes.

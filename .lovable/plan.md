## Problem

In the Submit Request form, every keystroke causes the input to lose focus, so you have to click back into the field to type the next letter.

## Root Cause

In `src/pages/SubmitRequest.tsx` (line 243), a `Wrapper` component is defined **inside** the `SubmitRequest` function body:

```tsx
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  standalone ? <>{children}</> : <SidebarLayout>{children}</SidebarLayout>;
```

Because `Wrapper` is re-created on every render, React sees a brand-new component type each time, unmounts the entire subtree (including `SidebarLayout` and every `Input`/`Textarea`), and re-mounts it. The newly mounted input cannot keep focus, so typing one character drops focus immediately.

This is a well-known React anti-pattern: never declare a component inside another component's render.

## Fix

Replace the inline `Wrapper` with a conditional render that uses the existing `SidebarLayout` component directly — no new component definition per render, stable tree, focus preserved.

```tsx
// remove the inline Wrapper declaration

return standalone ? (
  <div className="space-y-12 max-w-3xl mx-auto">{/* ...existing content... */}</div>
) : (
  <SidebarLayout>
    <div className="space-y-12 max-w-3xl mx-auto">{/* ...existing content... */}</div>
  </SidebarLayout>
);
```

To avoid duplicating the entire body, extract the inner JSX into a `const content = (...)` variable above the return, then render `{standalone ? content : <SidebarLayout>{content}</SidebarLayout>}`.

## Files Touched

- `src/pages/SubmitRequest.tsx` — remove the in-render `Wrapper`, render `SidebarLayout` conditionally around a stable `content` element.

## Out of Scope

- No other components, hooks, routes, or database changes.
- No styling or feature changes to the form itself.

## Verification

- Open `/submit-request`, type a sentence in the Title and Description fields without clicking — characters should appear continuously without focus loss.

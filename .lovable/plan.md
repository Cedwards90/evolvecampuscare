## Problem

On step 4 of the Submit Request wizard, clicking **Submit My Request** does nothing — no toast, no navigation, no network call.

## Root Cause

The submit button is `type="submit"` inside `form.handleSubmit(onSubmit)`. `handleSubmit` runs zod validation first and silently no-ops `onSubmit` if validation fails. Two issues cause silent failure:

1. **`requestedAmount` becomes `NaN`.** The field is registered with `valueAsNumber: true`:
   ```tsx
   {...form.register('requestedAmount', { valueAsNumber: true })}
   ```
   An empty `<input type="number">` returns `""`, which `valueAsNumber` converts to `NaN`. The zod schema is `z.number().min(0).optional()` — `optional()` only allows `undefined`, not `NaN`, so validation fails. This happens whenever the user picked the **Financial** category and left the amount field blank (or typed and then cleared it).

2. **No invalid-handler is wired up.** `form.handleSubmit(onSubmit)` is called without a second argument, so any validation error on a field that isn't rendered on the current step (steps 1–3 fields aren't on step 4) produces no visible feedback.

## Fix (frontend only, `src/pages/SubmitRequest.tsx`)

1. Replace `valueAsNumber: true` on `requestedAmount` with a `setValueAs` that coerces empty / non-numeric input to `undefined`:
   ```tsx
   {...form.register('requestedAmount', {
     setValueAs: (v) =>
       v === '' || v === null || v === undefined || Number.isNaN(Number(v))
         ? undefined
         : Number(v),
   })}
   ```

2. Add an `onInvalid` callback to `form.handleSubmit` so any future silent validation failure surfaces a toast pointing the user to the field that's wrong:
   ```tsx
   <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
     const first = Object.values(errors)[0] as any;
     toast({
       variant: 'destructive',
       title: 'Please fix the form',
       description: first?.message || 'Some fields are missing or invalid.',
     });
   })}>
   ```

## Out of Scope

- No schema, hook, database, or RLS changes.
- No other field behavior changes.
- No styling changes.

## Verification

- Submit a non-financial request → reaches the database and navigates to the request page.
- Submit a financial request with the amount field left blank → no longer fails silently; either submits with `requested_amount = null` or shows a clear toast if the amount is invalid.
- Reach step 4 with a contrived invalid earlier-step field → toast appears instead of nothing happening.

## Files Touched

- `src/pages/SubmitRequest.tsx`

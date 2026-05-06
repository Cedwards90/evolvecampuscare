## Why the NDA appears twice

The NDA gate in `ProtectedRoute` checks `useMyNdaAcceptance(...)` and redirects to `/accept-nda` when `acceptance` is null. After the user clicks "I Accept":

1. `useAcceptNda` calls the edge function and on success calls `qc.invalidateQueries(["nda","acceptance", user?.id])`.
2. `AcceptNda.tsx` immediately `navigate(redirect, { replace: true })` — usually `/dashboard`.
3. The destination page renders `ProtectedRoute`, which re-runs `useMyNdaAcceptance`. Because the previous query already returned `null` (cached), React Query's `isLoading` is `false` even while it's refetching after the invalidate. The gate sees `acceptance == null` and bounces the user back to `/accept-nda`.
4. Moments later the refetch returns the new acceptance row, and the gate finally lets them through — so the user sees the NDA screen a second time before landing on the dashboard.

This is a pure client-side race between "navigate" and "refetch". The DB and edge function are correct (the row is inserted on the first accept).

## Fix (frontend only, ~3 small edits)

### 1. `src/hooks/useNda.ts` — write the acceptance into the cache immediately

In `useAcceptNda.onSuccess`, before invalidating, seed the cached acceptance so any consumer that re-renders sees the user as accepted:

```ts
onSuccess: (_data, ndaDocumentId) => {
  if (user?.id) {
    qc.setQueryData(
      ["nda", "acceptance", user.id, ndaDocumentId],
      { id: "optimistic", accepted_at: new Date().toISOString(), version: 0 },
    );
  }
  qc.invalidateQueries({ queryKey: ["nda", "acceptance", user?.id] });
},
```

The mutation's argument is the `ndaDocumentId`, so we can use it as the second arg of `onSuccess`.

### 2. `src/pages/AcceptNda.tsx` — wait for the cache update before navigating

Change `handleAccept` to await one tick after the mutation resolves so the cache write above is observed by the next route's `ProtectedRoute`:

```ts
await accept.mutateAsync(nda.id);
toast.success("Agreement accepted");
// allow react-query cache write to flush before route change
await Promise.resolve();
navigate(redirect, { replace: true });
```

### 3. `src/components/layouts/ProtectedRoute.tsx` — treat "fetching after invalidate" as loading

Belt-and-suspenders: also wait while React Query is actively refetching the acceptance, so even a future code path that invalidates without seeding can't double-prompt:

```ts
const { data: acceptance, isLoading: accLoading, isFetching: accFetching }
  = useMyNdaAcceptance(nda?.id);
...
if (ndaLoading || accLoading || accFetching) {
  return <spinner />;
}
```

(Only this one block changes; the rest of the gate stays.)

## Out of scope

- No DB / RLS / edge-function changes — `record-nda-acceptance` already writes the row correctly on the first click.
- No change to the NDA copy, signup flow, or any other route.
- No change to the admin NDA management page.

## Verification

After the change, signing up a new test user and accepting the NDA should land directly on `/dashboard` (or the original redirect target) without the NDA screen reappearing. Confirmed by:
1. Sign up → land on `/accept-nda`.
2. Scroll, agree, click "I Accept".
3. Should go straight to `/dashboard` — no second `/accept-nda` flash.

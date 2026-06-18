## Fix: time tracking entry submission error

**Root cause:** `time_entries.start_time` and `end_time` are Postgres `time` columns, but `src/pages/admin/TimeTrackingAdmin.tsx` sends full ISO timestamps (`new Date(start).toISOString()` → `"2026-06-17T19:00:00.000Z"`), which Postgres rejects with `invalid input syntax for type time`.

**Fix:** In `src/pages/admin/TimeTrackingAdmin.tsx`, stop converting the `<input type="datetime-local">` value through `toISOString()`. The input value is already `"YYYY-MM-DDTHH:MM"` in local time — split it to get a `time` string and a `date` string directly.

Apply at both call sites (manual create around line 629 and edit-row around line 778):

```ts
// start, end are "YYYY-MM-DDTHH:MM"
const [startDate, startClock] = start.split('T');
const [, endClock] = end.split('T');
createEntry.mutateAsync({
  ...,
  start_time: `${startClock}:00`,
  end_time: `${endClock}:00`,
  entry_date: startDate,
});
```

No DB, hook, or other-page changes — the bug is localized to this one file. The existing `validate_time_entry` trigger already computes `duration_minutes` from the `time` values.

**Out of scope:** Cross-midnight entries (the trigger would compute a negative duration); flag for follow-up if needed.
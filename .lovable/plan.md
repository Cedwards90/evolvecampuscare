The user wants to add 15 student contact records to profiles. I need to determine: are these existing students (update) or new students to invite (insert)?

Looking at the data — they have emails and names but no auth accounts mentioned. Profiles are created via `handle_new_user()` trigger when a user signs up. We can't create profile rows without an auth user.

Best approach: create user invitations for each so they get signup links, OR if they already have accounts, update existing profiles by email match.

I should ask the user which case applies. But the request says "add these contact details to each students profile" — implying profiles already exist. Let me check by querying the database.

Actually, in plan mode I can read the DB. Let me plan based on both possibilities and ask clarifying.

Plan: 

1. Query existing profiles to see which emails already exist
2. For matches: UPDATE profile with full_name + phone (split first/last → full_name)
3. For non-matches: create user_invitations so they can sign up, and queue phone+name to apply when they accept (or just send invitations and ask user to have students fill in)

Simplest path: UPDATE existing profiles by email; for missing ones, create invitations.

## Plan: Bulk Add Student Contact Details

### Approach

1. Check which of the 15 emails already have profiles in the database.
2. For existing profiles: UPDATE `full_name` (combined first + last) and `phone` directly.
3. For emails without profiles: create student invitations via `user_invitations` so they can sign up; their name/phone will be entered during onboarding (or pre-fill via invitation notes).

### Data normalization

- "First Last" → `full_name` (e.g., "Kydric Estes")
- Phone numbers cleaned to `XXX-XXX-XXXX` format
- Invalid/missing phones (Kevon Howard "Incorrect number", Jacquell Phillips "734-886-600" too short, Armani Johnson missing) → store as NULL with a note
- Trim trailing whitespace on names ("Armani ", "Jimmie D ")

### Steps

1. Query `profiles` with the 15 emails to identify matches
2. Run UPDATE statements for each match (via insert tool — data operation, not schema)
3. Report which emails had no matching profile and offer to send invitations

### File Summary


| Action     | Detail                                                 |
| ---------- | ------------------------------------------------------ |
| DB query   | SELECT existing profiles by email                      |
| DB updates | UPDATE profiles SET full_name, phone WHERE email = ... |
| Optional   | Create `user_invitations` rows for missing emails      |


No code or schema changes needed. Do not add students who are not already in the system. just add the missing details to the students who are there already. 
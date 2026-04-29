-- 1. Backfill missing student roles for users who have a profile but no role
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'student'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE ur.user_id IS NULL;

-- 2. Backfill missing profiles for any auth users that lack one
INSERT INTO public.profiles (user_id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- 3. Backfill student_files for students missing one
INSERT INTO public.student_files (student_id)
SELECT ur.user_id
FROM public.user_roles ur
LEFT JOIN public.student_files sf ON sf.student_id = ur.user_id
WHERE ur.role = 'student' AND sf.student_id IS NULL;

-- 4. Backfill missing roles for any auth users that still lack one (safety net for users with no profile yet)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'student'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL;

-- 5. Attach the existing handle_new_user trigger to auth.users so future signups get a profile + role + student_file
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
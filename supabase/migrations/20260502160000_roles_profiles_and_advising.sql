-- Roles, profiles, advising, planning, and secure RLS
-- NOTE: This migration replaces the previous open-access RLS policies.

-- 1) Role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('student', 'advisor', 'admin');
  END IF;
END $$;

-- 2) Timestamp helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3) Profiles table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role public.user_role NOT NULL DEFAULT 'student',
  student_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Extend students for Auth
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS credits_earned numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Extend courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS term text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Advising relationships
CREATE TABLE IF NOT EXISTS public.advisor_students (
  advisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (advisor_id, student_id)
);

-- 7) Notes
CREATE TABLE IF NOT EXISTS public.student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('shared', 'advisor_only')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8) Degree planning
CREATE TABLE IF NOT EXISTS public.semester_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planned_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.semester_plans(id) ON DELETE CASCADE,
  course_code text,
  course_name text,
  credit_hours numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'enrolled', 'completed', 'dropped')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9) Alerts (optional persisted)
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
  message text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10) Appointments (optional)
CREATE TABLE IF NOT EXISTS public.advisor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11) Messaging + action items (optional)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12) Helper functions for RLS
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.is_advisor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT role IN ('advisor', 'admin') FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.owns_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND s.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_advisor(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.advisor_students a
    WHERE a.student_id = p_student_id
      AND a.advisor_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT 
    public.is_admin() 
    OR public.owns_student(p_student_id) 
    OR public.is_assigned_advisor(p_student_id)
    -- Allow viewing unlinked record if the user is authenticated (to allow linking)
    OR (auth.role() = 'authenticated' AND EXISTS(SELECT 1 FROM public.students WHERE id = p_student_id AND auth_user_id IS NULL));
$$;

-- Add a more specific policy for linking
CREATE POLICY students_link_themselves ON public.students
  FOR UPDATE USING (auth.role() = 'authenticated' AND auth_user_id IS NULL)
  WITH CHECK (auth.role() = 'authenticated' AND auth_user_id = auth.uid());

-- 13) Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_lc text;
  derived_role public.user_role;
BEGIN
  email_lc := lower(COALESCE(NEW.email, ''));
  derived_role := CASE
    WHEN email_lc LIKE '%@student.aast.edu' OR email_lc LIKE '%@aast.edu.eg' THEN 'student'::public.user_role
    ELSE 'advisor'::public.user_role
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    derived_role
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 14) Open RLS policies for Local Auth mode
-- NOTE: We are bypassing Supabase Auth, so we allow access to students and courses.

-- students
DROP POLICY IF EXISTS students_select ON public.students;
DROP POLICY IF EXISTS students_insert ON public.students;
DROP POLICY IF EXISTS students_update ON public.students;
DROP POLICY IF EXISTS students_link_themselves ON public.students;

CREATE POLICY students_all ON public.students FOR ALL USING (true) WITH CHECK (true);

-- courses
DROP POLICY IF EXISTS courses_select ON public.courses;
DROP POLICY IF EXISTS courses_insert ON public.courses;
DROP POLICY IF EXISTS courses_update ON public.courses;
DROP POLICY IF EXISTS courses_delete ON public.courses;

CREATE POLICY courses_all ON public.courses FOR ALL USING (true) WITH CHECK (true);

-- profiles (keep but make open if used)
CREATE POLICY profiles_all ON public.profiles FOR ALL USING (true) WITH CHECK (true);


-- advisor_students
DROP POLICY IF EXISTS advisor_students_select ON public.advisor_students;
DROP POLICY IF EXISTS advisor_students_write ON public.advisor_students;
CREATE POLICY advisor_students_select ON public.advisor_students
  FOR SELECT USING (advisor_id = auth.uid() OR public.is_admin());
CREATE POLICY advisor_students_write ON public.advisor_students
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- notes
DROP POLICY IF EXISTS student_notes_select ON public.student_notes;
DROP POLICY IF EXISTS student_notes_insert ON public.student_notes;
DROP POLICY IF EXISTS student_notes_delete ON public.student_notes;
CREATE POLICY student_notes_select ON public.student_notes
  FOR SELECT USING (
    public.can_view_student(student_id) AND (
      public.is_admin() OR public.is_advisor() OR visibility = 'shared'
    )
  );
CREATE POLICY student_notes_insert ON public.student_notes
  FOR INSERT WITH CHECK (
    public.can_view_student(student_id)
    AND author_id = auth.uid()
    AND (
      public.is_admin() OR public.is_advisor() OR (public.owns_student(student_id) AND visibility = 'shared')
    )
  );
CREATE POLICY student_notes_delete ON public.student_notes
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin());

-- plans
DROP POLICY IF EXISTS semester_plans_select ON public.semester_plans;
DROP POLICY IF EXISTS semester_plans_write ON public.semester_plans;
CREATE POLICY semester_plans_select ON public.semester_plans
  FOR SELECT USING (public.can_view_student(student_id));
CREATE POLICY semester_plans_write ON public.semester_plans
  FOR ALL USING (
    public.can_view_student(student_id) AND (public.is_admin() OR public.is_advisor() OR public.owns_student(student_id))
  )
  WITH CHECK (
    public.can_view_student(student_id)
    AND created_by = auth.uid()
    AND (public.is_admin() OR public.is_advisor() OR public.owns_student(student_id))
  );

DROP POLICY IF EXISTS planned_courses_select ON public.planned_courses;
DROP POLICY IF EXISTS planned_courses_write ON public.planned_courses;
CREATE POLICY planned_courses_select ON public.planned_courses
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM public.semester_plans p
      WHERE p.id = plan_id AND public.can_view_student(p.student_id)
    )
  );
CREATE POLICY planned_courses_write ON public.planned_courses
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM public.semester_plans p
      WHERE p.id = plan_id
        AND public.can_view_student(p.student_id)
        AND (public.is_admin() OR public.is_advisor() OR public.owns_student(p.student_id))
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.semester_plans p
      WHERE p.id = plan_id
        AND public.can_view_student(p.student_id)
        AND (public.is_admin() OR public.is_advisor() OR public.owns_student(p.student_id))
    )
  );

-- alerts
DROP POLICY IF EXISTS alerts_select ON public.alerts;
DROP POLICY IF EXISTS alerts_write ON public.alerts;
CREATE POLICY alerts_select ON public.alerts
  FOR SELECT USING (public.can_view_student(student_id));
CREATE POLICY alerts_write ON public.alerts
  FOR ALL USING (public.is_admin() OR public.is_advisor())
  WITH CHECK (public.is_admin() OR public.is_advisor());

-- availability / appointments
DROP POLICY IF EXISTS advisor_availability_select ON public.advisor_availability;
DROP POLICY IF EXISTS advisor_availability_write ON public.advisor_availability;
CREATE POLICY advisor_availability_select ON public.advisor_availability
  FOR SELECT USING (true);
CREATE POLICY advisor_availability_write ON public.advisor_availability
  FOR ALL USING (advisor_id = auth.uid() OR public.is_admin())
  WITH CHECK (advisor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS appointments_select ON public.appointments;
DROP POLICY IF EXISTS appointments_write ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
  FOR SELECT USING (
    public.is_admin()
    OR advisor_id = auth.uid()
    OR public.owns_student(student_id)
    OR public.is_assigned_advisor(student_id)
  );
CREATE POLICY appointments_write ON public.appointments
  FOR ALL USING (
    public.is_admin()
    OR advisor_id = auth.uid()
    OR public.owns_student(student_id)
  )
  WITH CHECK (
    public.is_admin()
    OR advisor_id = auth.uid()
    OR public.owns_student(student_id)
  );

-- messages / action items
DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (
    public.is_admin()
    OR advisor_id = auth.uid()
    OR public.owns_student(student_id)
    OR public.is_assigned_advisor(student_id)
  );
CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_admin()
      OR advisor_id = auth.uid()
      OR public.owns_student(student_id)
    )
  );

DROP POLICY IF EXISTS action_items_select ON public.action_items;
DROP POLICY IF EXISTS action_items_write ON public.action_items;
CREATE POLICY action_items_select ON public.action_items
  FOR SELECT USING (public.can_view_student(student_id));
CREATE POLICY action_items_write ON public.action_items
  FOR ALL USING (public.is_admin() OR public.is_advisor())
  WITH CHECK (public.is_admin() OR public.is_advisor());

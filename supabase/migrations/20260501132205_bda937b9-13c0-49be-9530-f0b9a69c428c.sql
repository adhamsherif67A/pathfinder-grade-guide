
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  enrollment_year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_reg ON public.students(registration_number);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  letter_grade text NOT NULL,
  credit_hours numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_student ON public.courses(student_id);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Auth is registration-number based (no Supabase Auth). Allow public access.
CREATE POLICY "students_select_all" ON public.students FOR SELECT USING (true);
CREATE POLICY "students_insert_all" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "students_update_all" ON public.students FOR UPDATE USING (true);

CREATE POLICY "courses_select_all" ON public.courses FOR SELECT USING (true);
CREATE POLICY "courses_insert_all" ON public.courses FOR INSERT WITH CHECK (true);
CREATE POLICY "courses_update_all" ON public.courses FOR UPDATE USING (true);
CREATE POLICY "courses_delete_all" ON public.courses FOR DELETE USING (true);

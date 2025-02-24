-- Drop existing triggers first
DROP TRIGGER IF EXISTS refresh_scheduling_stats_users ON public.users;
DROP TRIGGER IF EXISTS refresh_scheduling_stats_schedules ON public.schedules;
DROP TRIGGER IF EXISTS refresh_scheduling_stats_absences ON public.absences;
DROP FUNCTION IF EXISTS public.refresh_scheduling_stats() CASCADE;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP MATERIALIZED VIEW IF EXISTS scheduling_stats_view CASCADE;

-- Create shifts table with optimized structure
CREATE TABLE public.shifts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_shift_name UNIQUE (name)
);

-- Create schedules table with optimized structure and indexes
CREATE TABLE public.schedules (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    working_shift INTEGER REFERENCES public.shifts(id),
    off_days TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_schedule UNIQUE (user_id)
);

-- Create absences table with optimized structure and indexes
CREATE TABLE public.absences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized indexes
CREATE INDEX idx_schedules_user_working_shift ON public.schedules(user_id, working_shift);
CREATE INDEX idx_absences_user_date ON public.absences(user_id, date);
CREATE INDEX idx_absences_date ON public.absences(date);

-- Create materialized view for fast statistics
CREATE MATERIALIZED VIEW public.scheduling_stats_view AS
WITH user_counts AS (
    SELECT COUNT(*) as total_employees
    FROM public.users
    WHERE role = 'user'
),
shift_counts AS (
    SELECT COUNT(*) as active_shifts
    FROM public.schedules
    WHERE working_shift IS NOT NULL
),
absence_counts AS (
    SELECT COUNT(*) as today_absences
    FROM public.absences
    WHERE date = CURRENT_DATE
)
SELECT 
    user_counts.total_employees,
    shift_counts.active_shifts,
    absence_counts.today_absences
FROM 
    user_counts, 
    shift_counts, 
    absence_counts;

-- Create unique index on materialized view for fast refresh
CREATE UNIQUE INDEX idx_scheduling_stats_view ON public.scheduling_stats_view (total_employees, active_shifts, today_absences);

-- Create function to refresh materialized view concurrently
CREATE OR REPLACE FUNCTION public.refresh_scheduling_stats()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.scheduling_stats_view;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh the materialized view
CREATE TRIGGER refresh_scheduling_stats_users
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.refresh_scheduling_stats();

CREATE TRIGGER refresh_scheduling_stats_schedules
    AFTER INSERT OR UPDATE OR DELETE ON public.schedules
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.refresh_scheduling_stats();

CREATE TRIGGER refresh_scheduling_stats_absences
    AFTER INSERT OR UPDATE OR DELETE ON public.absences
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.refresh_scheduling_stats();

-- Insert default shifts
INSERT INTO public.shifts (name, start_time, end_time)
VALUES 
    ('Morning Shift', '08:00', '16:00'),
    ('Evening Shift', '16:00', '00:00'),
    ('Night Shift', '00:00', '08:00')
ON CONFLICT (name) DO NOTHING;

-- Create initial schedules for existing users
INSERT INTO public.schedules (user_id, working_shift, off_days)
SELECT 
    id as user_id,
    1 as working_shift,
    ARRAY['saturday', 'sunday'] as off_days
FROM public.users
WHERE role = 'user'
ON CONFLICT (user_id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.schedules;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.absences;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.shifts;
    DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.schedules;
    DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.absences;
END $$;

CREATE POLICY "Enable read access for authenticated users" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON public.absences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON public.shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable write access for authenticated users" ON public.schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable write access for authenticated users" ON public.absences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.schedules TO authenticated;
GRANT ALL ON public.absences TO authenticated;
GRANT ALL ON public.shifts TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create functions for optimized data access
CREATE OR REPLACE FUNCTION get_scheduling_overview(start_date DATE, end_date DATE)
RETURNS TABLE (
    stats json,
    employees json,
    absences json
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT row_to_json(v.*) as stats
        FROM public.scheduling_stats_view v
    ),
    employees AS (
        SELECT json_agg(e.*) as employees
        FROM (
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                s.working_shift,
                s.off_days
            FROM public.users u
            LEFT JOIN public.schedules s ON s.user_id = u.id
            WHERE u.role = 'user'
            ORDER BY u.first_name
        ) e
    ),
    absences AS (
        SELECT json_agg(a.*) as absences
        FROM (
            SELECT 
                a.*,
                json_build_object(
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email
                ) as user
            FROM public.absences a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.date BETWEEN start_date AND end_date
            ORDER BY a.date
        ) a
    )
    SELECT 
        stats.stats,
        employees.employees,
        absences.absences
    FROM stats, employees, absences;
END;
$$;
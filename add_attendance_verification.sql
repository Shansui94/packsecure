-- 增加考勤审核打钩相关字段
ALTER TABLE public.operator_attendance ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.operator_attendance ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE public.operator_attendance ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.operator_attendance ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 增加查询性能索引
CREATE INDEX IF NOT EXISTS idx_operator_attendance_date_verified 
ON public.operator_attendance (date, is_verified);

CREATE INDEX IF NOT EXISTS idx_operator_attendance_operator_date 
ON public.operator_attendance (operator_id, date);

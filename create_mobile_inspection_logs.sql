-- create_mobile_inspection_logs.sql
-- 支持多螺杆 (螺杆 A, 螺杆 B, 螺杆 C) 独立配料与巡检

CREATE TABLE IF NOT EXISTS mobile_inspection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_type TEXT CHECK (log_type IN ('material', 'machine_adjustment', 'temperature')) NOT NULL,
  
  -- 螺杆与机台信息 (支持双螺杆/三螺杆 A/B/C)
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  machine_name TEXT,
  screw_id TEXT CHECK (screw_id IN ('Screw_A', 'Screw_B', 'Screw_C')) DEFAULT 'Screw_A',
  screw_name TEXT DEFAULT '螺杆 A',

  -- 1. 原材料相关
  material_id UUID REFERENCES items(id) ON DELETE SET NULL,
  material_name TEXT,
  previous_quantity NUMERIC,
  new_quantity NUMERIC,
  change_amount NUMERIC,
  reaction_tag TEXT CHECK (reaction_tag IN ('normal', 'moist', 'clumped', 'color_dev', 'impurities')),
  reaction_notes TEXT,

  -- 2. 机器调整位置相关
  adjustment_position TEXT,
  adjustment_notes TEXT,

  -- 3. 机器温度相关
  temp_zone_1 NUMERIC,
  temp_zone_2 NUMERIC,
  temp_zone_3 NUMERIC,
  temp_die_head NUMERIC,
  temp_status TEXT CHECK (temp_status IN ('normal', 'overheat', 'too_low')),

  -- 照片与操作员信息 (必须附带照片)
  photo_url TEXT NOT NULL,
  operator_id UUID,
  operator_name TEXT NOT NULL DEFAULT 'Anonymous',
  operator_role TEXT DEFAULT 'Operator',
  factory_id UUID REFERENCES factories(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 索引配置
CREATE INDEX IF NOT EXISTS idx_mobile_insp_type ON mobile_inspection_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_mobile_insp_created ON mobile_inspection_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_insp_screw ON mobile_inspection_logs(screw_id);

-- ========================================================
-- Smart Waste Management - Supabase Database Setup
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- ========================================================

-- ลบตารางเก่าก่อน (ถ้ามี)
DROP TABLE IF EXISTS sensor_history CASCADE;
DROP TABLE IF EXISTS "SensorHistory" CASCADE;
DROP TABLE IF EXISTS bins CASCADE;
DROP TABLE IF EXISTS "Bin" CASCADE;

-- ตาราง bins (ถังขยะ)
CREATE TABLE bins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  address       TEXT NOT NULL,
  district      TEXT,
  sub_district  TEXT,
  province      TEXT,
  municipality  TEXT,
  latitude      FLOAT NOT NULL,
  longitude     FLOAT NOT NULL,
  capacity      FLOAT NOT NULL DEFAULT 100,
  max_distance  FLOAT NOT NULL DEFAULT 100,

  -- Sensor data
  waste_level   FLOAT NOT NULL DEFAULT 0,
  light_level   FLOAT NOT NULL DEFAULT 0,
  light_status  BOOLEAN NOT NULL DEFAULT false,
  temperature   FLOAT,
  humidity      FLOAT,

  -- Status
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_update   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ตาราง sensor_history (ประวัติข้อมูล sensor)
CREATE TABLE sensor_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id       UUID NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  waste_level  FLOAT NOT NULL,
  light_level  FLOAT NOT NULL,
  light_status BOOLEAN NOT NULL,
  temperature  FLOAT,
  humidity     FLOAT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index สำหรับ query เร็วขึ้น
CREATE INDEX idx_bins_client_id ON bins(client_id);
CREATE INDEX idx_bins_is_active ON bins(is_active);
CREATE INDEX idx_sensor_history_bin_id ON sensor_history(bin_id);
CREATE INDEX idx_sensor_history_recorded_at ON sensor_history(recorded_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bins_updated_at
  BEFORE UPDATE ON bins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_history ENABLE ROW LEVEL SECURITY;

-- Policy: อนุญาตให้ anon key อ่าน/เขียนได้ (สำหรับ IoT + frontend)
CREATE POLICY "Allow all access to bins" ON bins
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to sensor_history" ON sensor_history
  FOR ALL USING (true) WITH CHECK (true);

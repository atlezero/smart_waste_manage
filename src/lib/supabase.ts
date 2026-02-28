import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client สำหรับฝั่ง client (browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client สำหรับฝั่ง server (API routes) - ใช้ anon key เหมือนกันในกรณีนี้
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

// Types สำหรับ database
export interface BinRow {
    id: string;
    api_key: string;
    name: string;
    address: string;
    district: string | null;
    sub_district: string | null;
    province: string | null;
    municipality: string | null;
    latitude: number;
    longitude: number;
    capacity: number;
    max_distance: number;
    waste_level: number;
    light_level: number;
    light_status: boolean;
    auto_light: boolean;
    auto_status: boolean;
    temperature: number | null;
    humidity: number | null;
    is_active: boolean;
    last_update: string;
    created_at: string;
    updated_at: string;
    created_by?: string;
    created_by_role?: string;
}

export interface SensorHistoryRow {
    id: string;
    bin_id: string;
    waste_level: number;
    light_level: number;
    light_status: boolean;
    temperature: number | null;
    humidity: number | null;
    recorded_at: string;
}

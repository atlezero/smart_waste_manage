import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// GET - ดึงข้อมูลถังขยะทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    let query = supabaseServer
      .from('bins')
      .select(`
        *,
        sensor_history (
          id,
          bin_id,
          waste_level,
          light_level,
          light_status,
          temperature,
          humidity,
          recorded_at
        )
      `)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    const { data: bins, error } = await query;

    if (error) throw error;

    let result = bins ?? [];

    // เรียง sensor_history ล่าสุดก่อน (เอาแค่ 1 รายการ)
    result = result.map(bin => ({
      ...bin,
      sensor_history: bin.sensor_history
        ?.sort((a: { recorded_at: string }, b: { recorded_at: string }) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        )
        .slice(0, 1) ?? [],
    }));

    // กรองตามการค้นหา
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(bin =>
        bin.client_id?.toLowerCase().includes(searchLower) ||
        bin.name?.toLowerCase().includes(searchLower) ||
        bin.address?.toLowerCase().includes(searchLower) ||
        bin.district?.toLowerCase().includes(searchLower) ||
        bin.sub_district?.toLowerCase().includes(searchLower) ||
        bin.province?.toLowerCase().includes(searchLower) ||
        bin.municipality?.toLowerCase().includes(searchLower)
      );
    }

    // กรองตามสถานะ
    if (status) {
      result = result.filter(bin => {
        const level = bin.waste_level;
        switch (status) {
          case 'low': return level < 50;
          case 'medium': return level >= 50 && level < 80;
          case 'high': return level >= 80;
          default: return true;
        }
      });
    }

    // แปลง snake_case → camelCase เพื่อให้ตรงกับ frontend
    const mapped = result.map(mapBinToCamel);

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Error fetching bins:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bins' },
      { status: 500 }
    );
  }
}

// POST - เพิ่มถังขยะใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      name,
      address,
      district,
      subDistrict,
      province,
      municipality,
      latitude,
      longitude,
      capacity,
      maxDistance,
    } = body;

    // ตรวจสอบว่า clientId ซ้ำหรือไม่
    const { data: existing } = await supabaseServer
      .from('bins')
      .select('id')
      .eq('client_id', clientId)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Client ID already exists' },
        { status: 400 }
      );
    }

    const { data: bin, error } = await supabaseServer
      .from('bins')
      .insert({
        client_id: clientId,
        name,
        address,
        district: district || null,
        sub_district: subDistrict || null,
        province: province || null,
        municipality: municipality || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        capacity: capacity ? parseFloat(capacity) : 100,
        max_distance: maxDistance ? parseFloat(maxDistance) : 100,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: mapBinToCamel(bin) });
  } catch (error) {
    console.error('Error creating bin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create bin' },
      { status: 500 }
    );
  }
}

// Helper: แปลง snake_case → camelCase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBinToCamel(bin: any) {
  return {
    id: bin.id,
    clientId: bin.client_id,
    name: bin.name,
    address: bin.address,
    district: bin.district,
    subDistrict: bin.sub_district,
    province: bin.province,
    municipality: bin.municipality,
    latitude: bin.latitude,
    longitude: bin.longitude,
    capacity: bin.capacity,
    maxDistance: bin.max_distance,
    wasteLevel: bin.waste_level,
    lightLevel: bin.light_level,
    lightStatus: bin.light_status,
    temperature: bin.temperature,
    humidity: bin.humidity,
    isActive: bin.is_active,
    lastUpdate: bin.last_update,
    createdAt: bin.created_at,
    updatedAt: bin.updated_at,
    sensorHistory: bin.sensor_history?.map(mapHistoryToCamel) ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHistoryToCamel(h: any) {
  return {
    id: h.id,
    binId: h.bin_id,
    wasteLevel: h.waste_level,
    lightLevel: h.light_level,
    lightStatus: h.light_status,
    temperature: h.temperature,
    humidity: h.humidity,
    recordedAt: h.recorded_at,
  };
}

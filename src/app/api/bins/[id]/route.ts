import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// GET - ดึงข้อมูลถังขยะตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: bin, error } = await supabaseServer
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
      .eq('id', id)
      .order('recorded_at', { ascending: false, referencedTable: 'sensor_history' })
      .limit(24, { referencedTable: 'sensor_history' })
      .single();

    if (error || !bin) {
      return NextResponse.json(
        { success: false, error: 'Bin not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: mapBinToCamel(bin) });
  } catch (error) {
    console.error('Error fetching bin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bin' },
      { status: 500 }
    );
  }
}

// PUT - อัพเดทข้อมูลถังขยะ
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // แปลง camelCase → snake_case
    const updateData: Record<string, unknown> = {};
    if (body.clientId !== undefined) updateData.client_id = body.clientId;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.district !== undefined) updateData.district = body.district;
    if (body.subDistrict !== undefined) updateData.sub_district = body.subDistrict;
    if (body.province !== undefined) updateData.province = body.province;
    if (body.municipality !== undefined) updateData.municipality = body.municipality;
    if (body.latitude !== undefined) updateData.latitude = parseFloat(body.latitude);
    if (body.longitude !== undefined) updateData.longitude = parseFloat(body.longitude);
    if (body.capacity !== undefined) updateData.capacity = parseFloat(body.capacity);
    if (body.maxDistance !== undefined) updateData.max_distance = parseFloat(body.maxDistance);
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    const { data: bin, error } = await supabaseServer
      .from('bins')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: mapBinToCamel(bin) });
  } catch (error) {
    console.error('Error updating bin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bin' },
      { status: 500 }
    );
  }
}

// DELETE - ลบถังขยะ
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseServer
      .from('bins')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bin' },
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

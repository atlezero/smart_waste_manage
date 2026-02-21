import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// คำนวณระดับขยะจากระยะทาง
function calculateWasteLevel(distanceCm: number, maxDistance: number): number {
  if (distanceCm >= maxDistance) return 0;
  if (distanceCm <= 0) return 100;
  const level = ((maxDistance - distanceCm) / maxDistance) * 100;
  return Math.max(0, Math.min(100, parseFloat(level.toFixed(1))));
}

// POST - รับข้อมูลจาก sensor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      wasteLevel,
      lightLevel,
      lightStatus,
      distanceCm,
      temperature,
      humidity,
    } = body;

    console.log('📊 Sensor data received:', { clientId, distanceCm, lightLevel, lightStatus });

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // หาถังขยะจาก clientId
    const { data: bin } = await supabaseServer
      .from('bins')
      .select('*')
      .eq('client_id', clientId)
      .single();

    // คำนวณระดับขยะจากระยะทาง (ถ้ามี)
    let calculatedWasteLevel = wasteLevel;
    if (typeof distanceCm === 'number' && bin) {
      calculatedWasteLevel = calculateWasteLevel(distanceCm, bin.max_distance);
      console.log(`📏 Calculated waste level: ${calculatedWasteLevel}% (distance: ${distanceCm}cm, bin height: ${bin.max_distance}cm)`);
    }

    if (!bin) {
      console.log(`⚠️ Bin with clientId "${clientId}" not found, creating placeholder...`);

      const defaultMaxDistance = 100;
      const newBinWasteLevel = typeof distanceCm === 'number'
        ? calculateWasteLevel(distanceCm, defaultMaxDistance)
        : (wasteLevel ?? 0);

      const { data: newBin, error } = await supabaseServer
        .from('bins')
        .insert({
          client_id: clientId,
          name: `ถังขยะ ${clientId}`,
          address: 'รออัพเดตที่อยู่',
          latitude: 13.7563,
          longitude: 100.5018,
          capacity: 100,
          max_distance: defaultMaxDistance,
          waste_level: newBinWasteLevel,
          light_level: lightLevel ?? 0,
          light_status: lightStatus ?? false,
          temperature: temperature ?? null,
          humidity: humidity ?? null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Created new bin: ${newBin.id}`);
      return NextResponse.json({
        success: true,
        message: 'Created new bin',
        data: { bin: mapBinToCamel(newBin) },
      });
    }

    // บันทึกประวัติ sensor
    const { error: historyError } = await supabaseServer
      .from('sensor_history')
      .insert({
        bin_id: bin.id,
        waste_level: calculatedWasteLevel ?? bin.waste_level,
        light_level: lightLevel ?? bin.light_level,
        light_status: lightStatus ?? bin.light_status,
        temperature: temperature ?? bin.temperature,
        humidity: humidity ?? bin.humidity,
      });

    if (historyError) throw historyError;

    // อัพเดตข้อมูลล่าสุดใน bin
    const { data: updatedBin, error: updateError } = await supabaseServer
      .from('bins')
      .update({
        waste_level: calculatedWasteLevel ?? bin.waste_level,
        light_level: lightLevel ?? bin.light_level,
        light_status: lightStatus ?? bin.light_status,
        temperature: temperature ?? bin.temperature,
        humidity: humidity ?? bin.humidity,
        last_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bin.id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`✅ Updated bin ${clientId}: wasteLevel=${calculatedWasteLevel}%, light=${lightLevel}lux, status=${lightStatus ? 'ON' : 'OFF'}`);

    return NextResponse.json({
      success: true,
      message: 'Sensor data updated',
      data: { bin: mapBinToCamel(updatedBin) },
    });
  } catch (error) {
    console.error('❌ Error updating sensor data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update sensor data' },
      { status: 500 }
    );
  }
}

// GET - ดึงข้อมูล sensor history
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const binId = searchParams.get('binId');
    const clientId = searchParams.get('clientId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let bin;

    if (binId) {
      const { data } = await supabaseServer
        .from('bins')
        .select('id')
        .eq('id', binId)
        .single();
      bin = data;
    } else if (clientId) {
      const { data } = await supabaseServer
        .from('bins')
        .select('id')
        .eq('client_id', clientId)
        .single();
      bin = data;
    }

    if (!bin) {
      return NextResponse.json(
        { success: false, error: 'Bin not found' },
        { status: 404 }
      );
    }

    const { data: history, error } = await supabaseServer
      .from('sensor_history')
      .select('*')
      .eq('bin_id', bin.id)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const mapped = (history ?? []).map(mapHistoryToCamel);

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sensor history' },
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

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// คำนวณระดับขยะจากระยะทาง โดยมีระยะวิกฤติ (ขยะเต็ม) คือ 2 ซม.
function calculateWasteLevel(distanceCm: number, maxDistance: number): number {
  const MIN_DISTANCE = 2; // ระยะเซนเซอร์กับขยะเมื่อเต็ม (ตายตัว)

  if (distanceCm >= maxDistance) return 0;
  if (distanceCm <= MIN_DISTANCE) return 100;

  // ระยะใช้งานจริงที่เซนเซอร์วัดได้ = maxDistance - MIN_DISTANCE
  const usableHeight = maxDistance - MIN_DISTANCE;

  // ระยะจากขยะถึงปากถัง = distanceCm - MIN_DISTANCE
  const emptySpace = distanceCm - MIN_DISTANCE;

  // เปอร์เซ็นต์ขยะ = (usableHeight - emptySpace) / usableHeight * 100
  const level = ((usableHeight - emptySpace) / usableHeight) * 100;

  return Math.max(0, Math.min(100, parseFloat(level.toFixed(1))));
}

// POST - รับข้อมูลจาก sensor (ใช้ API Key ในการระบุถังขยะ)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      apiKey,
      // รองรับ field เดิมด้วย ในช่วง transition
      clientId,
      wasteLevel,
      lightLevel,
      lightStatus,
      autoLight,
      autoStatus,
      ledGreen,
      ledRed,
      distanceCm,
      temperature,
      humidity,
    } = body;

    // ใช้ apiKey เป็นหลัก, fallback ไป clientId (backward compatibility)
    const key = apiKey || clientId;

    console.log('📊 Sensor data received:', { apiKey: key, distanceCm, lightLevel, lightStatus, autoLight, autoStatus });

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'API Key is required' },
        { status: 400 }
      );
    }

    // หาถังขยะจาก api_key
    const { data: bin } = await supabaseServer
      .from('bins')
      .select('*')
      .eq('api_key', key)
      .single();

    // คำนวณระดับขยะจากระยะทาง (ถ้ามี)
    let calculatedWasteLevel = wasteLevel;
    if (typeof distanceCm === 'number' && bin) {
      calculatedWasteLevel = calculateWasteLevel(distanceCm, bin.max_distance);
      console.log(`📏 Calculated waste level: ${calculatedWasteLevel}% (distance: ${distanceCm}cm, bin height: ${bin.max_distance}cm)`);
    }

    if (!bin) {
      return NextResponse.json(
        { success: false, error: 'Invalid API Key - bin not found' },
        { status: 401 }
      );
    }

    // บันทึกประวัติ sensor
    const { error: historyError } = await supabaseServer
      .from('sensor_history')
      .insert({
        bin_id: bin.id,
        waste_level: calculatedWasteLevel ?? bin.waste_level,
        light_level: lightLevel ?? bin.light_level,
        light_status: lightStatus ?? bin.light_status,
        led_green: ledGreen ?? bin.led_green,
        led_red: ledRed ?? bin.led_red,
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
        auto_light: autoLight ?? bin.auto_light,
        auto_status: autoStatus ?? bin.auto_status,
        led_green: ledGreen ?? bin.led_green,
        led_red: ledRed ?? bin.led_red,
        temperature: temperature ?? bin.temperature,
        humidity: humidity ?? bin.humidity,
        last_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bin.id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`✅ Updated bin [${key.substring(0, 12)}...]: wasteLevel=${calculatedWasteLevel}%, light=${lightLevel}lux, status=${lightStatus ? 'ON' : 'OFF'}`);

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
    const apiKey = searchParams.get('apiKey');
    const limit = parseInt(searchParams.get('limit') || '50');

    let bin;

    if (binId) {
      const { data } = await supabaseServer
        .from('bins')
        .select('id')
        .eq('id', binId)
        .single();
      bin = data;
    } else if (apiKey) {
      const { data } = await supabaseServer
        .from('bins')
        .select('id')
        .eq('api_key', apiKey)
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
    apiKey: bin.api_key,
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
    autoLight: bin.auto_light !== undefined ? bin.auto_light : true,
    autoStatus: bin.auto_status !== undefined ? bin.auto_status : true,
    ledGreen: bin.led_green,
    ledRed: bin.led_red,
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
    ledGreen: h.led_green,
    ledRed: h.led_red,
    temperature: h.temperature,
    humidity: h.humidity,
    recordedAt: h.recorded_at,
  };
}

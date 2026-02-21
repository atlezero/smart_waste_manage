import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// GET - ดึงข้อมูลสถิติสำหรับ Dashboard
export async function GET() {
  try {
    const { data: bins, error } = await supabaseServer
      .from('bins')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const result = bins ?? [];
    const totalBins = result.length;

    // นับตามระดับขยะ
    const lowBins = result.filter(b => b.waste_level < 50).length;
    const mediumBins = result.filter(b => b.waste_level >= 50 && b.waste_level < 80).length;
    const highBins = result.filter(b => b.waste_level >= 80).length;

    // เฉลี่ยระดับขยะ
    const avgWasteLevel = totalBins > 0
      ? result.reduce((sum, b) => sum + b.waste_level, 0) / totalBins
      : 0;

    // จำนวนไฟที่เปิดอยู่
    const activeLights = result.filter(b => b.light_status).length;

    // ข้อมูลล่าสุด
    const lastUpdate = result.length > 0
      ? result.reduce((latest, b) =>
        b.last_update > latest ? b.last_update : latest,
        result[0].last_update
      )
      : null;

    // ดึงข้อมูลประวัติล่าสุด 100 รายการ
    const { data: recentHistory, error: histError } = await supabaseServer
      .from('sensor_history')
      .select('*, bins(name, client_id)')
      .order('recorded_at', { ascending: false })
      .limit(100);

    if (histError) throw histError;

    // ข้อมูลสำหรับกราฟ (จัดกลุ่มตามชั่วโมง)
    const hourlyData: Record<string, { count: number; totalLevel: number }> = {};

    (recentHistory ?? []).forEach(record => {
      const hour = new Date(record.recorded_at).getHours();
      const key = `${hour}:00`;
      if (!hourlyData[key]) {
        hourlyData[key] = { count: 0, totalLevel: 0 };
      }
      hourlyData[key].count++;
      hourlyData[key].totalLevel += record.waste_level;
    });

    const chartData = Object.entries(hourlyData)
      .map(([time, data]) => ({
        time,
        avgLevel: data.count > 0 ? data.totalLevel / data.count : 0,
      }))
      .sort((a, b) => parseInt(a.time) - parseInt(b.time));

    return NextResponse.json({
      success: true,
      data: {
        totalBins,
        lowBins,
        mediumBins,
        highBins,
        avgWasteLevel,
        activeLights,
        lastUpdate,
        chartData,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

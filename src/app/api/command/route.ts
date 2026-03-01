import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// POST - ส่งคำสั่งไปยัง ESP32 ผ่าน MQTT
// ESP32 subscribe อยู่ที่ topic: waste_truck/<api_key>/cmd
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { binId, command } = body;
        // command = { light?: bool, red?: bool, green?: bool, auto_light?: bool, full_distance?: number, reset_wifi?: bool }

        if (!binId || !command) {
            return NextResponse.json(
                { success: false, error: 'binId and command are required' },
                { status: 400 }
            );
        }

        // ดึง api_key ของถังขยะนี้
        const { data: bin, error } = await supabaseServer
            .from('bins')
            .select('id, api_key, name')
            .eq('id', binId)
            .single();

        if (error || !bin) {
            return NextResponse.json(
                { success: false, error: 'Bin not found' },
                { status: 404 }
            );
        }

        // Publish คำสั่งผ่าน MQTT โดยส่งไปที่ mqtt-service
        // topic: waste_truck/<api_key>/cmd
        const mqttTopic = `waste_truck/${bin.api_key}/cmd`;
        const payload = JSON.stringify(command);

        // ส่งคำสั่งผ่าน MQTT service HTTP endpoint (port 3001)
        // ถ้า mqtt-service รองรับ HTTP สำหรับ publish
        // แต่ถ้าไม่มี ให้ใช้ mqtt library ตรงๆ
        try {
            const mqttServiceUrl = process.env.MQTT_SERVICE_URL || 'http://localhost:3001';
            const mqttRes = await fetch(`${mqttServiceUrl}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: mqttTopic, payload }),
                signal: AbortSignal.timeout(3000),
            });

            if (!mqttRes.ok) {
                throw new Error('MQTT service returned error');
            }

            console.log(`📡 Command sent to ${bin.name} [${mqttTopic}]:`, payload);

            // อัพเดต DB ด้วย เพื่อให้ค่าควบคุมถูกบันทึก
            const updateData: Record<string, unknown> = {};
            if (command.light !== undefined) updateData.light_status = command.light;
            if (command.red !== undefined) updateData.led_red = command.red;
            if (command.green !== undefined) updateData.led_green = command.green;
            if (command.auto_light !== undefined) updateData.auto_light = command.auto_light;
            if (command.auto_status !== undefined) updateData.auto_status = command.auto_status;
            if (command.full_distance !== undefined) updateData.max_distance = command.full_distance;

            if (Object.keys(updateData).length > 0) {
                await supabaseServer.from('bins').update(updateData).eq('id', binId);
            }

            return NextResponse.json({
                success: true,
                message: `ส่งคำสั่งไปยัง ${bin.name} สำเร็จ`,
                topic: mqttTopic,
                payload: command,
            });

        } catch {
            // Fallback: ถ้า mqtt-service ไม่มี HTTP endpoint
            // ให้ update DB เฉยๆ แล้วรอ ESP32 sync ครั้งถัดไป
            console.warn('⚠️ MQTT service HTTP endpoint unavailable, updating DB only');

            const updateData: Record<string, unknown> = {};
            if (command.light !== undefined) updateData.light_status = command.light;
            if (command.red !== undefined) updateData.led_red = command.red;
            if (command.green !== undefined) updateData.led_green = command.green;
            if (command.auto_light !== undefined) updateData.auto_light = command.auto_light;
            if (command.auto_status !== undefined) updateData.auto_status = command.auto_status;
            if (command.full_distance !== undefined) updateData.max_distance = command.full_distance;

            if (Object.keys(updateData).length > 0) {
                await supabaseServer.from('bins').update(updateData).eq('id', binId);
            }

            return NextResponse.json({
                success: true,
                message: 'อัปเดต DB สำเร็จ (MQTT offline)',
                mqttStatus: 'offline',
            });
        }

    } catch (error) {
        console.error('Command API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to send command' },
            { status: 500 }
        );
    }
}

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mqtt = require('mqtt');
const { WebSocketServer } = require('ws');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
//  CONFIG (ทั้งหมดอ่านจาก .env)
// ============================================================
const MQTT_BROKER   = process.env.MQTT_BROKER;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC    = process.env.MQTT_TOPIC || 'waste_truck/+/data';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';

const HTTP_PORT = process.env.WS_PORT || 3001;
const WASTE_ALERT_THRESHOLD = parseInt(process.env.WASTE_ALERT_THRESHOLD || '80');

// ============================================================
//  SUPABASE CLIENT
// ============================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
//  WEBSOCKET SERVER
// ============================================================
const httpServer = http.createServer(handleHttpRequest);
const wss = new WebSocketServer({ server: httpServer });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`🌐 WS client connected (total: ${wsClients.size})`);
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`🌐 WS client disconnected (total: ${wsClients.size})`);
  });
  ws.on('error', (err) => {
    console.error('WS error:', err.message);
    wsClients.delete(ws);
  });
});

function broadcastToClients(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const c of wsClients) {
    if (c.readyState === 1) c.send(msg);
  }
}

// ============================================================
//  TELEGRAM BOT
// ============================================================
const alertCooldown = new Map();

function shouldAlert(binId) {
  const now = Date.now();
  const last = alertCooldown.get(binId) || 0;
  if (now - last < 5 * 60 * 1000) return false;
  alertCooldown.set(binId, now);
  return true;
}

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
    if (res.ok) console.log('📨 Telegram alert sent');
    else console.error('❌ Telegram error:', await res.text());
  } catch (err) {
    console.error('❌ Telegram failed:', err.message);
  }
}

// ============================================================
//  HELPERS
// ============================================================
function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toUpperCase() === 'ON' || value === '1' || value.toLowerCase() === 'true';
  if (typeof value === 'number') return value === 1;
  return null;
}

function calculateWasteLevel(distanceCm, maxDistance) {
  const MIN_DISTANCE = 2;
  if (distanceCm >= maxDistance) return 0;
  if (distanceCm <= MIN_DISTANCE) return 100;
  const usableHeight = maxDistance - MIN_DISTANCE;
  const emptySpace = distanceCm - MIN_DISTANCE;
  const level = ((usableHeight - emptySpace) / usableHeight) * 100;
  return Math.max(0, Math.min(100, parseFloat(level.toFixed(1))));
}

// ============================================================
//  MQTT CLIENT
// ============================================================
let mqttClient = null;

function connectMQTT() {
  console.log('🚀 Starting WebSocket Server + MQTT Service...');
  console.log(`📡 Connecting to MQTT: ${MQTT_BROKER}`);

  mqttClient = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    protocol: 'wss',
    rejectUnauthorized: false,
    clientId: `ws-server-${Date.now()}`,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker!');
    mqttClient.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
      if (err) console.error('❌ Subscribe failed:', err);
      else console.log(`📡 Subscribed to: ${MQTT_TOPIC}`);
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const raw = message.toString();
      console.log(`\n📨 MQTT on "${topic}":`, raw.substring(0, 120));

      let data;
      try { data = JSON.parse(raw); } catch { console.warn('⚠️ Not JSON'); return; }

      // ดึง API Key จาก topic: waste_truck/{apiKey}/data
      const topicParts = topic.split('/');
      const apiKey = topicParts[1] || data.api_key || data.apiKey || data.clientID || data.client_id || data.clientId;
      if (!apiKey) { console.warn('⚠️ No API Key in topic or payload'); return; }
      console.log(`🔑 API Key (from topic): ${apiKey.substring(0, 20)}...`);

      const sensor = {
        distanceCm:  data.distance_cm ?? data.distanceCm ?? data.distance ?? null,
        lightLevel:  data.light_level ?? data.lightLevel ?? data.lux ?? 0,
        lightStatus: parseBool(data.light_status ?? data.lightStatus ?? data.led),
        autoLight:   parseBool(data.auto_light_mode ?? data.autoLightMode),
        autoStatus:  parseBool(data.auto_status_mode ?? data.autoStatusMode),
        ledRed:      parseBool(data.red_led ?? data.redLed),
        ledGreen:    parseBool(data.green_led ?? data.greenLed),
        temperature: data.temperature ?? data.temp ?? null,
        humidity:    data.humidity ?? data.hum ?? null,
      };

      await processAndStore(apiKey, sensor);
    } catch (err) {
      console.error('❌ MQTT message error:', err);
    }
  });

  mqttClient.on('error', (err) => console.error('❌ MQTT error:', err.message));
  mqttClient.on('close', () => console.log('🔌 MQTT closed'));
  mqttClient.on('reconnect', () => console.log('🔄 MQTT reconnecting...'));
  mqttClient.on('offline', () => console.log('⚠️ MQTT offline'));
}

// ============================================================
//  PROCESS & STORE → Supabase + WebSocket + Telegram
// ============================================================
// Track ว่า bin ไหน sync ค่า control ครั้งแรกแล้ว
const syncedBins = new Set();

async function processAndStore(apiKey, sensor) {
  try {
    // 1. Find bin
    const { data: bin, error: binErr } = await supabase
      .from('bins').select('*').eq('api_key', apiKey).single();

    if (binErr || !bin) {
      console.warn(`⚠️ No bin for key: ${apiKey.substring(0, 16)}...`);
      return;
    }

    const isFirstSync = !syncedBins.has(bin.id);

    // 2. Calculate waste level
    let wasteLevel = bin.waste_level;
    if (typeof sensor.distanceCm === 'number') {
      wasteLevel = calculateWasteLevel(sensor.distanceCm, bin.max_distance);
      console.log(`📏 Waste: ${wasteLevel}% (dist=${sensor.distanceCm}cm, h=${bin.max_distance}cm)`);
    }

    // 3. Store history
    await supabase.from('sensor_history').insert({
      bin_id: bin.id,
      waste_level:  wasteLevel,
      light_level:  sensor.lightLevel ?? bin.light_level,
      light_status: sensor.lightStatus ?? bin.light_status,
      led_green:    sensor.ledGreen ?? bin.led_green,
      led_red:      sensor.ledRed ?? bin.led_red,
      temperature:  sensor.temperature ?? bin.temperature,
      humidity:     sensor.humidity ?? bin.humidity,
    });

    // 4. Update bin
    // ครั้งแรก: sync ทุกค่าจาก ESP32 (รวม control) เพื่อให้ default ตรงกัน
    // ครั้งถัดไป: อัพเดตแค่ค่าเซนเซอร์ ไม่ทับค่าควบคุม
    const updatePayload = {
      waste_level:  wasteLevel,
      light_level:  sensor.lightLevel ?? bin.light_level,
      temperature:  sensor.temperature ?? bin.temperature,
      humidity:     sensor.humidity ?? bin.humidity,
      last_update:  new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };

    if (isFirstSync) {
      // ครั้งแรก: sync ค่า control จาก ESP32 ด้วย
      if (sensor.lightStatus !== null) updatePayload.light_status = sensor.lightStatus;
      if (sensor.autoLight !== null)   updatePayload.auto_light   = sensor.autoLight;
      if (sensor.autoStatus !== null)  updatePayload.auto_status  = sensor.autoStatus;
      if (sensor.ledGreen !== null)    updatePayload.led_green    = sensor.ledGreen;
      if (sensor.ledRed !== null)      updatePayload.led_red      = sensor.ledRed;
      syncedBins.add(bin.id);
      console.log(`🔄 First sync for "${bin.name}" — control fields synced from ESP32`);
    }

    const { data: updated, error: upErr } = await supabase
      .from('bins')
      .update(updatePayload)
      .eq('id', bin.id)
      .select()
      .single();

    if (upErr) { console.error('❌ Update error:', upErr.message); return; }

    console.log(`✅ "${bin.name}" updated: waste=${wasteLevel}%${isFirstSync ? ' (initial sync)' : ''}`);

    // 5. Real-time → WebSocket broadcast
    broadcastToClients('bin_update', {
      id: updated.id, name: updated.name, address: updated.address,
      district: updated.district, subDistrict: updated.sub_district,
      province: updated.province, municipality: updated.municipality,
      latitude: updated.latitude, longitude: updated.longitude,
      capacity: updated.capacity, maxDistance: updated.max_distance,
      wasteLevel: updated.waste_level, lightLevel: updated.light_level,
      lightStatus: updated.light_status,
      autoLight: updated.auto_light ?? true, autoStatus: updated.auto_status ?? true,
      ledGreen: updated.led_green, ledRed: updated.led_red,
      temperature: updated.temperature, humidity: updated.humidity,
      isActive: updated.is_active, lastUpdate: updated.last_update,
      createdAt: updated.created_at, updatedAt: updated.updated_at,
      createdBy: updated.created_by, createdByRole: updated.created_by_role,
    });

    // 6. Telegram alert
    if (wasteLevel >= WASTE_ALERT_THRESHOLD && shouldAlert(bin.id)) {
      const msg =
        `🚨 <b>แจ้งเตือนถังขยะเต็ม!</b>\n\n` +
        `📍 <b>${bin.name}</b>\n` +
        `📌 ${bin.address || 'ไม่ระบุที่อยู่'}\n` +
        `🗑️ ระดับขยะ: <b>${wasteLevel}%</b>\n` +
        `🕐 ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}\n\n` +
        `กรุณาดำเนินการจัดเก็บขยะโดยเร็ว`;
      await sendTelegramAlert(msg);
    }
  } catch (err) {
    console.error('❌ processAndStore error:', err);
  }
}

// ============================================================
//  HTTP HANDLER
// ============================================================
function handleHttpRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/publish') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { topic, payload } = JSON.parse(body);
        if (!topic || !payload) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'topic and payload required' }));
          return;
        }
        if (!mqttClient || !mqttClient.connected) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'MQTT not connected' }));
          return;
        }
        mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          } else {
            console.log(`📡 Published to [${topic}]`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          }
        });
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      mqttConnected: mqttClient?.connected ?? false,
      wsClients: wsClients.size,
      telegramConfigured: !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID),
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
}

// ============================================================
//  START
// ============================================================
connectMQTT();

httpServer.listen(HTTP_PORT, () => {
  console.log(`\n🌐 WebSocket Server on ws://localhost:${HTTP_PORT}`);
  console.log(`   POST /publish  → ส่งคำสั่งไปยัง ESP32`);
  console.log(`   GET  /health   → ตรวจสอบสถานะ`);
  console.log(`   WS   /         → Real-time updates`);
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    console.log(`   📨 Telegram alerts ON (threshold: ${WASTE_ALERT_THRESHOLD}%)`);
  } else {
    console.log(`   ⚠️ Telegram alerts OFF (set TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID)`);
  }
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (mqttClient) mqttClient.end();
  wss.close();
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  if (mqttClient) mqttClient.end();
  wss.close();
  httpServer.close();
  process.exit(0);
});

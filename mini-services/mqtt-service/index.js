const mqtt = require('mqtt');

// MQTT Configuration
const MQTT_BROKER = 'wss://48552a56151948409158b4a3ccd933fb.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'thanwa.se';
const MQTT_PASSWORD = 'Kkerboy47';
const MQTT_TOPIC = 'waste_truck/+/data';

// Main app API endpoint
const MAIN_APP_URL = 'http://localhost:3000/api/sensor';

let mqttClient = null;

function connectMQTT() {
  console.log('🚀 Starting MQTT Service...');
  console.log(`📡 Connecting to: ${MQTT_BROKER}`);
  console.log(`📌 Topic: ${MQTT_TOPIC}`);

  mqttClient = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    protocol: 'wss',
    rejectUnauthorized: false,
    clientId: `mqtt-service-${Date.now()}`,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker!');
    mqttClient.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error('❌ Failed to subscribe:', err);
      } else {
        console.log(`📡 Subscribed to: ${MQTT_TOPIC}`);
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const rawPayload = message.toString();
      console.log(`\n📨 Received on "${topic}":`);
      console.log('   Raw:', rawPayload);

      let data;
      try {
        data = JSON.parse(rawPayload);
      } catch {
        console.warn('⚠️ Payload ไม่ใช่ JSON:', rawPayload);
        return;
      }

      console.log('   Parsed:', JSON.stringify(data, null, 2));

      // รองรับ clientId ทั้งแบบ clientID, client_id, clientId
      const clientId = data.clientID || data.client_id || data.clientId;
      if (!clientId) {
        console.warn('⚠️ ไม่พบ clientID ใน payload - fields ที่มี:', Object.keys(data).join(', '));
        return;
      }

      await forwardToMainApp(clientId, data);

    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('❌ MQTT error:', err.message);
  });

  mqttClient.on('close', () => {
    console.log('🔌 MQTT connection closed');
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
  });

  mqttClient.on('offline', () => {
    console.log('⚠️ MQTT client is offline');
  });
}

async function forwardToMainApp(clientId, data) {
  try {
    // รองรับ field name หลายแบบจาก ESP32
    const distanceCm =
      data.distance_cm ??
      data.distanceCm ??
      data.distance ??
      null;

    const lightLevel =
      data.light_level ??
      data.lightLevel ??
      data.lux ??
      0;

    const lightStatusRaw =
      data.light_status ??
      data.lightStatus ??
      data.led ??
      null;

    // แปลง light status เป็น boolean
    let lightStatus = false;
    if (typeof lightStatusRaw === 'boolean') {
      lightStatus = lightStatusRaw;
    } else if (typeof lightStatusRaw === 'string') {
      lightStatus = lightStatusRaw.toUpperCase() === 'ON' || lightStatusRaw === '1';
    } else if (typeof lightStatusRaw === 'number') {
      lightStatus = lightStatusRaw === 1;
    }

    const temperature = data.temperature ?? data.temp ?? null;
    const humidity    = data.humidity ?? data.hum ?? null;

    const payload = {
      clientId,
      distanceCm,
      lightLevel,
      lightStatus,
      temperature,
      humidity,
    };

    console.log('📤 Forwarding to API:', JSON.stringify(payload));

    const response = await fetch(MAIN_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error ${response.status}:`, errorText);
    } else {
      const result = await response.json();
      console.log('✅ API response:', result.message || 'OK');
    }
  } catch (error) {
    console.error('❌ Error forwarding data:', error.message);
  }
}

// Start
connectMQTT();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (mqttClient) mqttClient.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  if (mqttClient) mqttClient.end();
  process.exit(0);
});

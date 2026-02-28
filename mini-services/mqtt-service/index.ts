// MQTT over WebSocket Service for Bun
// Using native WebSocket instead of mqtt library

const MQTT_BROKER = '48552a56151948409158b4a3ccd933fb.s1.eu.hivemq.cloud';
const MQTT_PORT = 8884;
const MQTT_USERNAME = 'thanwa.se';
const MQTT_PASSWORD = 'Kkerboy47';
const MQTT_TOPIC = 'waste_truck/+/data';

// Main app API endpoint
const MAIN_APP_URL = 'http://localhost:3000/api/sensor';

interface SensorData {
  // รองรับทุก field name ที่ ESP32 อาจส่งมา
  clientID?: string;  // legacy format
  apiKey?: string;    // camelCase
  api_key?: string;   // snake_case (ESP32 ส่งมาในรูปแบบนี้)
  distance_cm: number;
  light_level: number;
  light_status: 'ON' | 'OFF';
  red_led?: 'ON' | 'OFF';
  green_led?: 'ON' | 'OFF';
}

let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let reconnectDelay = 1000;

// WebSocket connection
let ws: WebSocket | null = null;
let messageId = 1;
let connected = false;
let pingInterval: Timer | null = null;

function connectMQTT() {
  console.log('🔄 Connecting to MQTT broker...');
  console.log(`📡 Broker: wss://${MQTT_BROKER}:${MQTT_PORT}/mqtt`);

  ws = new WebSocket(`wss://${MQTT_BROKER}:${MQTT_PORT}/mqtt`, {
    headers: {
      'Sec-WebSocket-Protocol': 'mqtt',
    },
  });

  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    console.log('✅ WebSocket connected, sending MQTT CONNECT...');

    // Send MQTT CONNECT packet
    const connectPacket = createConnectPacket('mqtt-service-' + Date.now());
    ws!.send(connectPacket);
  };

  ws.onmessage = (event) => {
    const data = new Uint8Array(event.data as ArrayBuffer);
    handleMqttPacket(data);
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };

  ws.onclose = (event) => {
    console.log('🔌 WebSocket closed:', event.code, event.reason);
    connected = false;

    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }

    // Attempt reconnect
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = reconnectDelay * Math.pow(2, Math.min(reconnectAttempts - 1, 5));
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
      setTimeout(connectMQTT, delay);
    } else {
      console.error('❌ Max reconnect attempts reached');
    }
  };
}

function createConnectPacket(clientId: string): Uint8Array {
  const protocolName = 'MQTT';
  const protocolLevel = 4; // MQTT 3.1.1
  const keepAlive = 60;
  const username = MQTT_USERNAME;
  const password = MQTT_PASSWORD;

  // Calculate remaining length
  const variableHeader =
    2 + protocolName.length + // Protocol name length + name
    1 + // Protocol level
    1 + // Connect flags
    2;  // Keep alive

  const payload =
    2 + clientId.length + clientId.length +
    2 + username.length + username.length +
    2 + password.length + password.length;

  const remainingLength = variableHeader + payload;

  // Build packet
  const packet = new Uint8Array(1 + remainingLength);
  let pos = 0;

  // Fixed header
  packet[pos++] = 0x10; // CONNECT packet type
  packet[pos++] = remainingLength;

  // Variable header
  // Protocol name
  packet[pos++] = 0x00;
  packet[pos++] = protocolName.length;
  for (let i = 0; i < protocolName.length; i++) {
    packet[pos++] = protocolName.charCodeAt(i);
  }

  // Protocol level
  packet[pos++] = protocolLevel;

  // Connect flags (username + password + clean session)
  packet[pos++] = 0xC2;

  // Keep alive
  packet[pos++] = (keepAlive >> 8) & 0xFF;
  packet[pos++] = keepAlive & 0xFF;

  // Payload
  // Client ID
  packet[pos++] = 0x00;
  packet[pos++] = clientId.length;
  for (let i = 0; i < clientId.length; i++) {
    packet[pos++] = clientId.charCodeAt(i);
  }

  // Username
  packet[pos++] = 0x00;
  packet[pos++] = username.length;
  for (let i = 0; i < username.length; i++) {
    packet[pos++] = username.charCodeAt(i);
  }

  // Password
  packet[pos++] = 0x00;
  packet[pos++] = password.length;
  for (let i = 0; i < password.length; i++) {
    packet[pos++] = password.charCodeAt(i);
  }

  return packet;
}

function createSubscribePacket(topic: string): Uint8Array {
  const packetId = messageId++;

  const variableHeader = 2; // Packet ID
  const payload = 2 + topic.length + topic.length + 1; // Topic filter + QoS
  const remainingLength = variableHeader + payload;

  const packet = new Uint8Array(1 + remainingLength);
  let pos = 0;

  // Fixed header
  packet[pos++] = 0x82; // SUBSCRIBE packet type
  packet[pos++] = remainingLength;

  // Variable header - Packet ID
  packet[pos++] = (packetId >> 8) & 0xFF;
  packet[pos++] = packetId & 0xFF;

  // Payload - Topic filter
  packet[pos++] = 0x00;
  packet[pos++] = topic.length;
  for (let i = 0; i < topic.length; i++) {
    packet[pos++] = topic.charCodeAt(i);
  }

  // QoS
  packet[pos++] = 0x01;

  return packet;
}

function createPingReqPacket(): Uint8Array {
  return new Uint8Array([0xC0, 0x00]);
}

function handleMqttPacket(data: Uint8Array) {
  const packetType = (data[0] & 0xF0) >> 4;

  switch (packetType) {
    case 2: // CONNACK
      console.log('✅ MQTT CONNACK received - Connected!');
      connected = true;
      reconnectAttempts = 0;
      reconnectDelay = 1000;

      // Subscribe to topic
      console.log(`📡 Subscribing to: ${MQTT_TOPIC}`);
      ws!.send(createSubscribePacket(MQTT_TOPIC));

      // Start ping interval
      pingInterval = setInterval(() => {
        if (connected && ws) {
          ws.send(createPingReqPacket());
        }
      }, 30000);
      break;

    case 3: // PUBLISH
      handlePublish(data);
      break;

    case 9: // SUBACK
      console.log('✅ MQTT SUBACK received - Subscribed!');
      break;

    case 13: // PINGRESP
      // Ping response - connection is alive
      break;

    default:
      console.log(`📦 Received packet type: ${packetType}`);
  }
}

function handlePublish(data: Uint8Array) {
  try {
    let pos = 1;

    // Decode remaining length
    let remainingLength = 0;
    let multiplier = 1;
    do {
      const byte = data[pos++];
      remainingLength += (byte & 0x7F) * multiplier;
      multiplier *= 128;
    } while (data[pos - 1] & 0x80);

    // Read topic length
    const topicLength = (data[pos] << 8) | data[pos + 1];
    pos += 2;

    // Read topic
    const topic = new TextDecoder().decode(data.slice(pos, pos + topicLength));
    pos += topicLength;

    // Skip QoS if present (check QoS in fixed header)
    const qos = (data[0] & 0x06) >> 1;
    if (qos > 0) {
      pos += 2; // Skip packet identifier
    }

    // Read payload
    const payload = new TextDecoder().decode(data.slice(pos, pos + remainingLength - topicLength - 2 - (qos > 0 ? 2 : 0)));

    console.log(`📨 Message on "${topic}": ${payload}`);

    // Parse and forward
    try {
      const sensorData: SensorData = JSON.parse(payload);
      forwardToMainApp(sensorData);
    } catch (e) {
      console.warn('⚠️ Failed to parse sensor data:', payload);
    }
  } catch (error) {
    console.error('❌ Error handling PUBLISH:', error);
  }
}

async function forwardToMainApp(data: SensorData) {
  try {
    // Calculate waste level from distance
    // Assuming max distance is 400cm and distance_cm is from sensor to waste
    const maxDistance = 400; // cm
    const distanceFromTop = data.distance_cm;
    const wasteLevel = Math.max(0, Math.min(100, ((maxDistance - distanceFromTop) / maxDistance) * 100));

    // ดึง API Key จากทุก field name ที่เป็นไปได้
    const resolvedKey = data.api_key || data.apiKey || data.clientID;

    if (!resolvedKey) {
      console.error('❌ No API Key found in sensor data! Fields available:', Object.keys(data));
      return;
    }

    const payload = {
      apiKey: resolvedKey,
      wasteLevel: parseFloat(wasteLevel.toFixed(1)),
      lightLevel: data.light_level,
      lightStatus: data.light_status === 'ON',
      ledRed: data.red_led === 'ON',
      ledGreen: data.green_led === 'ON',
      distanceCm: data.distance_cm,
    };

    console.log(`🔑 Using API Key: ${resolvedKey.substring(0, 16)}...`);

    const response = await fetch(MAIN_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to forward data:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('✅ Data forwarded successfully');
    }
  } catch (error) {
    console.error('❌ Error forwarding data:', error);
  }
}

// Start the service
console.log('🚀 Starting MQTT Service (Native WebSocket)...');
console.log(`📅 ${new Date().toLocaleString('th-TH')}`);
connectMQTT();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MQTT service...');
  if (pingInterval) {
    clearInterval(pingInterval);
  }
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MQTT service...');
  if (pingInterval) {
    clearInterval(pingInterval);
  }
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

# 🗑️ ระบบจัดการถังขยะอัจฉริยะ (Smart Waste Management)

ระบบติดตามและควบคุมถังขยะแบบ Real-time ผ่านเว็บแอปพลิเคชัน ใช้ ESP32 ร่วมกับ MQTT, WebSocket และ Supabase

---

## 📐 สถาปัตยกรรมระบบ

```
ESP32
 ├─ อ่านเซนเซอร์ HC-SR04 (ระยะขยะ)
 ├─ อ่าน LDR (ค่าแสง)
 └─ Publish → MQTT Broker (HiveMQ)
                     │
              MQTT Subscribe
                     │
          ┌── WebSocket Server ──┐
          │  (mqtt-service:3001)  │
          │                      │
          ├→ Real-time Update → Next.js Dashboard (WebSocket)
          ├→ Data Storage ──────→ Supabase Database
          └→ Send Alert ────────→ Telegram Bot
```

---

## ⚙️ Technology Stack

| ส่วนงาน | เทคโนโลยี |
|---------|----------|
| Hardware | ESP32 + HC-SR04 + LDR + LED + Passive Buzzer |
| Firmware | Arduino C++ (PubSubClient, ArduinoJson, WiFiManager) |
| MQTT Broker | HiveMQ Cloud |
| Backend | Next.js 15 (App Router) + Supabase |
| Auth | NextAuth.js |
| Real-time | WebSocket Server (Node.js + ws) |
| แจ้งเตือน | Telegram Bot API |
| แผนที่ | Leaflet.js |

---

## 🔌 การต่อสายวงจร ESP32

| PIN ESP32 | อุปกรณ์ | หน้าที่ |
|-----------|---------|--------|
| GPIO 5 | HC-SR04 TRIG | ส่งสัญญาณวัดระยะ |
| GPIO 18 | HC-SR04 ECHO | รับสัญญาณวัดระยะ |
| GPIO 34 | LDR | เซนเซอร์แสงสว่าง |
| GPIO 2 | LED ไฟส่องสว่าง | ไฟหน้าถัง |
| GPIO 4 | LED สีแดง | ขยะ ≥ 80% |
| GPIO 15 | LED สีเขียว | ขยะ < 80% |
| GPIO 22 | Passive Buzzer | แจ้งเตือนเสียง |

---

## 🧠 Logic การทำงานของ ESP32

```
ทุก 2 วินาที:
  ├─ วัดระยะ (HC-SR04)
  ├─ คำนวณ wastePercent = ((binHeight - distance) / binHeight) × 100
  ├─ Auto Light Mode ON  → เปิดไฟเมื่อแสงน้อย (LDR < 200)
  ├─ Auto Status Mode ON
  │    ├─ wastePercent >= 80% → LED แดงติด
  │    └─ wastePercent < 80%  → LED เขียวติด
  └─ distance <= fullDistance → Buzzer ดัง (แจ้งว่าขยะแน่นถึงระยะสุด)
```

---

## 🚀 ขั้นตอนการติดตั้ง

### 1. Clone โปรเจค
```bash
git clone https://github.com/atlezero/smart_waste_manage.git
cd smart_waste_manage
```

### 2. ติดตั้ง Dependencies
```bash
# Next.js Dashboard
npm install

# WebSocket + MQTT Service
cd mini-services/mqtt-service
npm install
```

### 3. ตั้งค่า Environment Variables
แก้ไข `.env` ที่ root ของโปรเจค:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Next Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# MQTT Broker (HiveMQ)
MQTT_BROKER="wss://xxxx.hivemq.cloud:8884/mqtt"
MQTT_USERNAME="your-username"
MQTT_PASSWORD="your-password"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_CHAT_ID="your-chat-id"
TELEGRAM_ALERT_COOLDOWN_MIN="5"
WASTE_ALERT_THRESHOLD="80"
```

### 4. สร้างฐานข้อมูล Supabase
รัน SQL ใน Supabase SQL Editor:

```sql
CREATE TABLE bins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  district TEXT,
  sub_district TEXT,
  province TEXT,
  municipality TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  capacity INTEGER DEFAULT 100,
  max_distance INTEGER DEFAULT 30,
  waste_level NUMERIC DEFAULT 0,
  light_level NUMERIC DEFAULT 0,
  light_status BOOLEAN DEFAULT false,
  auto_light BOOLEAN DEFAULT true,
  auto_status BOOLEAN DEFAULT true,
  led_green BOOLEAN DEFAULT false,
  led_red BOOLEAN DEFAULT false,
  temperature NUMERIC,
  humidity NUMERIC,
  is_active BOOLEAN DEFAULT true,
  last_update TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sensor_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bin_id UUID REFERENCES bins(id) ON DELETE CASCADE,
  waste_level NUMERIC,
  light_level NUMERIC,
  light_status BOOLEAN,
  led_green BOOLEAN,
  led_red BOOLEAN,
  temperature NUMERIC,
  humidity NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. รันระบบ

เปิด 2 Terminal:
```bash
# Terminal 1: Next.js Dashboard
npm run dev
# เข้าใช้งานที่ http://localhost:3000

# Terminal 2: WebSocket + MQTT Service
cd mini-services/mqtt-service
npm run dev
```

---

## 📟 การตั้งค่า ESP32

### ติดตั้ง Arduino Library
Library Manager → ติดตั้ง:
- `PubSubClient` (Nick O'Leary)
- `ArduinoJson` (Benoit Blanchon)
- `WiFiManager` (tzapu)

### สร้างไฟล์ `secrets.h`
```cpp
#ifndef SECRETS_H
#define SECRETS_H

// MQTT (HiveMQ)
#define SECRET_MQTT_SERVER  "xxxx.hivemq.cloud"
#define SECRET_MQTT_PORT    8883
#define SECRET_MQTT_USER    "your-username"
#define SECRET_MQTT_PASS    "your-password"

// API Key (ได้รับเมื่อเพิ่มถังขยะในระบบ)
#define SECRET_API_KEY      "swm_xxxxxxxxxxxxxxxx"

#endif
```

### Upload โค้ด
บอร์ด: `ESP32 Dev Module` → Upload `SWM-ESP32.ino`

### เชื่อมต่อ WiFi ครั้งแรก
1. ESP32 จะเปิด Access Point ชื่อ `WasteTruck_Config`
2. เชื่อมต่อจากมือถือ/คอมพิวเตอร์
3. เปิดเบราเซอร์ไปที่ `192.168.4.1`
4. กรอก WiFi SSID และ Password แล้วกด Save
5. ESP32 จะ Restart และเชื่อมต่อ WiFi อัตโนมัติ

---

## 📘 คู่มือการใช้งานเว็บแอป

### 🔐 สมัครสมาชิกและเข้าสู่ระบบ
1. เปิด `http://localhost:3000`
2. กด **"ลงทะเบียนที่นี่"** สำหรับผู้ใช้ใหม่
3. กรอก ชื่อ, Username, Password
4. เข้าสู่ระบบด้วย Username/Password

---

### 🗑️ เพิ่มถังขยะ
1. กดปุ่ม **"เพิ่มถังขยะ"** (มุมบนขวา)
2. คลิกตำแหน่งบนแผนที่
3. กรอกข้อมูล:
   - **ชื่อถัง** — สำหรับแสดงในระบบ
   - **ความสูงถัง (cm)** — ใช้คำนวณ % ขยะ
4. กด **"บันทึก"** → ระบบสร้าง API Key ให้อัตโนมัติ
5. นำ API Key ไปใส่ใน `secrets.h` บน ESP32

> ⚠️ **สำคัญ:** API Key แสดงครั้งเดียว เก็บไว้ทันที!

---

### 🎛️ ควบคุมถังขยะ
คลิกถังขยะบนแผนที่หรือ Dashboard แล้วดูหน้ารายละเอียด:

| ตัวควบคุม | การทำงาน |
|----------|---------|
| **Auto ไฟส่องสว่าง** ON | ESP32 เปิด/ปิดไฟตามค่าแสง LDR อัตโนมัติ |
| **Auto ไฟส่องสว่าง** OFF | ควบคุมไฟเองจากเว็บได้ |
| **ไฟส่องสว่าง** | Toggle เปิด/ปิดแบบ Manual |
| **Auto สถานะ** ON | LED เปลี่ยนตาม % ขยะ (≥80% = แดง) |
| **Auto สถานะ** OFF | ควบคุม LED เองจากเว็บ |
| **LED แดง / เขียว** | Toggle แบบ Manual |
| **Reset WiFi** | รีสตาร์ท ESP32 เพื่อตั้ง WiFi ใหม่ |
| **ระยะตรวจจับถังเต็ม** | ตั้งระยะ (cm) ที่ Buzzer จะดัง |

> ⚠️ ปุ่ม Manual จะ disabled เมื่อ Auto Mode กำลังทำงาน  
> ⚠️ ทุกปุ่มจะ disabled เมื่อ ESP32 ออฟไลน์

---

### 📊 สถานะถังขยะ (Dashboard)

| สี Badge | ความหมาย |
|---------|---------|
| 🟢 เขียว | ขยะ 0–49% |
| 🟡 เหลือง | ขยะ 50–79% |
| 🔴 แดง | ขยะ ≥ 80% (แจ้งเตือน Telegram) |

---

### 🗑️ ลบถังขยะ
- เฉพาะ **ผู้สร้างถัง** หรือ **Admin** เท่านั้น
- กดปุ่มลบ → ยืนยันอีกครั้ง

---

### 📨 ตั้งค่า Telegram Bot
1. ค้นหา `@BotFather` ใน Telegram → ส่ง `/newbot`
2. คัดลอก Token ใส่ `TELEGRAM_BOT_TOKEN` ใน `.env`
3. เปิด URL: `https://api.telegram.org/bot{TOKEN}/getUpdates`
4. คัดลอก `chat_id` ใส่ `TELEGRAM_CHAT_ID` ใน `.env`

ระบบจะแจ้งเตือนเมื่อขยะ ≥ 80% โดยมี cooldown ตามที่ตั้งใน `TELEGRAM_ALERT_COOLDOWN_MIN`

---

## 📁 โครงสร้างโปรเจค

```
smart_waste_manage/
├── SWM-ESP32.ino              # Firmware ESP32
├── secrets.h                  # ข้อมูลลับ ESP32 (ไม่ commit)
├── .env                       # Environment Variables (ไม่ commit)
│
├── src/
│   ├── app/
│   │   ├── page.tsx           # หน้าหลัก Dashboard + แผนที่
│   │   ├── login/             # หน้าเข้าสู่ระบบ
│   │   ├── register/          # หน้าสมัครสมาชิก
│   │   └── api/
│   │       ├── bins/          # CRUD ถังขยะ
│   │       ├── command/       # ส่งคำสั่งไป ESP32
│   │       └── auth/          # NextAuth + Register
│   ├── hooks/
│   │   └── useWebSocket.ts    # Hook รับข้อมูล Real-time
│   └── store/
│       └── app-store.ts       # Zustand state
│
└── mini-services/
    └── mqtt-service/
        └── index.js           # WebSocket Server
                               # (MQTT + Supabase + Telegram)
```

---

## 🔒 ความปลอดภัย

- ❌ ไม่ commit `.env` และ `secrets.h` ขึ้น Git
- ✅ Password ผ่าน bcryptjs hash ก่อนบันทึก
- ✅ ทุก Route ป้องกันด้วย NextAuth middleware
- ✅ API Key ไม่แสดงในหน้าเว็บหลังสร้าง
- ✅ ลบถังขยะต้องยืนยันและตรวจสิทธิ์

---

## 🐛 แก้ปัญหาเบื้องต้น

**Port 3001 ถูกใช้งานอยู่:**
```bash
netstat -ano | findstr "LISTENING" | findstr ":3001"
taskkill /PID <PID> /F
```

**ESP32 ไม่เชื่อม MQTT:**
- เปิด Serial Monitor (115200 baud) ดู log
- ตรวจสอบ `secrets.h` ว่า MQTT credentials ถูกต้อง

**Dashboard ไม่อัพเดต Real-time:**
- ตรวจสอบว่า `mqtt-service` รันอยู่ (port 3001)
- เปิด Browser Console ดู WebSocket connection log

**ESP32 WiFi หลุดบ่อย:**
- กดปุ่ม **Reset WiFi** จากหน้าเว็บ หรือ
- กด Reset บน ESP32 แล้วเชื่อม AP `WasteTruck_Config` ใหม่

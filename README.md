# Smart Waste Management System — ระบบจัดการถังขยะอัจฉริยะ

ระบบติดตามและควบคุมถังขยะอัจฉริยะสำหรับเทศบาล แสดงผลบนแผนที่, Dashboard และส่งแจ้งเตือนอัตโนมัติผ่าน Telegram

---

## 📐 สถาปัตยกรรมระบบ

```
ESP32  ──MQTT Publish──►  MQTT Broker (HiveMQ)
                                   │
                           MQTT Subscribe
                                   │
                     ┌─── WebSocket Server ───┐
                     │  (mqtt-service :3001)  │
                     │                        │
                     ├──► Real-time Update ──► Next.js Dashboard (WebSocket)
                     ├──► Data Storage ──────► Supabase Database
                     └──► Send Alert ────────► Telegram Bot
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Hardware** | ESP32 + HC-SR04 + LDR + LED |
| **Firmware** | Arduino C++ (PubSubClient, ArduinoJson) |
| **MQTT Broker** | HiveMQ Cloud |
| **Backend** | Next.js 15 (App Router) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | NextAuth.js |
| **Real-time** | WebSocket Server (Node.js + ws) |
| **Alert** | Telegram Bot API |
| **Map** | Leaflet.js |

---

## 🚀 การติดตั้งและรันโปรเจค

### ข้อกำหนดเบื้องต้น
- Node.js ≥ 18
- npm ≥ 9
- บัญชี [Supabase](https://supabase.com)
- บัญชี [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/) (free tier ได้)
- Arduino IDE พร้อม ESP32 Board

---

### 1. Clone โปรเจค
```bash
git clone <repo-url>
cd Smart_waste_managment
```

### 2. ติดตั้ง Dependencies
```bash
# Next.js dashboard
npm install

# WebSocket + MQTT service
cd mini-services/mqtt-service
npm install
```

### 3. ตั้งค่า Environment Variables

คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่าของคุณ:

```bash
cp .env.example .env
```

แก้ไขค่าใน `.env`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Next Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# MQTT Broker (HiveMQ)
MQTT_BROKER="wss://xxxx.hivemq.cloud:8884/mqtt"
MQTT_USERNAME="your-mqtt-user"
MQTT_PASSWORD="your-mqtt-pass"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_CHAT_ID="your-chat-id"
TELEGRAM_ALERT_COOLDOWN_MIN="5"   # ดีเลย์แจ้งเตือนซ้ำ (นาที)
WASTE_ALERT_THRESHOLD="80"        # เปอร์เซ็นต์ที่จะแจ้งเตือน
```

### 4. สร้างฐานข้อมูล Supabase

รัน SQL ต่อไปนี้ใน Supabase SQL Editor:

```sql
-- ตาราง bins (ถังขยะ)
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

-- ตาราง sensor_history (ประวัติข้อมูลเซนเซอร์)
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

-- ตาราง users (ผู้ใช้งาน)
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

เปิด **2 Terminal** ดังนี้:

```bash
# Terminal 1: Next.js Dashboard
npm run dev
# เปิดที่ http://localhost:3000

# Terminal 2: WebSocket + MQTT Service
cd mini-services/mqtt-service
npm run dev
# เปิดที่ ws://localhost:3001
```

---

## 📟 การตั้งค่า ESP32

### 1. ติดตั้ง Arduino Library

เปิด Arduino IDE → Library Manager → ติดตั้ง:
- `PubSubClient` by Nick O'Leary
- `ArduinoJson` by Benoit Blanchon

### 2. สร้างไฟล์ `secrets.h`

สร้างไฟล์ `secrets.h` ในโฟลเดอร์เดียวกับ `.ino`:

```cpp
#ifndef SECRETS_H
#define SECRETS_H

// WiFi
#define SECRET_SSID "your-wifi-ssid"
#define SECRET_PASS "your-wifi-password"

// MQTT (HiveMQ)
#define SECRET_MQTT_SERVER "xxxx.hivemq.cloud"
#define SECRET_MQTT_PORT 8883
#define SECRET_MQTT_USER "your-mqtt-user"
#define SECRET_MQTT_PASS "your-mqtt-pass"

// API Key ของถังขยะ (ได้รับเมื่อเพิ่มถังขยะในระบบ)
#define SECRET_API_KEY "swm_xxxxxxxxxxxxxxxx"

// Telegram (ถ้าต้องการให้ ESP32 แจ้งเตือนเองด้วย)
#define SECRET_TELEGRAM_TOKEN ""
#define SECRET_TELEGRAM_CHAT_ID ""

#endif
```

### 3. การเชื่อมต่อ PIN

| PIN ESP32 | อุปกรณ์ | คำอธิบาย |
|-----------|---------|---------|
| GPIO 5 | HC-SR04 TRIG | อัลตราโซนิควัดระยะ |
| GPIO 18 | HC-SR04 ECHO | รับสัญญาณวัดระยะ |
| GPIO 34 | LDR | เซนเซอร์แสง |
| GPIO 2 | LED ไฟส่องสว่าง | ไฟสว่างของถัง |
| GPIO 4 | LED แดง | ไฟสถานะ (ถังเต็ม) |
| GPIO 15 | LED เขียว | ไฟสถานะ (ถังว่าง) |

### 4. Upload โค้ด

เลือก Board: `ESP32 Dev Module` → Upload `SWM-ESP32.ino`

---

## 📖 คู่มือการใช้งาน

### 🔐 การสมัครสมาชิกและเข้าระบบ

1. เปิดเว็บ `http://localhost:3000`
2. กดปุ่ม **"ลงทะเบียนที่นี่"** สำหรับผู้ใช้ใหม่
3. กรอกชื่อ, ชื่อผู้ใช้, รหัสผ่าน แล้วกด **"สมัครสมาชิก"**
4. เข้าสู่ระบบด้วย username/password ที่ตั้งไว้

> **Admin เริ่มต้น:** ใช้ตัวแปร `ADMIN_USERNAME` และ `ADMIN_PASSWORD` ใน `.env`

---

### 🗑️ การเพิ่มถังขยะ

1. กดปุ่ม **"เพิ่มถังขยะ"** มุมบนขวา
2. คลิกตำแหน่งบนแผนที่เพื่อเลือกที่ตั้งถัง
3. กรอกข้อมูล:
   - ชื่อถัง
   - ความสูงของถัง (cm) — ใช้คำนวณระดับขยะ
4. กด **"บันทึก"** → ระบบจะสร้าง **API Key** ให้อัตโนมัติ
5. นำ API Key ไปใส่ใน `secrets.h` ของ ESP32

> ⚠️ **สำคัญ:** API Key จะไม่แสดงซ้ำในหน้าเว็บหลังจากสร้าง เก็บไว้ใน `secrets.h` ทันที

---

### 🎛️ การควบคุมถังขยะ

คลิกที่ถังขยะบนแผนที่หรือ Dashboard เพื่อเปิดหน้ารายละเอียด:

| ปุ่ม | การทำงาน |
|-----|---------|
| **Auto ไฟส่องสว่าง** (เปิด) | ESP32 เปิด/ปิดไฟตามค่าแสง LDR อัตโนมัติ |
| **Auto ไฟส่องสว่าง** (ปิด) | ควบคุมไฟส่องสว่างเองได้จากเว็บ |
| **ไฟส่องสว่าง** | เปิด/ปิดไฟส่องสว่างแบบแมนนวล |
| **Auto สถานะ** (เปิด) | ESP32 เปลี่ยนไฟสถานะตามระดับขยะอัตโนมัติ |
| **Auto สถานะ** (ปิด) | ควบคุมไฟสถานะเองได้จากเว็บ |
| **LED แดง / เขียว** | เปิด/ปิดไฟ LED สถานะแบบแมนนวล |

> ⚠️ ไม่สามารถควบคุม Manual ได้หาก Auto Mode เปิดอยู่

---

### 🗑️ การลบถังขยะ

- เฉพาะ **ผู้สร้างถัง** หรือ **Admin** เท่านั้น
- กดปุ่มลบ → กด **"ยืนยัน"** อีกครั้ง

---

### 📨 การตั้งค่า Telegram Bot

1. ค้นหา `@BotFather` ใน Telegram
2. ส่ง `/newbot` และตั้งชื่อบอท
3. คัดลอก **Bot Token** ใส่ใน `.env` → `TELEGRAM_BOT_TOKEN`
4. ส่งข้อความหาบอทของคุณ แล้วเปิด URL:
   ```
   https://api.telegram.org/bot{TOKEN}/getUpdates
   ```
5. คัดลอก `chat_id` จากผลลัพธ์ ใส่ใน `TELEGRAM_CHAT_ID`

ระบบจะส่งแจ้งเตือนเมื่อขยะ ≥ `WASTE_ALERT_THRESHOLD`% (ค่า default 80%)

---

## 📁 โครงสร้างโปรเจค

```
Smart_waste_managment/
├── SWM-ESP32.ino              # โค้ด ESP32 firmware
├── secrets.h                   # ความลับ ESP32 (ไม่ commit ขึ้น Git)
├── .env                        # Environment Variables (ไม่ commit)
│
├── src/
│   ├── app/
│   │   ├── page.tsx            # หน้าหลัก Dashboard + แผนที่
│   │   ├── login/              # หน้าเข้าสู่ระบบ
│   │   ├── register/           # หน้าสมัครสมาชิก
│   │   └── api/
│   │       ├── bins/           # API จัดการถังขยะ (CRUD)
│   │       ├── sensor/         # API รับข้อมูล sensor
│   │       ├── command/        # API ส่งคำสั่งไป ESP32
│   │       └── auth/           # NextAuth + Register
│   ├── components/
│   │   ├── modals/             # BinDetailModal, AddBinModal
│   │   ├── dashboard/          # Dashboard UI
│   │   └── map/                # แผนที่ Leaflet
│   ├── hooks/
│   │   └── useWebSocket.ts     # Hook รับข้อมูล Real-time
│   ├── store/
│   │   └── app-store.ts        # Zustand state management
│   └── lib/
│       └── supabase.ts         # Supabase client
│
└── mini-services/
    └── mqtt-service/
        └── index.js            # WebSocket Server
                                # (MQTT Subscribe + Supabase + Telegram)
```

---

## 🔒 ความปลอดภัย

- ❌ ไม่ commit `.env` และ `secrets.h` ขึ้น Git
- ✅ Passwords ถูก hash ด้วย `bcryptjs` ก่อนบันทึก
- ✅ Routes ทั้งหมดถูก protect ด้วย NextAuth middleware
- ✅ API Key ไม่แสดงในหน้าเว็บหลังสร้าง
- ✅ การลบถังขยะต้องยืนยันและตรวจสิทธิ์ผู้สร้าง/Admin

---

## 🐛 แก้ปัญหาเบื้องต้น

**Port 3001 ถูกใช้งานอยู่:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

**ESP32 ไม่ connect MQTT:**
- ตรวจสอบ WiFi credentials ใน `secrets.h`
- ตรวจสอบ MQTT broker URL และ port (8883)
- ดู Serial Monitor ที่ 115200 baud

**Dashboard ไม่อัพเดต Real-time:**
- ตรวจสอบว่า `mqtt-service` รันอยู่
- เปิด Browser Console ดู WebSocket connection log

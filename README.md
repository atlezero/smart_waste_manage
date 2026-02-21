# 🌍 Smart Waste Management System

A comprehensive Internet of Things (IoT) solution for real-time waste monitoring and management. This system provides a modern web dashboard to track the fill level of smart bins, analyze data, and optimize waste collection routes.

![Smart Waste Management System](https://img.shields.io/badge/Status-Active-success)
![Next.js](https://img.shields.io/badge/Next.js-16+-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)
![MQTT](https://img.shields.io/badge/MQTT-IoT-blue)

---

## ✨ Key Features

- **🌐 Real-Time Dashboard:** Monitor the exact capacity, live status, and sensor history of every connected bin.
- **�️ Interactive Map View:** See the exact geographical location of bins and their current waste levels on a map.
- **📊 Analytics & Statistics:** View historical data, average waste levels, and predictive insights for optimization.
- **📡 MQTT Mini-Service:** Lightweight background service that subscribes to IoT data via WebSocket (HiveMQ) and synchronizes it directly with the API.
- **📱 Responsive UI:** Beautiful, accessible, and fast interface built with Tailwind CSS and `shadcn/ui`.

---

## 🛠️ Technology Stack

### Frontend & API
- **Framework:** [Next.js (App Router)](https://nextjs.org/)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/)
- **State Management:** Zustand
- **Map Integration:** React Leaflet / Leaflet
- **Data Visualization:** Recharts

### Backend & Database
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **SDK:** `@supabase/supabase-js`

### IoT Data Ingestion
- **Protocol:** MQTT over WebSockets
- **Broker:** HiveMQ Cloud
- **MQTT Service:** Node.js (Standalone mini-service)

---

## 📂 Project Structure

```text
� Smart Waste Management
├── 📂 db/                       # Contains SQL scripts for Supabase setup
│   └── schema.sql               # Database schema (Tables, RLS, Indexes)
├── � mini-services/            # Standalone background services
│   └── 📂 mqtt-service/         # Node.js service for handling IoT MQTT messages
├── 📂 src/
│   ├── 📂 app/                  # Next.js Pages & API Routes
│   │   ├── 📂 api/              # Backend endpoints (bins, sensor, stats)
│   │   └── page.tsx             # Main dashboard page
│   ├── 📂 components/           # Reusable UI components (Dashboard, Map, Forms)
│   ├── 📂 lib/                  # Utilities and Supabase client setup
│   └── � store/                # Zustand global state (app-store.ts)
├── .env                         # Environment variables
├── package.json                 # Project dependencies & scripts
└── README.md                    # Project documentation
```

---

## � Getting Started

Follow these instructions to set up the project locally.

### 1. Prerequisites
- **Node.js** (v18 or newer recommended)
- **Supabase Account** (for Postgres database)
- **npm** or **yarn** or **pnpm**

### 2. Installation

Clone the repository and install the dependencies for both the main app and the MQTT service:

```bash
# 1. Install main Next.js app dependencies
npm install

# 2. Install MQTT mini-service dependencies
cd mini-services/mqtt-service
npm install

# 3. Return to root directory
cd ../..
```

### 3. Database Setup (Supabase)

1. Go to your [Supabase Dashboard](https://app.supabase.com/).
2. Create a new project (if you haven't already).
3. Open the **SQL Editor** in Supabase.
4. Copy the entire contents of `db/schema.sql` from this repository.
5. Paste it into the SQL Editor and click **Run**.
   *(This will create the `bins` and `sensor_history` tables along with necessary indexes and security policies).*

### 4. Environment Variables

Create or edit the `.env` file in the root directory. You will need your Supabase API keys from **Project Settings > API**.

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### 5. Running the Application locally

This project uses `concurrently` to run both the Next.js web application and the MQTT background service simultaneously with a single command.

Run the development server:

```bash
npm run dev
```

**What happens when you run this?**
- `dev:webapp`: Starts the Next.js server on http://localhost:3000
- `dev:mqtt`: Starts the Node.js MQTT listener script that connects to the broker and forwards data to the Next.js API.

---

## 📡 MQTT Data Flow & IoT Integration

The system is designed to receive data from ESP32/ESP8266 modules attached to the bins. 

1. **Hardware (ESP32):** Reads distance (ultrasonic) and light levels.
2. **Broker (HiveMQ):** The hardware publishes JSON payloads to the `waste_truck/+/data` topic.
3. **MQTT Service (`mini-services/mqtt-service`):** Subscribes to the topic, parses the JSON payload, and ensures formatting consistency.
4. **API:** The MQTT service forwards the parsed data via HTTP POST to `/api/sensor`.
5. **Database:** The API calculates the waste percentage based on the bin's total height (`max_distance`) and updates Supabase.

### Supported Payload Format from Hardware
The MQTT service is extremely flexible and supports multiple key variations emitted by IoT devices:

```json
{
  "clientID": "BIN-001",         // Or client_id, clientId
  "distance_cm": 25.5,           // Or distanceCm, distance
  "light_level": 400,            // Or lightLevel, lux
  "light_status": "ON",          // Or lightStatus, led (Supports "ON"/"OFF", true/false, 1/0)
  "temperature": 32.5,           // Optional (Or temp)
  "humidity": 60                 // Optional (Or hum)
}
```

---

## ⚙️ Available Scripts

In the root directory, you can run:

- `npm run dev` - Starts both the Next.js app and the MQTT wrapper service.
- `npm run build` - Builds the Next.js app for production.
- `npm run start` - Starts the Next.js production server.
- `npm run lint` - Runs ESLint to catch bugs and style issues.

---

## 🤝 Contribution

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

---
Built with modern web technologies to make cities cleaner and smarter. 🏙️♻️

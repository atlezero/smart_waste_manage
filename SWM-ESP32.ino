#include <WiFi.h>
#include <WiFiClientSecure.h> 
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include "secrets.h"

// --- ตั้งค่า WiFi ---
const char* ssid = SECRET_SSID;
const char* password = SECRET_PASS;

const char* mqtt_server = SECRET_MQTT_SERVER; 
const int mqtt_port = SECRET_MQTT_PORT;

const char* mqtt_user = SECRET_MQTT_USER;
const char* mqtt_pass = SECRET_MQTT_PASS;

const char* telegram_token = SECRET_TELEGRAM_TOKEN;
const char* telegram_chat_id = SECRET_TELEGRAM_CHAT_ID;

const char* API_KEY = SECRET_API_KEY;

// --- กำหนดขา PIN ---
#define TRIG_PIN 5
#define ECHO_PIN 18
#define LDR_PIN 34
#define LIGHT_PIN 2
#define RED_STATUS_PIN 4
#define GREEN_STATUS_PIN 15

unsigned long previousMillis = 0;
const long interval = 2000; 

bool isFull = false;
const int FULL_DISTANCE = 5;
bool autoLightMode = true;
bool autoStatusMode = true;

bool isLightOn = false;
bool isRedOn = false;
bool isGreenOn = false;

String baseTopic = "waste_truck/";
String deviceTopic;

WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup_wifi();
void reconnect();
long readUltrasonic();
void callback(char* topic, byte* payload, unsigned int length);
void sendTelegram(String text);

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LIGHT_PIN, OUTPUT);
  pinMode(RED_STATUS_PIN, OUTPUT);
  pinMode(GREEN_STATUS_PIN, OUTPUT);
  pinMode(LDR_PIN, INPUT);

  setup_wifi();

  deviceTopic = baseTopic + String(API_KEY);
  Serial.println("Device Topic: " + deviceTopic);

  espClient.setInsecure(); 
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setBufferSize(512);
}

void setup_wifi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(API_KEY, mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      String cmdTopic = deviceTopic + "/cmd";
      client.subscribe(cmdTopic.c_str());
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

bool parseBoolOrString(JsonVariant val) {
  if (val.is<const char*>()) {
    String s = val.as<String>();
    s.toUpperCase();
    return (s == "ON" || s == "TRUE" || s == "1");
  }
  return val.as<bool>();
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println("\n--- [MQTT RECEIVED] ---");
  Serial.println(message);

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, message)) {
    Serial.println("JSON Parse Error");
    return;
  }

  // อ่าน auto_light และ auto_status ก่อนเสมอ
  if (doc.containsKey("auto_light")) {
    autoLightMode = parseBoolOrString(doc["auto_light"]);
    Serial.println(autoLightMode ? "=> Auto Light Mode: ENABLED" : "=> Auto Light Mode: DISABLED");
  }

  if (doc.containsKey("auto_status")) {
    autoStatusMode = parseBoolOrString(doc["auto_status"]);
    Serial.println(autoStatusMode ? "=> Auto Status Mode: ENABLED" : "=> Auto Status Mode: DISABLED");
  }

  // ถ้าเว็บสั่ง light มา ให้ปิด autoLightMode อัตโนมัติแล้วสั่งงานเลย
  if (doc.containsKey("light")) {
    autoLightMode = false;
    isLightOn = parseBoolOrString(doc["light"]);
    digitalWrite(LIGHT_PIN, isLightOn ? HIGH : LOW);
    Serial.println("=> Auto Light Mode: DISABLED (by manual command)");
    Serial.println(isLightOn ? "=> Manual Light: ON" : "=> Manual Light: OFF");
  }

  // ถ้าเว็บสั่ง red/green มา ให้ปิด autoStatusMode อัตโนมัติแล้วสั่งงานเลย
  if (doc.containsKey("red")) {
    autoStatusMode = false;
    isRedOn = parseBoolOrString(doc["red"]);
    digitalWrite(RED_STATUS_PIN, isRedOn ? HIGH : LOW);
    Serial.println("=> Auto Status Mode: DISABLED (by manual command)");
    Serial.println(isRedOn ? "=> Manual Red: ON" : "=> Manual Red: OFF");
  }

  if (doc.containsKey("green")) {
    autoStatusMode = false;
    isGreenOn = parseBoolOrString(doc["green"]);
    digitalWrite(GREEN_STATUS_PIN, isGreenOn ? HIGH : LOW);
    Serial.println("=> Auto Status Mode: DISABLED (by manual command)");
    Serial.println(isGreenOn ? "=> Manual Green: ON" : "=> Manual Green: OFF");
  }
}

void sendTelegram(String text) {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure httpsClient;
  httpsClient.setInsecure(); 
  HTTPClient http;
  String url = "https://api.telegram.org/bot" + String(telegram_token) +
               "/sendMessage?chat_id=" + String(telegram_chat_id) + "&text=" + text;
  http.begin(httpsClient, url);
  http.GET();
  http.end();
}

long readUltrasonic() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // ✅ เพิ่ม Timeout 30000 ไมโครวินาที (30ms) ป้องกันบอร์ดค้างรอเซนเซอร์นานเกินไป
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  return (duration == 0) ? 400 : duration * 0.034 / 2;
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop(); 

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    long distance = readUltrasonic();
    int ldrValue = analogRead(LDR_PIN);

    // 1. Auto Light Logic
    if (autoLightMode) {
      isLightOn = (ldrValue < 200);
      digitalWrite(LIGHT_PIN, isLightOn ? HIGH : LOW);
    }

    // 2. ถังเต็ม Logic (เช็คสถานะและจำไว้ก่อน)
    bool justBecameFull = false; // ตัวแปรสำหรับจำว่าถังเพิ่งเต็มในรอบนี้
    
    if (distance <= FULL_DISTANCE) {
      if (!isFull) {
        isFull = true;
        justBecameFull = true; 
      }
    } else {
      if (isFull) {
        isFull = false;
      }
    }

    // 2.1 Auto Status Logic (สั่งเปลี่ยนสีไฟ LED ทันที!)
    if (autoStatusMode) {
      if (isFull) {
        isRedOn = true;
        isGreenOn = false;
        digitalWrite(RED_STATUS_PIN, HIGH);
        digitalWrite(GREEN_STATUS_PIN, LOW);
      } else {
        isRedOn = false;
        isGreenOn = true;
        digitalWrite(RED_STATUS_PIN, LOW);
        digitalWrite(GREEN_STATUS_PIN, HIGH);
      }
    }

    // 2.2 ส่ง Telegram (ทำหลังสุด หลังจากไฟเปลี่ยนสีเรียบร้อยแล้ว)
    if (justBecameFull) {
      sendTelegram("🚨 ถังขยะ [" + String(API_KEY) + "] เต็มแล้ว! (ระยะ: " + String(distance) + " cm)");
    }

    // 3. ส่งข้อมูลกลับเว็บ
    StaticJsonDocument<512> doc;
    doc["api_key"] = API_KEY;        
    doc["distance_cm"] = distance;
    doc["light_level"] = ldrValue;
    doc["light_status"] = isLightOn ? "ON" : "OFF";
    doc["red_led"] = isRedOn ? "ON" : "OFF";
    doc["green_led"] = isGreenOn ? "ON" : "OFF";
    doc["is_full"] = isFull;
    doc["auto_light_mode"] = autoLightMode ? "ON" : "OFF";
    doc["auto_status_mode"] = autoStatusMode ? "ON" : "OFF";

    char jsonBuffer[512];
    serializeJson(doc, jsonBuffer);
    String dataTopic = deviceTopic + "/data";
    client.publish(dataTopic.c_str(), jsonBuffer);
  }
}
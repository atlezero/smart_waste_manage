#include <WiFi.h>
#include <WiFiClientSecure.h> 
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include "secrets.h"

const char* mqtt_server = SECRET_MQTT_SERVER;
const int mqtt_port = SECRET_MQTT_PORT;
const char* mqtt_user = SECRET_MQTT_USER;
const char* mqtt_pass = SECRET_MQTT_PASS;
const char* API_KEY = SECRET_API_KEY;

#define TRIG_PIN 5
#define ECHO_PIN 18
#define LDR_PIN 34
#define LIGHT_PIN 2
#define RED_STATUS_PIN 4
#define GREEN_STATUS_PIN 15
#define BUZZER_PIN 22  // ✅ ใช้ Passive Buzzer

unsigned long previousMillis = 0;
unsigned long lastMqttRetry = 0;
unsigned long lastWifiBlink = 0;
unsigned long startConnTime = 0;
unsigned long lastHourlyRetry = 0;

const long interval = 2000;
const long mqttRetryInterval = 5000;
const unsigned long hourlyInterval = 3600000;
const unsigned long connTimeout = 10000;

bool isFull = false;
// ค่า default ก่อนเว็บส่งค่ามา (ปรับได้ผ่าน MQTT command)
int fullDistance = 5;   // ระยะ buzzer ดัง เมื่อถังเต็มสุด (cm) — default เมื่อ boot และก่อน MQTT connect
int binHeight = 30;      // ความสูงถัง (cm) — ใช้คำนวณ % ขยะ — default เมื่อ boot และก่อน MQTT connect
const int RED_THRESHOLD = 80; // LED แดงติดเมื่อขยะ >= 80%
bool autoLightMode = true;
bool autoStatusMode = true;
bool wifiAttempting = true;
bool connectionFailed = false;
bool shouldResetWifi = false;

String deviceTopic;
WiFiClientSecure espClient;
PubSubClient client(espClient);

void callback(char* topic, byte* payload, unsigned int length);
bool parseBoolOrString(JsonVariant val);
void startWifiManager();

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LIGHT_PIN, OUTPUT);
  pinMode(RED_STATUS_PIN, OUTPUT);
  pinMode(GREEN_STATUS_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LDR_PIN, INPUT);

  Serial.println("\nSystem Booting... Starting WiFiManager");
  startWifiManager();

  startConnTime = millis();
  deviceTopic = "waste_truck/" + String(SECRET_API_KEY);
  espClient.setInsecure();
  client.setServer(SECRET_MQTT_SERVER, SECRET_MQTT_PORT);
  client.setCallback(callback);
  
  // ✅ เพิ่ม Buffer Size ตรงนี้ เพื่อให้รองรับการส่ง JSON ก้อนใหญ่!
  client.setBufferSize(512);
}

void startWifiManager() {
  WiFiManager wm;
  wm.setConfigPortalTimeout(120);

  digitalWrite(RED_STATUS_PIN, HIGH);
  digitalWrite(GREEN_STATUS_PIN, HIGH);

  if (!wm.autoConnect("WasteTruck_Config")) {
    Serial.println("WiFi Config Timeout - Running in Edge Mode");
    wifiAttempting = false;
    connectionFailed = true;
    digitalWrite(RED_STATUS_PIN, LOW);
    digitalWrite(GREEN_STATUS_PIN, LOW);
  } else {
    wifiAttempting = false;
    connectionFailed = false;
    digitalWrite(RED_STATUS_PIN, LOW);
    tone(BUZZER_PIN, 1000); delay(2000); noTone(BUZZER_PIN);
    digitalWrite(GREEN_STATUS_PIN, HIGH);
    Serial.println("WiFi Connected Successfully!");
  }
}

void handleConnectivity() {
  unsigned long currentMillis = millis();

  if (shouldResetWifi) {
    shouldResetWifi = false;
    Serial.println("=> Resetting WiFi... Opening AP: WasteTruck_Config");
    client.disconnect();
    WiFiManager wm;
    wm.resetSettings();
    delay(500);
    startWifiManager();
    lastMqttRetry = 0;
    return;
  }

  if (connectionFailed && (currentMillis - lastHourlyRetry > hourlyInterval)) {
    lastHourlyRetry = currentMillis;
    wifiAttempting = true;
    connectionFailed = false;
    startConnTime = currentMillis;
    WiFi.begin();
    Serial.println("Hourly Retry: Attempting to reconnect WiFi...");
  }

  if (wifiAttempting) {
    if (WiFi.status() != WL_CONNECTED) {
      if (currentMillis - lastWifiBlink > 250) {
        lastWifiBlink = currentMillis;
        digitalWrite(GREEN_STATUS_PIN, !digitalRead(GREEN_STATUS_PIN));
      }
      if (currentMillis - startConnTime > connTimeout) {
        wifiAttempting = false;
        connectionFailed = true;
        digitalWrite(GREEN_STATUS_PIN, LOW);
        Serial.println("WiFi Timeout - Back to Edge Mode");
      }
    } else {
      wifiAttempting = false;
      connectionFailed = false;
      tone(BUZZER_PIN, 1000); delay(2000); noTone(BUZZER_PIN);
      digitalWrite(GREEN_STATUS_PIN, HIGH);
      Serial.println("Reconnected Successfully!");
    }
  }

  if (WiFi.status() == WL_CONNECTED && !client.connected()) {
    if (currentMillis - lastMqttRetry > mqttRetryInterval) {
      lastMqttRetry = currentMillis;
      if (client.connect(SECRET_API_KEY, SECRET_MQTT_USER, SECRET_MQTT_PASS)) {
        client.subscribe((deviceTopic + "/cmd").c_str());
        Serial.println("MQTT Connected and Subscribed!");
      }
    }
  }
}

long readUltrasonic() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 25000);
  return (duration == 0) ? 400 : duration * 0.034 / 2;
}

void loop() {
  handleConnectivity(); 
  client.loop();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    long distance = readUltrasonic();
    int ldrValue = analogRead(LDR_PIN);

    // คำนวณ % ขยะจากความสูงถัง
    int effectiveHeight = max(binHeight, 1);
    long clampedDist = min(distance, (long)effectiveHeight);
    int wastePercent = (int)(((effectiveHeight - clampedDist) * 100.0) / effectiveHeight);
    wastePercent = constrain(wastePercent, 0, 100);

    if (autoLightMode) {
      digitalWrite(LIGHT_PIN, (ldrValue < 200) ? HIGH : LOW);
    }

    // buzzer: ติดเมื่อระยะน้อยกว่า fullDistance
    if (distance <= fullDistance) {
      if (!isFull) {
        isFull = true;
        tone(BUZZER_PIN, 1000); delay(150); noTone(BUZZER_PIN);
      }
    } else {
      isFull = false;
    }

    // LED แดง = ขยะ >= 80%, LED เขียว = ขยะ < 80%
    if (autoStatusMode && !wifiAttempting) {
      bool redOn = (wastePercent >= RED_THRESHOLD);
      digitalWrite(RED_STATUS_PIN, redOn ? HIGH : LOW);
      digitalWrite(GREEN_STATUS_PIN, redOn ? LOW : HIGH);
    }

    if (client.connected()) {
      StaticJsonDocument<512> doc;
      doc["distance_cm"] = distance;
      doc["waste_percent"] = wastePercent;
      doc["light_level"] = ldrValue;
      doc["light_status"] = (digitalRead(LIGHT_PIN) == HIGH) ? "ON" : "OFF";
      doc["red_led"] = (digitalRead(RED_STATUS_PIN) == HIGH) ? "ON" : "OFF";
      doc["green_led"] = (digitalRead(GREEN_STATUS_PIN) == HIGH) ? "ON" : "OFF";
      doc["is_full"] = isFull;
      doc["full_distance"] = fullDistance;
      doc["bin_height"] = binHeight;
      doc["auto_light_mode"] = autoLightMode ? "ON" : "OFF";
      doc["auto_status_mode"] = autoStatusMode ? "ON" : "OFF";

      char buffer[512];
      serializeJson(doc, buffer);
      client.publish((deviceTopic + "/data").c_str(), buffer);
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

  if (doc.containsKey("reset_wifi")) {
    if (parseBoolOrString(doc["reset_wifi"])) {
      Serial.println("=> WiFi Reset Requested!");
      shouldResetWifi = true;
      return;
    }
  }

  // if (doc.containsKey("full_distance")) {
  //   int newDist = doc["full_distance"].as<int>();
  //   if (newDist > 0 && newDist <= 400) {
  //     fullDistance = newDist;
  //     Serial.println("=> Full Distance set to: " + String(fullDistance) + " cm");
  //   } else {
  //     Serial.println("=> Invalid full_distance value (must be 1-400)");
  //   }
  // }

  if (doc.containsKey("bin_height")) {
    int newHeight = doc["bin_height"].as<int>();
    if (newHeight > 0 && newHeight <= 400) {
      binHeight = newHeight;
      Serial.println("=> Bin Height set to: " + String(binHeight) + " cm");
    } else {
      Serial.println("=> Invalid bin_height value (must be 1-400)");
    }
  }

  if (doc.containsKey("auto_light")) {
    autoLightMode = parseBoolOrString(doc["auto_light"]);
    Serial.println(autoLightMode ? "=> Auto Light Mode: ENABLED" : "=> Auto Light Mode: DISABLED");
  }

  if (doc.containsKey("auto_status")) {
    autoStatusMode = parseBoolOrString(doc["auto_status"]);
    Serial.println(autoStatusMode ? "=> Auto Status Mode: ENABLED" : "=> Auto Status Mode: DISABLED");
  }

  if (doc.containsKey("light")) {
    autoLightMode = false;
    bool isLightOn = parseBoolOrString(doc["light"]);
    digitalWrite(LIGHT_PIN, isLightOn ? HIGH : LOW);
    Serial.println(isLightOn ? "=> Manual Light: ON" : "=> Manual Light: OFF");
  }

  if (doc.containsKey("red")) {
    autoStatusMode = false;
    bool isRedOn = parseBoolOrString(doc["red"]);
    digitalWrite(RED_STATUS_PIN, isRedOn ? HIGH : LOW);
    Serial.println(isRedOn ? "=> Manual Red: ON" : "=> Manual Red: OFF");
  }

  if (doc.containsKey("green")) {
    autoStatusMode = false;
    bool isGreenOn = parseBoolOrString(doc["green"]);
    digitalWrite(GREEN_STATUS_PIN, isGreenOn ? HIGH : LOW);
    Serial.println(isGreenOn ? "=> Manual Green: ON" : "=> Manual Green: OFF");
  }
}
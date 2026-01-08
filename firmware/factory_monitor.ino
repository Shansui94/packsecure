
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h> // Supports HTTPS for Vercel

// --- WIFI CONFIGURATION (Change This) ---
const char *ssid = "NAMA_WIFI_ANDA";
const char *password = "PASSWORD_WIFI_ANDA";

// --- SERVER CONFIGURATION (Choose ONE) ---

// OPTION A: Local PC (Keep PC on)
// const char *serverUrl = "http://192.168.1.228:8080/api/alarm";

// OPTION B: Cloud Vercel (PC can be off)
const char *serverUrl = "https://packsecure.vercel.app/api/alarm";

// --- MACHINE CONFIGURATION ---
const char *machineId = "T1.2-M01"; // Machine ID
const int relayPin = 4;             // GPIO 4 (D4)
const int ledPin = 2;               // Built-in LED (GPIO 2)

// --- VARIABLES ---
int lastState = HIGH; // Relay is Normally Open (NO)
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 10000; // 10 Seconds Cool-down (Anti-rapid fire)

void setup() {
  Serial.begin(115200);

  // Setup Pins
  pinMode(relayPin, INPUT_PULLUP); // Internal Pull-up Resistor
  pinMode(ledPin, OUTPUT);         // Status LED

  // Connect WiFi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(ledPin, !digitalRead(ledPin)); // Blink while connecting
  }
  digitalWrite(ledPin, HIGH); // LED ON when connected
  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  int reading = digitalRead(relayPin);

  // Detect signal change (Active LOW - Relay connects pin to GND)
  if (reading == LOW && lastState == HIGH) {
    if ((millis() - lastDebounceTime) > debounceDelay) {

      // CONFIRMED SIGNAL
      Serial.println("ALARM DETECTED! Sending to server...");

      // Blink LED to indicate signal sent
      digitalWrite(ledPin, LOW);
      delay(100);
      digitalWrite(ledPin, HIGH);

      sendAlarm();

      lastDebounceTime = millis();
    }
  }

  lastState = reading;
}

void sendAlarm() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;

    // Check if using HTTPS (Vercel)
    if (String(serverUrl).startsWith("https")) {
      client.setInsecure(); // Ignore SSL certificate verification (Crucial for
                            // Vercel/Let's Encrypt)
      http.begin(client, serverUrl);
    } else {
      http.begin(serverUrl);
    }

    http.addHeader("Content-Type", "application/json");

    // Format JSON: {"machine_id": "T1.2-M01", "alarm_count": 2}
    String jsonPayload =
        String("{\"machine_id\": \"") + machineId + "\", \"alarm_count\": 2}";

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Server Response: ");
      Serial.println(httpResponseCode);
      Serial.println(response);
    } else {
      Serial.print("Error on sending POST: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi Disconnected");
    // Try to reconnect
    WiFi.reconnect();
  }
}

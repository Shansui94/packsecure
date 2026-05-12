
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Preferences.h> // Flash Storage
#include <Update.h>
#include <WebServer.h>
#include <WiFi.h>

const String CURRENT_VERSION =
    "3.3.0"; // ★ Fix: send 1 pulse per API call (never batch-sum queue)
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h> // Watchdog Timer
#include <time.h>         // Include standard time library
#include <vector>

#define WDT_TIMEOUT 30 // Restart if stuck for 30 seconds

// --- WIFI CONFIGURATION ---
const char *ssid = "ESBL_326";
const char *password = "88888888";

// 2. Vercel API (Dynamic Config)
const String configApiUrl = "https://packsecure.vercel.app/api/iot-config?mac=";

// --- SERVER CONFIGURATION ---
const String alarmApiUrl = "https://packsecure.vercel.app/api/alarm";

// --- MACHINE CONFIGURATION ---
String machineId =
    "PENDING_ASSIGNMENT"; // 初始占位符，通电后会自动改为 N1-M01 或 N2-M02
const int relayPin = 15;  // GPIO 15 (D15)
const int ledPin = 2;

// --- 动态变量 (会从云端同步，不要在这里死改数字) ---
int currentYield =
    1; // 产量系数（默认1）。启动后会自动从云端拉取 (如 33cm x1 会变成 3)
unsigned long debounceDelay =
    240000;                    // 冷却时间。启动后会自动从云端拉取 (如 240000ms)
String currentSku = "UNKNOWN"; // 正在生产的 SKU

// --- 硬件中断信号捕捉 (ISR-safe, volatile) ---
// 用中断代替轮询，确保 HTTP/WiFi 阻塞期间也不会漏信号
volatile bool signalDetected = false;      // ISR 设置，main loop 清除
volatile unsigned long isrTriggerTime = 0; // 信号触发时间 (ms)

// --- 非阻塞状态机参数 ---
enum SignalState { STATE_IDLE, STATE_WAIT_CONFIRM, STATE_WAIT_END };
SignalState currentState = STATE_IDLE;
unsigned long stateTimer = 0;

void IRAM_ATTR BUZZER_ISR() {
  // FALLING edge ISR: 只记录时间,让 main loop 做验证
  // 不改 signalDetected 如果已经有待处理信号 (防止 ISR 内竞争)
  if (!signalDetected && currentState == STATE_IDLE) {
    isrTriggerTime = millis();
    signalDetected = true;
  }
}

int lastState = HIGH;
unsigned long lastDebounceTime = 0;
struct QueueItem {
  int count;
  time_t timestamp;
};
std::vector<QueueItem> alarmQueue;
Preferences preferences;

// NTP 服务器
const char *ntpServer = "pool.ntp.org";

// --- WEB SERVER & OTA ---
WebServer server(80);
const char *otaPath = "/update";
const char *otaUser = "admin";
const char *otaPass = "packsecure";

// 函数声明
void setupOTA();
void performCloudUpdate(String url);
void updateRemoteConfig();
void connectWiFi();
void handleNetworkQueue();
bool sendToSupabase(int count, time_t timestamp);
bool isTimeSet();
String getISOTime(time_t rawtime);
void saveQueue();
void loadQueue();
void handleRoot();
void handleUpdateResponse();
void handleUpdateUpload();

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n--- NILAI PRODUCTION FIRMWARE (OTA READY v3.0) ---");

  pinMode(relayPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);

  // ★ 硬件中断: FALLING edge (继电器闭合 = 警报器响)
  // 优先级高于 loop(), HTTP/WiFi 阻塞也不会漏掉信号
  attachInterrupt(digitalPinToInterrupt(relayPin), BUZZER_ISR, FALLING);
  Serial.println("GPIO 中断已绑定到 pin " + String(relayPin) +
                 " (FALLING edge)");

  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi已连接! MAC: " + WiFi.macAddress());
    setupOTA(); // ★ 启动 OTA 和 Web Server
  } else {
    Serial.println("WiFi连接失败，请检查 SSID/密码 或 2.4G 频段");
  }

  Serial.println("STEP 1: 配置时间 (NTP)...");
  configTime(0, 0, ntpServer);

  Serial.println("STEP 2: 加载离线队列...");
  loadQueue();

  // ★ 启动时立刻拉取一次云端 Yield 设置
  Serial.println("STEP 3: 同步云端配置...");
  updateRemoteConfig();

// Watchdog - 30 seconds
#if ESP_IDF_VERSION_MAJOR >= 5
  esp_task_wdt_config_t wdt_config = {.timeout_ms = WDT_TIMEOUT * 1000,
                                      .idle_core_mask = 0,
                                      .trigger_panic = true};
  esp_task_wdt_reconfigure(&wdt_config);
#else
  esp_task_wdt_init(WDT_TIMEOUT, true);
#endif
  esp_task_wdt_add(NULL);
}

void loop() {
  esp_task_wdt_reset();

  // 处理 OTA 和 Web 请求
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
    ArduinoOTA.handle();
  }

  // 每 60 秒自动同步一次产量
  static unsigned long lastConfigSync = 0;
  if (millis() - lastConfigSync > 60000) {
    updateRemoteConfig();
    lastConfigSync = millis();
  }

  // ══════════════════════════════════════════════════
  // 1. 信号验证 (采用非阻塞状态机)
  // ══════════════════════════════════════════════════
  switch (currentState) {
  case STATE_IDLE:
    if (signalDetected) {
      signalDetected = false;
      currentState = STATE_WAIT_CONFIRM;
      stateTimer = millis();
    }
    break;

  case STATE_WAIT_CONFIRM:
    // 等待 300ms 再验证: 真正的 3 秒警报在 300ms 后 pin 仍为 LOW
    if (millis() - stateTimer >= 300) {
      if (digitalRead(relayPin) == LOW) {
        // ✅ 确认是真实信号 (警报还在响)
        unsigned long now = millis();

        // 修复开机 4.5 分钟冷却期的 Bug：如果是开机后第一次触发 (lastDebounceTime == 0)，直接放行
        if (lastDebounceTime == 0 || (now - lastDebounceTime) > debounceDelay) {
          // ✅ 冷却时间已过
          float elapsed = (float)(now - lastDebounceTime) / 1000.0;
          lastDebounceTime = now;

          Serial.printf("[OK] 有效触发! Yield=%d, SKU=%s, 距上次=%.1fs\n",
                        currentYield, currentSku.c_str(), elapsed);

          // 快速非阻塞的 LED 反馈
          // (主循环的后面心跳会覆盖，此处直接亮起一次代表记录成功)
          digitalWrite(ledPin, LOW);

          time_t t;
          time(&t);
          QueueItem item = {currentYield, t};
          alarmQueue.push_back(item);
          saveQueue();

        } else {
          float cooldownLeft =
              (float)(debounceDelay - (now - lastDebounceTime)) / 1000.0;
          Serial.printf("[SKIP] 冷却中，还需 %.1f 秒\n", cooldownLeft);
        }

        // 进入等待结束状态，防止重复 ISR
        currentState = STATE_WAIT_END;
        stateTimer = millis();
        Serial.println("等待警报器结束...");
      } else {
        // 噪声脉冲，直接忽略恢复空闲
        Serial.println("[NOISE] 300ms 后 pin 恢复 HIGH，判断为噪声，忽略");
        currentState = STATE_IDLE;
      }
    }
    break;

  case STATE_WAIT_END:
    // ★ 等待警报器结束 (pin 恢复 HIGH) 或者超时 (8000ms)
    if (digitalRead(relayPin) == HIGH || (millis() - stateTimer) >= 8000) {
      Serial.println("警报器已结束，恢复监听");
      signalDetected = false; // 清理这期间发生的误触
      currentState = STATE_IDLE;
    }
    break;
  }

  handleNetworkQueue();

  // WiFi 重连逻辑 (简化，交给核心自动处理或手动 connectWiFi)
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastRecon = 0;
    if (millis() - lastRecon >
        30000) { // 增加等待时间到 30 秒，避免干扰内部连接
      lastRecon = millis();
      Serial.println("WiFi断开，尝试恢复...");
      connectWiFi();
    }
  }

  // 心跳 LED
  static unsigned long lastHeart = 0;
  if (millis() - lastHeart > 5000) {
    lastHeart = millis();
    digitalWrite(ledPin, LOW);
    delay(50);
    digitalWrite(ledPin, (WiFi.status() == WL_CONNECTED) ? HIGH : LOW);
  }
}

// 【新增核心函数】：拉取动态产量和 SKU
void updateRemoteConfig() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure(); // 跳过 SSL 验证，确保能连上 Vercel (HTTPS)

    String fullUrl = configApiUrl + WiFi.macAddress();

    if (http.begin(client, fullUrl)) {
      int code = http.GET();
      if (code == 200) {
        String payload = http.getString();
        StaticJsonDocument<512> doc;
        if (!deserializeJson(doc, payload)) {
          currentYield = doc["yield"] | currentYield;
          debounceDelay = doc["debounce"] | debounceDelay;
          currentSku = doc["sku"].as<String>();
          if (doc.containsKey("machine_id")) {
            machineId = doc["machine_id"].as<String>();
          }
          if (doc.containsKey("latest_version") &&
              doc.containsKey("download_url")) {
            String latestVersion = doc["latest_version"].as<String>();
            String downloadUrl = doc["download_url"].as<String>();
            if (latestVersion > CURRENT_VERSION) {
              Serial.println("发现新版本: " + latestVersion +
                             "，准备远程升级...");
              performCloudUpdate(downloadUrl);
            }
          }
          Serial.printf("Remote Sync Success: SKU=%s, Yield=%d, Machine=%s\n",
                        currentSku.c_str(), currentYield, machineId.c_str());
        }
      } else {
        Serial.printf("Remote Sync Failed: HTTP Code %d\n", code);
      }
      http.end();
    } else {
      Serial.println("Remote Sync Failed: 无法连接 API 地址 (HTTPS)");
    }
  } else {
    Serial.println("Remote Sync Skipped: WiFi 未连接，无法同步参数");
  }
}

void saveQueue() {
  preferences.begin("fv_store", false);
  int size = alarmQueue.size();
  preferences.putInt("size", size);
  for (int i = 0; i < size; i++) {
    String key = "i" + String(i);
    preferences.putBytes(key.c_str(), &alarmQueue[i], sizeof(QueueItem));
  }
  preferences.end();
}

void loadQueue() {
  preferences.begin("fv_store", true);
  int size = preferences.getInt("size", 0);
  if (size > 0) {
    alarmQueue.clear();
    for (int i = 0; i < size; i++) {
      String key = "i" + String(i);
      QueueItem item;
      if (preferences.getBytes(key.c_str(), &item, sizeof(QueueItem)) ==
          sizeof(QueueItem)) {
        alarmQueue.push_back(item);
      }
    }
  }
  preferences.end();
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED)
    return;
    
  // 最底层的强制初始化，解决 Core 3.0+ 版本的 WiFi 死锁 Bug
  WiFi.disconnect(true, true); 
  delay(500);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  delay(100);

  Serial.printf("\n正在连接 WiFi: %s\n", ssid);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    esp_task_wdt_reset(); // 喂狗防止重启
    Serial.print(".");
    attempts++;
  }
  
  Serial.println();
  if(WiFi.status() == WL_CONNECTED) {
      Serial.println("✅ WiFi 连接成功！");
  } else {
      Serial.printf("❌ WiFi 连接失败！错误代码 (WiFi Status): %d\n", WiFi.status());
      Serial.println("代码含义: 1=搜不到信号, 4=密码错误/被拉黑, 6=意外断开");
  }
}

void handleNetworkQueue() {
  if (alarmQueue.empty() || WiFi.status() != WL_CONNECTED)
    return;
  static unsigned long lastUp = 0;
  if (millis() - lastUp < 3000) // 3s interval to avoid Vercel rate limits
    return;

  lastUp = millis();

  // ★ FIX: Send ONE pulse at a time (not the sum of all queued pulses).
  // Previously this summed the whole queue and sent totalCount (e.g. 2, 3…),
  // which inflated alarm_count in the API. Now each pulse is always sent as
  // count=1 — the API/DB determines the actual product yield from config.
  QueueItem item = alarmQueue.front();
  time_t timestamp = item.timestamp;

  Serial.printf("Sending 1 pulse to Supabase (queue size=%d)...\n",
                (int)alarmQueue.size());

  if (sendToSupabase(1, timestamp)) {
    // Only remove the front item if the API call succeeded
    alarmQueue.erase(alarmQueue.begin());
    saveQueue();
    Serial.printf("Send SUCCESS! %d pulse(s) remaining in queue.\n",
                  (int)alarmQueue.size());
  } else {
    Serial.println("Send FAILED. Retrying next cycle.");
  }
}

bool sendToSupabase(int count, time_t timestamp) {
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  if (!http.begin(client, alarmApiUrl)) {
    Serial.println("HTTP Begin failed.");
    return false;
  }

  http.setTimeout(10000); // 10s timeout to survive Vercel Cold Starts
  http.addHeader("Content-Type", "application/json");

  String json = "{\"machine_id\": \"" + String(machineId) +
                "\", \"alarm_count\": " + String(count) + "}";

  int res = http.POST(json);
  http.end();

  Serial.printf("API Response Code: %d\n", res);

  // STRICT CHECK: Only consider it delivered if Vercel says 200 OK.
  // Previously, 4xx errors were considered "delivered" and deleted, causing
  // data loss!
  if (res == 200) {
    return true;
  }
  return false;
}

// --- OTA 逻辑实现 ---
void setupOTA() {
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  String hostName = "nilai-" + mac;

  if (MDNS.begin(hostName.c_str())) {
    Serial.println("mDNS 响应已启动: http://" + hostName + ".local");
  }

  // Web Server 路由
  server.on("/", HTTP_GET, handleRoot);
  server.on(
      otaPath, HTTP_POST, []() { handleUpdateResponse(); },
      []() { handleUpdateUpload(); });

  server.begin();
  Serial.println("Web Server 升级入口已启动: http://" +
                 WiFi.localIP().toString() + otaPath);

  // Arduino IDE OTA
  ArduinoOTA.setHostname(hostName.c_str());
  ArduinoOTA.setPassword("packsecure");
  ArduinoOTA.begin();
}

void handleRoot() {
  String html = "<html><head><title>Nilai OTA</title></head><body>";
  html += "<h1>Nilai Sensor Maintenance</h1>";
  html += "<p>MAC: " + WiFi.macAddress() + "</p>";
  html += "<p>Vercel API: <a href='" + configApiUrl + WiFi.macAddress() + "'>" +
          configApiUrl + "</a></p>";
  html += "<hr><h3>Firmware Update</h3>";
  html += "<form method='POST' action='" + String(otaPath) +
          "' enctype='multipart/form-data'>";
  html += "<input type='file' name='update'><input type='submit' value='Update "
          "Now'>";
  html += "</form></body></html>";
  server.send(200, "text/html", html);
}

void handleUpdateResponse() {
  server.sendHeader("Connection", "close");
  server.send(200, "text/plain",
              (Update.hasError()) ? "FAIL" : "OK. REBOOTING...");
  delay(1000);
  ESP.restart();
}

void handleUpdateUpload() {
  HTTPUpload &upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    Serial.printf("Update Start: %s\n", upload.filename.c_str());
    if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
      Update.printError(Serial);
    }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
      Update.printError(Serial);
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (Update.end(true)) {
      Serial.printf("Update Success: %u bytes\nRebooting...\n",
                    upload.totalSize);
    } else {
      Update.printError(Serial);
    }
  }
}

void performCloudUpdate(String url) {
  WiFiClientSecure client;
  client.setInsecure();

  Serial.println("正在从外部地址下载固件: " + url);

  // 临时取消关注 WDT，防止升级过程中触发重启
  // 使用 NULL 检查确保不会因为重复操作报错
  esp_task_wdt_delete(NULL);

  t_httpUpdate_return ret = httpUpdate.update(client, url);

  // 无论升级结果如何，重新加回 WDT
  esp_task_wdt_add(NULL);

  switch (ret) {
  case HTTP_UPDATE_FAILED:
    Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n",
                  httpUpdate.getLastError(),
                  httpUpdate.getLastErrorString().c_str());
    break;
  case HTTP_UPDATE_NO_UPDATES:
    Serial.println("HTTP_UPDATE_NO_UPDATES");
    break;
  case HTTP_UPDATE_OK:
    Serial.println("HTTP_UPDATE_OK - 重启中...");
    ESP.restart();
    break;
  }
}

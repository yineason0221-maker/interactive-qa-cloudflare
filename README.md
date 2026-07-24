# 神秘互動問答網站 (Interactive Q&A & Story Application)

這是一個以**極簡黑底白字風格**打造的沉浸式互動問答網站，專為與朋友分享、收集真心地話與創造驚喜而設計。這個 Cloudflare 版本會把資料存到 D1，媒體檔案則改用外部網址或部署前放進 `frontend/public/uploads/`，因此不需要 R2。

---

## 🌟 核心特色與功能

1. **黑底白字放大風格 & 強制全螢幕體驗**：
   - 簡約大字視覺，專注於問答與敘事體驗。
   - 支援一鍵進入全螢幕模式，提供極致沉浸感。

2. **隱藏管理員模式 (Hidden Admin Mode)**：
   - **隱藏入口**：不顯示任何管理員按鈕，透過快捷鍵 `Ctrl + Shift + A` (或 `Cmd + Shift + A`)，或連續點擊畫面左上角 5 次觸發。
   - **預設密碼**：`admin` (登入後可隨時於後台修改密碼)。
   - **使用者數據統計**：
     - **停留總時間 (Time Spent)**：精確計算每位受訪者作答所花費的秒數與分鐘。
     - **每題回答內容**：清楚列出該受訪者的文字填空、選擇題選項或評分數值。
     - **行為軌跡 (Event Logs)**：記錄全螢幕切換、進入/完成關卡時間等。
     - **一鍵清空紀錄**：提供管理員一鍵清空所有使用者回答與日誌（附二次確認）。

3. **靈活流程與內容編輯器 (Flow & Content Editor)**：
   - **字幕與問題分離**：字幕可單獨設定顯示文字、持續時間、淡入與淡出時間。
   - **特效關卡 (Effects)**：內建多款獨立特效，可隨意插入流程中：
     - 絢麗煙火 (Fireworks)
     - 電視故障雜訊 (Glitch)
     - 駭客代碼雨 (Matrix Rain)
     - 畫面震撼抖動 (Screen Shake)
     - 閃光頻閃 (Flash)
   - **影片關卡 (Video)**：可在任意階段插入 MP4 影片播映。
   - **背景音樂 (BGM)**：支援 MP3 網址播放，或部署前放進 `frontend/public/uploads/` 後用靜態路徑播放。
   - **順序調整**：自由上下移動問題與關卡，即時儲存生效。

---

## 📁 專案結構

```
interactive-qa-app/
├── backend/                  # 舊版 Node.js + Express 後端參考實作
│   ├── database.js           # SQLite 資料庫初始化與資料表設計
│   ├── database.sqlite       # 資料庫檔案 (自動生成)
│   ├── middleware/
│   │   └── auth.js           # JWT 管理員驗證 Middleware
│   ├── routes/
│   │   ├── auth.js           # 登入與密碼修改 API
│   │   ├── flow.js           # 關卡流程與問題 CRUD API
│   │   ├── responses.js      # 使用者回答、停留時間與數據分析 API
│   │   └── upload.js         # MP3 / MP4 媒體檔案上傳 API
│   ├── uploads/              # 媒體檔案儲存目錄
│   └── server.js             # Express 伺服器主入口
│
├── frontend/                 # React + Vite + Tailwind CSS 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminAnalytics.jsx   # 數據與停留時間統計面板
│   │   │   ├── AdminFlowEditor.jsx  # 關卡與問題內容編輯器
│   │   │   ├── AdminModal.jsx       # 隱藏管理員彈窗
│   │   │   ├── AdminSettings.jsx    # 密碼修改與全域設定
│   │   │   ├── AudioPlayer.jsx      # 背景音樂播放控制器
│   │   │   ├── EffectsCanvas.jsx    # Canvas 特效 (煙火/Glitch/Matrix)
│   │   │   └── PlayerView.jsx       # 前端問答與沉浸體驗引擎
│   │   ├── App.jsx                  # 前端主入口與快捷鍵監聽
│   │   ├── index.css                # Tailwind 與自訂動畫樣式
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── src/
│   └── worker.js             # Cloudflare Worker API / D1 入口
├── wrangler.jsonc            # Cloudflare 部署設定
└── DEPLOYMENT_GUIDE.md        # 詳細雲端部署與網址設定教學手冊
```

---

## 🚀 本地開發與運行步驟

這個副本建議從根目錄直接啟動 Cloudflare 模擬環境：

```bash
npm install
npm run dev
```

Cloudflare 的 Worker 模擬器會同時提供前端靜態站台與 API 路由。

---

## 🔑 管理員登入與操作說明

1. 在體驗網頁中按下快捷鍵 `Ctrl + Shift + A` (Mac 使用者為 `Cmd + Shift + A`)。
2. 輸入預設密碼 `admin` 即可解鎖管理員後台。
3. 可點選上方頁籤切換：
   - **回答與停留時間紀錄**：檢視所有受訪者停留秒數與每一題的答題細節，亦可點擊「一鍵清空所有紀錄」。
   - **流程與問題內容編輯器**：輕鬆新增、編輯、刪除字幕與問題，調整關卡順序。
   - **密碼與系統設定**：修改預設密碼、設定背景音樂或影片網址。

---

## 🌐 雲端公開部署教學

這個副本的建議部署平台是 **Cloudflare Workers + D1 + 靜態資源**。

- 不需要維持一台長開的 Node 主機。
- 靜態前端與 API 可以在同一個專案內完成。
- 不需要開 R2，也能維持零成本路線。
- 媒體檔案可以改用外部網址，或放進 `frontend/public/uploads/` 重新部署。
- 很適合你這種有管理後台、問答紀錄與媒體連結的互動網站。

詳細操作步驟請參閱專案目錄下的 [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)。

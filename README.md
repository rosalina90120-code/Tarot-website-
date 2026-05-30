# 🔮 神秘塔羅占卜 & Gemini API 健檢工具 (Tarot Reader with Google Gemini)

這是一個結合了傳統塔羅牌陣與 **Google Gemini AI** 的網頁應用程式。透過精美的視覺特效與 AI 大語言模型，為使用者提供沉浸式的占卜體驗，並能針對抽出的牌陣給出客製化、具體且溫暖的解讀。

專案內同時附帶一個 **Gemini API 模型探測器**，方便開發者快速檢查自己的 API Key 狀態與可用模型。

## ✨ 專案亮點與功能

* **🃏 豐富的專業牌陣：** 內建「每日一占」、「經典時間」、「戀愛十字」、「塞爾特十字」等多達十幾種實用牌陣。
* **🤖 AI 輔助提問 (大師幫你問)：** 當使用者不知道如何精準提問時，AI 能協助梳理思緒，濃縮出最適合占卜的具體問題。
* **🧠 深度綜合解讀：** AI 扮演溫暖直白的命理導師，根據問題、牌陣位置、正逆位涵義，給出結合情境的專業分析與破局建議。
* **🌌 視覺特效：** 包含滿版星空背景畫布、浪漫流星動畫、毛玻璃 UI 質感與流暢的卡牌翻轉特效。
* **🛠️ API 健檢工具：** 透過 `debug.html`，輸入 API Key 即可快速探測金鑰是否有效，並列出支援 `generateContent` 的模型清單。

---

## 🚀 如何在本地端執行

這是一個純前端 (HTML/CSS/JS) 的專案，無需安裝任何後端環境或資料庫，只需瀏覽器即可運行。

### 步驟 1：取得專案
將此專案 Clone 到本地端，或直接下載 ZIP 壓縮檔並解壓縮。
> `git clone https://github.com/你的帳號/tarot.git`

### 步驟 2：申請 Google Gemini API Key
前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 申請一組免費的 API Key。

### 步驟 3：設定 API Key
1. 使用文字編輯器（如 VS Code 或記事本）打開 `index.html`。
2. 找到程式碼約 382 行處的 `GEMINI_API_KEY` 變數。
3. 將你的金鑰填入（請保留雙引號）：
> `const GEMINI_API_KEY = "在這裡填入你的_AIzaSy..._金鑰";`

### 步驟 4：開始占卜
直接對著 `index.html` 點擊右鍵，選擇在瀏覽器（Chrome, Edge, Safari 等）中開啟，即可開始使用！

---

## ⚠️ 安全性警告 (Security Warning)

**強烈建議：絕對不要將寫有真實 API Key 的 `index.html` 上傳公開到 GitHub！**

目前專案架構為前端直接呼叫 Google API。若作為公開的開源專案展示，請務必在 `git commit` 上傳前，將 `GEMINI_API_KEY` 的值清空或替換為假字串（例如 `"YOUR_API_KEY_HERE"`）。否則網路爬蟲能在幾秒鐘內竊取你的金鑰，並大量消耗你的配額！

*(未來升級方向建議：建立 Node.js 或 Python 後端伺服器，將 API Key 儲存於環境變數 `.env` 中，由後端代理發送請求以徹底保護金鑰安全。)*

---

## 📁 檔案結構

* **`index.html`**：塔羅占卜主程式（包含所有 UI、CSS、與 Gemini API 串接的邏輯）。
* **`debug.html`**：Gemini API 狀態與模型檢測工具。
* **`images/`**：存放 78 張塔羅牌正背面圖檔的資料夾。
* **`README.md`**：專案說明文件。
// 後端代理伺服器：把 Gemini API 金鑰留在伺服器端，前端只呼叫 /api/gemini/*。
// 占卜紀錄也存在這裡（data/history.json），讓紀錄不再只活在某一台裝置的瀏覽器 localStorage 裡。
require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
    parseHistory, createReadingRecord, addReadingToHistory,
    removeReadingFromHistory, addFollowUpToRecord, fallbackModels,
} = require("./tarot-logic.js");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_PASSPHRASE = process.env.OWNER_PASSPHRASE || "";
const GUEST_PASSPHRASE = process.env.GUEST_PASSPHRASE || "";
const DAILY_SHARED_KEY_LIMIT = Number(process.env.DAILY_SHARED_KEY_LIMIT) || 150;
const HISTORY_FILE = path.join(__dirname, "data", "history.json");
const SESSION_COOKIE = "tarot_session";

if (!GEMINI_API_KEY) {
    console.warn("⚠️  尚未設定 GEMINI_API_KEY（請在 .env 設定），AI 相關功能會失敗。");
}
if (!OWNER_PASSPHRASE) {
    console.warn("⚠️  尚未設定 OWNER_PASSPHRASE，擁有者解鎖功能會失敗。");
}
if (!GUEST_PASSPHRASE) {
    console.warn("⚠️  尚未設定 GUEST_PASSPHRASE，除了擁有者跟自帶金鑰的人，其他人都無法使用 AI 功能（這是預設安全行為，不是錯誤）。");
}

// 擁有者/邀請碼密碼故意不發 cookie：前端只把密碼存在記憶體變數裡，每次打 /api/gemini/* 都用 header 帶著證明身份。
// 這樣重新整理頁面（記憶體變數被清空）就會回到「沒解鎖」狀態，不會被 cookie 悄悄記住。
function isOwner(req) {
    return Boolean(OWNER_PASSPHRASE) && req.headers["x-owner-passphrase"] === OWNER_PASSPHRASE;
}

// 「邀請碼」：擁有者另外給朋友的一組密碼，跟上面的擁有者密碼是兩組不同的碼。
// 目的是擋掉「網址被不認識的人拿到」的情況——沒有這組碼，連共用金鑰的 AI 功能都打不開。
function hasGuestAccess(req) {
    return Boolean(GUEST_PASSPHRASE) && req.headers["x-guest-passphrase"] === GUEST_PASSPHRASE;
}

// 每日總額：不管多少人、不管每個人打多快，共用金鑰一天加起來最多只能打這麼多次 Gemini。
// 故意只放記憶體（重啟就重置），這是保護「總成本」的最後一道防線，跟下面單人流量限制是兩件事。
let dailyUsage = { date: "", count: 0 };
function todayString() {
    return new Date().toISOString().slice(0, 10);
}
function tryConsumeDailyQuota() {
    const today = todayString();
    if (dailyUsage.date !== today) dailyUsage = { date: today, count: 0 };
    if (dailyUsage.count >= DAILY_SHARED_KEY_LIMIT) return false;
    dailyUsage.count += 1;
    return true;
}

// 「自帶 API Key」：誰想用自己的金鑰、不要佔用網站擁有者的額度，就存在這裡。
// 故意只放記憶體（不寫進任何檔案、不寫進 log），重啟伺服器就會全部消失。
const ownKeys = new Map(); // sessionId -> apiKey

function ensureSession(req, res, next) {
    let sid = req.cookies && req.cookies[SESSION_COOKIE];
    if (!sid) {
        sid = crypto.randomBytes(24).toString("hex");
        res.cookie(SESSION_COOKIE, sid, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 90 * 24 * 60 * 60 * 1000,
        });
    }
    req.sessionId = sid;
    next();
}

function hasOwnKey(req) {
    return Boolean(req.sessionId) && ownKeys.has(req.sessionId);
}

function apiKeyFor(req) {
    return (req.sessionId && ownKeys.get(req.sessionId)) || GEMINI_API_KEY;
}

function readHistory() {
    try {
        return parseHistory(fs.readFileSync(HISTORY_FILE, "utf-8"));
    } catch (err) {
        return [];
    }
}

function writeHistory(history) {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(ensureSession);

// express.static(__dirname) 會把整個專案資料夾當網站送出去，data/history.json、server.js、package.json
// 這些原本只想留在伺服器端的東西，全部都會被當成「靜態檔案」直接下載——跟上面所有密碼/邀請碼機制完全無關。
// 在 static 中介層之前先擋掉這些路徑，只放行前端真的需要的檔案 (index.html / tarot-logic.js / images/ / debug.html)。
const BLOCKED_STATIC_PATHS = /^\/(data\/|tests\/|server\.js|package(-lock)?\.json|skills-lock\.json|文字檔\.txt)/;
app.use((req, res, next) => {
    if (BLOCKED_STATIC_PATHS.test(req.path)) return res.status(404).end();
    next();
});
app.use(express.static(__dirname));

// 防止有人繞過網站介面、直接打 /api/gemini/* 把金鑰額度燒光：限流 + model 白名單。
// 本機（localhost）測試、帶著擁有者通行密碼換來的 cookie、或正在用自己金鑰的人，都不計入限制。
function isLocalRequest(req) {
    return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip);
}

const geminiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isLocalRequest(req) || isOwner(req) || hasOwnKey(req),
    handler: (req, res) => {
        console.log(`[ratelimit] 擋下 ${req.method} ${req.path} ip=${req.ip}`);
        res.status(429).json({ error: "rate_limited", message: "問太快了，請稍後再試。" });
    },
});

function requireKnownModel(req, res, next) {
    if (!fallbackModels.includes(req.params.model)) {
        return res.status(400).json({ error: "unknown_model" });
    }
    next();
}

// 「猜密碼」限流：擋暴力猜 OWNER_PASSPHRASE/GUEST_PASSPHRASE。沒有這道之前，連續猜幾百次完全不會被擋。
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isLocalRequest(req),
    handler: (req, res) => {
        console.log(`[ratelimit] 擋下猜密碼 ${req.method} ${req.path} ip=${req.ip}`);
        res.status(429).json({ error: "rate_limited", message: "嘗試太多次了，請稍後再試。" });
    },
});

// 進站關卡：擁有者、自帶金鑰的人，或輸入過邀請碼的人才能用 AI 功能；其他人直接擋掉，不浪費任何一次 Gemini 呼叫。
function requireAccess(req, res, next) {
    if (isOwner(req) || hasOwnKey(req) || hasGuestAccess(req)) return next();
    return res.status(403).json({ error: "access_denied", message: "請先輸入邀請碼才能使用大師的 AI 功能。" });
}

// 每日總額關卡：擁有者跟自帶金鑰的人不計算在內（自帶金鑰本來就不吃共用額度）。
function enforceDailyQuota(req, res, next) {
    if (isOwner(req) || hasOwnKey(req)) return next();
    if (!tryConsumeDailyQuota()) {
        return res.status(429).json({ error: "daily_limit_reached", message: "今天的共用占卜額度已經用完了，明天再來，或是使用你自己的 Gemini Key 🔑。" });
    }
    next();
}

// 這兩個端點只負責「驗證密碼對不對」，故意不發 cookie——對不對都交給前端記在記憶體變數裡，重新整理就消失。
app.post("/api/auth/unlock", authLimiter, (req, res) => {
    const { passphrase } = req.body || {};
    if (!OWNER_PASSPHRASE || passphrase !== OWNER_PASSPHRASE) {
        return res.status(401).json({ error: "wrong_passphrase" });
    }
    res.json({ ok: true });
});

app.post("/api/auth/guest-unlock", authLimiter, (req, res) => {
    const { passphrase } = req.body || {};
    if (!GUEST_PASSPHRASE || passphrase !== GUEST_PASSPHRASE) {
        return res.status(401).json({ error: "wrong_passphrase" });
    }
    res.json({ ok: true });
});

app.get("/api/auth/status", (req, res) => {
    res.json({ usingOwnKey: hasOwnKey(req) });
});

app.post("/api/auth/use-own-key", async (req, res) => {
    const apiKey = (req.body && req.body.apiKey || "").trim();
    if (!apiKey) {
        return res.status(400).json({ error: "missing_api_key" });
    }
    try {
        // 只打輕量的 models 清單 API 驗證金鑰有效，不會消耗生成額度。
        const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!testRes.ok) {
            return res.status(401).json({ error: "invalid_api_key" });
        }
    } catch (err) {
        return res.status(502).json({ error: "validation_failed" });
    }
    ownKeys.set(req.sessionId, apiKey);
    res.json({ ok: true });
});

app.post("/api/auth/clear-own-key", (req, res) => {
    ownKeys.delete(req.sessionId);
    res.json({ ok: true });
});

// 占卜紀錄是個人問題內容，跟 AI 功能用同一道關卡：擁有者/自帶金鑰/邀請碼三選一，沒驗證過不能看、不能改、不能刪。
app.get("/api/history", requireAccess, (req, res) => {
    res.json(readHistory());
});

app.post("/api/history", requireAccess, (req, res) => {
    const record = createReadingRecord(req.body);
    writeHistory(addReadingToHistory(readHistory(), record));
    res.json(record);
});

app.post("/api/history/:id/followups", requireAccess, (req, res) => {
    writeHistory(addFollowUpToRecord(readHistory(), req.params.id, req.body));
    res.json({ ok: true });
});

app.delete("/api/history/:id", requireAccess, (req, res) => {
    writeHistory(removeReadingFromHistory(readHistory(), req.params.id));
    res.json({ ok: true });
});

app.delete("/api/history", requireAccess, (req, res) => {
    writeHistory([]);
    res.json({ ok: true });
});

app.post("/api/gemini/generate/:model", requireAccess, geminiLimiter, requireKnownModel, enforceDailyQuota, async (req, res) => {
    try {
        const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${req.params.model}:generateContent?key=${apiKeyFor(req)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(req.body),
            }
        );
        const text = await upstream.text();
        res.status(upstream.status).type("application/json").send(text);
    } catch (err) {
        res.status(502).json({ error: "upstream_error", message: err.message });
    }
});

app.post("/api/gemini/stream/:model", requireAccess, geminiLimiter, requireKnownModel, enforceDailyQuota, async (req, res) => {
    try {
        const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${req.params.model}:streamGenerateContent?alt=sse&key=${apiKeyFor(req)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(req.body),
            }
        );
        res.status(upstream.status);
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream");

        if (!upstream.ok || !upstream.body) {
            // 把 Google 真正的錯誤內容轉發回去，方便瀏覽器 Network 分頁直接看到原因（429/503/...），不再是空白回應。
            const errText = await upstream.text().catch(() => "");
            res.end(errText);
            return;
        }

        const reader = upstream.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
    } catch (err) {
        res.status(502).end();
    }
});

app.listen(PORT, () => {
    console.log(`🔮 塔羅占卜伺服器啟動於 http://localhost:${PORT}`);
});

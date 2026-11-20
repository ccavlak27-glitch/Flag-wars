import express from "express";
import { createClient } from "@supabase/supabase-js";
import { WebcastPushConnection } from "tiktok-live-connector/legacy";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIKTOK_USERNAME = (process.env.TIKTOK_USERNAME || "").replace(/^@/, "").trim();
const TIKTOK_COUNTRY_CODE = (process.env.TIKTOK_COUNTRY_CODE || "TR").trim().toUpperCase();

let supabase = null;
let tiktokConnection = null;
let tiktokStatus = "not_configured";
let lastGiftAt = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
} else {
  console.error("Eksik ortam değişkenleri: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
}

async function addPoints(countryCode, points) {
  if (!supabase) throw new Error("Supabase bağlantısı yapılandırılmamış.");
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Geçersiz ülke kodu.");
  if (!Number.isSafeInteger(points) || points <= 0) throw new Error("Geçersiz puan miktarı.");

  const { error } = await supabase.rpc("add_country_points", {
    p_country_code: countryCode,
    p_points: points
  });

  if (error) throw error;
}

async function handleGift(data) {
  // Seri hediyeler yalnızca serinin son etkinliğinde sayılır.
  if (Number(data.giftType) === 1 && data.repeatEnd !== true) return;

  const coinValue = Number(data.diamondCount || 0);
  const repeatCount = Number(data.repeatCount || 1);
  const points = coinValue * repeatCount;

  if (!Number.isSafeInteger(points) || points <= 0) return;

  try {
    await addPoints(TIKTOK_COUNTRY_CODE, points);
    lastGiftAt = new Date().toISOString();
    console.log(
      JSON.stringify({
        event: "gift_counted",
        gift: data.giftName || "Unknown gift",
        coins: points,
        country: TIKTOK_COUNTRY_CODE,
        at: lastGiftAt
      })
    );
  } catch (error) {
    console.error("Hediye puanı kaydedilemedi:", error.message);
  }
}

async function startTikTok() {
  if (!TIKTOK_USERNAME) {
    tiktokStatus = "not_configured";
    console.warn("TIKTOK_USERNAME tanımlı değil; TikTok bağlantısı başlatılmadı.");
    return;
  }

  if (!supabase) {
    tiktokStatus = "supabase_error";
    return;
  }

  try {
    tiktokStatus = "connecting";
    tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME);
    tiktokConnection.on("gift", handleGift);
    tiktokConnection.on("connected", () => {
      tiktokStatus = "connected";
      console.log("TikTok LIVE bağlantısı başarılı.");
    });
    tiktokConnection.on("disconnected", () => {
      tiktokStatus = "disconnected";
      console.warn("TikTok LIVE bağlantısı kesildi.");
    });

    await tiktokConnection.connect();
  } catch (error) {
    tiktokStatus = "error";
    console.error("TikTok bağlantı hatası:", error.message);
  }
}

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "FLAG WARS",
    status: "online",
    version: "2.1.0"
  });
});

app.get("/health", (_req, res) => {
  const healthy = Boolean(supabase);
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    tiktok: tiktokStatus,
    country: TIKTOK_COUNTRY_CODE,
    lastGiftAt
  });
});

app.listen(PORT, () => {
  console.log(`FLAG WARS sunucusu ${PORT} portunda başladı.`);
  void startTikTok();
});

process.on("SIGTERM", async () => {
  try {
    if (tiktokConnection?.disconnect) await tiktokConnection.disconnect();
  } catch (error) {
    console.error("TikTok kapatma hatası:", error.message);
  }
  process.exit(0);
});

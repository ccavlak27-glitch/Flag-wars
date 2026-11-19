
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;

let connection;

async function addPoints(countryCode, points) {
  const { error } = await supabase.rpc("add_country_points", {
    p_country_code: countryCode,
    p_points: points
  });

  if (error) console.error("Puan hatası:", error.message);
}

async function startTikTok() {
  connection = new WebcastPushConnection(TIKTOK_USERNAME);

  connection.on("gift", async (data) => {
    if (data.giftType === 1 && !data.repeatEnd) return;

    const countryCode = "TR";
    const coins = Number(data.diamondCount || 0);
    const multiplier = Number(data.repeatCount || 1);
    const points = coins * multiplier;

    if (points > 0) {
      await addPoints(countryCode, points);
      console.log("Hediye:", data.giftName, "Puan:", points);
    }
  });

  connection.on("connected", () => {
    console.log("TikTok bağlantısı başarılı!");
  });

  connection.on("disconnected", () => {
    console.log("TikTok bağlantısı kesildi.");
  });

  try {
    await connection.connect();
  } catch (error) {
    console.error("TikTok bağlantı hatası:", error.message);
  }
}

app.get("/", (req, res) => {
  res.send("FLAG WARS SERVER ACTIVE");
});

app.listen(PORT, () => {
  console.log("FLAG WARS sunucusu başladı:", PORT);
  startTikTok();
});

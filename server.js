const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_PENDING = process.env.WEBHOOK_PENDING ||
  "https://discord.com/api/webhooks/1498251758235816090/3IhsVkWJQuRY8ET6g32XaUQ1J3hmOEHJoKS0bR9gBoG0aZlChfyzOPGtT5bW5ySUjd2v";

const WEBHOOK_BUKTI = process.env.WEBHOOK_BUKTI ||
  "https://discord.com/api/webhooks/1498252054320119828/xNlRCLGki_3zW73pNdzAC2_XVIA-ROutynT4Hp13d6_fvRFU0D5lMcP9aMzoSIECwqI0";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://haveneleven.my.id";

app.use(express.json({ limit: "20mb" }));
app.use(cors({ origin: ALLOWED_ORIGIN }));

app.get("/", (req, res) => {
  res.json({ status: "Haven Topup Backend aktif ✅", endpoints: ["/webhook/pending", "/webhook/bukti"] });
});

app.post("/webhook/pending", async (req, res) => {
  const { username, communityStatus, items, totalRobux, totalPrice } = req.body;

  if (!username || !items || !totalPrice) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const itemsList = items.map(item =>
    `> ⏣ **${item.label}** — ${Number(item.amount).toLocaleString("id-ID")} Robux x${item.qty} = Rp ${(item.price * item.qty).toLocaleString("id-ID")}`
  ).join("\n");

  const commText = communityStatus === true
    ? "✅ Sudah Bergabung (14 hari)"
    : communityStatus === false
    ? "❌ Belum Bergabung"
    : "❓ Tidak Diketahui";

  const embed = {
    username: "Haven Topup — Order",
    content: "@here 🔔 **Ada pesanan masuk! Tunggu konfirmasi pembayaran.**",
    embeds: [{
      title: "🛒 PESANAN BARU — HAVEN TOPUP",
      color: 0xC4A07A,
      description: "Pesanan baru masuk. Tunggu buyer kirim bukti pembayaran.",
      fields: [
        { name: "👤 Username Roblox", value: `\`${username}\``, inline: true },
        { name: "🎮 Status Grup Roblox", value: commText, inline: true },
        { name: "\u200B", value: "\u200B", inline: false },
        { name: "📦 Detail Pesanan", value: itemsList || "—", inline: false },
        { name: "⏣ Total Robux", value: `**${Number(totalRobux).toLocaleString("id-ID")} Robux**`, inline: true },
        { name: "💰 Total Harga", value: `**Rp ${Number(totalPrice).toLocaleString("id-ID")}**`, inline: true },
        { name: "📊 Status", value: "🟡 **MENUNGGU PEMBAYARAN**", inline: false },
      ],
      footer: { text: "Haven Topup System • Pantau pembayaran masuk" },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const r = await fetch(WEBHOOK_PENDING, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embed),
    });
    if (!r.ok) throw new Error(await r.text());
    res.json({ success: true, type: "pending" });
  } catch (err) {
    console.error("❌ Webhook pending error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── ENDPOINT 2: Bukti transaksi ───────────────────────
// Dipanggil dari payment.js saat buyer upload foto bukti
app.post("/webhook/bukti", async (req, res) => {
  const { amount, amountText, merchant, imageBase64, imageName, imageType } = req.body;

  if (!amount || !imageBase64) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  try {
    // Konversi base64 ke Buffer untuk dikirim sebagai file ke Discord
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const ext = (imageName || "bukti.jpg").split(".").pop();
    const fileName = `bukti-${Date.now()}.${ext}`;

    // Kirim gambar dulu ke Discord sebagai attachment
    const formData = new FormData();
    formData.append("file", imageBuffer, {
      filename: fileName,
      contentType: imageType || "image/jpeg",
    });

    // Buat payload embed sekalian dengan gambar
    const embedPayload = {
      content: `@here 💸 **BUKTI PEMBAYARAN MASUK** | Rp ${Number(amount).toLocaleString("id-ID")}`,
      embeds: [{
        title: "💸 BUKTI TRANSAKSI — HAVEN TOPUP",
        color: 0x57F287,
        description: "Buyer mengklaim telah melakukan pembayaran. Segera verifikasi.",
        fields: [
          { name: "💰 Nominal", value: `**${amountText || `Rp ${Number(amount).toLocaleString("id-ID")}`}**`, inline: true },
          { name: "🏪 Merchant", value: merchant || "Haven Topup", inline: true },
          { name: "📊 Status", value: "🟢 **MENUNGGU VERIFIKASI ADMIN**", inline: false },
        ],
        image: { url: `attachment://${fileName}` },
        footer: { text: "Haven Topup System • Verifikasi lalu kirim Robux" },
        timestamp: new Date().toISOString(),
      }],
    };

    formData.append("payload_json", JSON.stringify(embedPayload));

    const r = await fetch(WEBHOOK_BUKTI, {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    if (!r.ok) throw new Error(await r.text());
    res.json({ success: true, type: "bukti" });

  } catch (err) {
    console.error("❌ Webhook bukti error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Haven Topup Backend berjalan di port ${PORT}`);
  console.log(`   Pending webhook: ${WEBHOOK_PENDING.slice(0, 60)}...`);
  console.log(`   Bukti webhook:   ${WEBHOOK_BUKTI.slice(0, 60)}...`);
});

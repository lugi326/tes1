const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

let qrCode = null;

async function connectWhatsapp(db) {
  const auth = await useMultiFileAuthState("sessionDir");
  const socket = makeWASocket({
    printQRInTerminal: false,
    browser: ["DAPABOT", "", ""],
    auth: auth.state,
    logger: pino({ level: "silent" }),
    msgRetryCounterMap: {}
  });

  socket.ev.on("creds.update", auth.saveCreds);
  socket.ev.on("connection.update", async ({ connection, qr }) => {
    if (connection === 'open') {
      console.log("WhatsApp Aktif..");
      qrCode = null;
    } else if (connection === 'close') {
      console.log("WhatsApp Tertutup..");
      setTimeout(() => connectWhatsapp(db), 10000);
    } else if (connection === 'connecting') {
      console.log('WhatsApp Menghubungkan');
    }
    if (qr && !qrCode) {
      console.log('Kode QR baru dihasilkan');
      qrCode = qr;
      fs.writeFileSync('qr.txt', qr);
    }

    socket.ev.on("messages.upsert", async ({messages}) => {
      const pesan = messages[0].message.conversation;
      const phone = messages[0].key.remoteJid;
      console.log(messages[0]);
      if (!messages[0].key.fromMe) {
        try {
          const response = await query({"question": pesan});
          console.log(response);
          const {text} = response;
          await socket.sendMessage(phone, { text: text });

          // Simpan pesan di MongoDB
          await db.collection('pesan').insertOne({
            nomor: phone,
            pesan: pesan,
            jawaban: text,
            waktu: new Date()
          });
          await db.collection('pesan').createIndex({ waktu: 1 }, { expireAfterSeconds: 86400 });
        } catch (error) {
          console.error('Kesalahan saat memproses pesan:', error);
        }
      }
    });
  });
}

async function query(data) {
  try {
    const response = await fetch(
      "https://geghnreb.cloud.sealos.io/api/v1/prediction/28a6b79e-bd21-436c-ae21-317eee710cb0",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Kesalahan saat melakukan query:', error);
    throw error;
  }
}

module.exports = { connectWhatsapp, getQRCode: () => qrCode };
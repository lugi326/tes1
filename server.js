const express = require('express');
const { MongoClient } = require('mongodb');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { getQRCode, connectWhatsapp } = require('./index');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

const mongoURI = 'mongodb+srv://tes1:9YvD3w3kbtuCCvLt@lugi.ecnsu3f.mongodb.net/?retryWrites=true&w=majority&appName=lugi';
const dbName = 'lugi';

let client;

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    console.log('Terhubung ke MongoDB');
  }
  return client.db(dbName);
}

app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

app.get('/', (req, res) => {
  res.send('Bot WhatsApp sedang berjalan!');
});

app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

app.get('/qr-image', async (req, res) => {
  let attempts = 0;
  const maxAttempts = 10;

  const tryGetQR = async () => {
    const qr = getQRCode();
    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      res.send(`<img src="${qrImage}" alt="Kode QR">`);
    } else if (attempts < maxAttempts) {
      attempts++;
      setTimeout(tryGetQR, 1000);
    } else {
      res.send('Kode QR belum tersedia atau sudah terhubung ke WhatsApp');
    }
  };

  tryGetQR();
});

const server = app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});

(async () => {
  const db = await connectToMongo();
  connectWhatsapp(db);
})();

process.on('SIGTERM', async () => {
  console.log('SIGTERM diterima. Menutup dengan anggun.');
  if (client) {
    await client.close();
  }
  server.close(() => {
    console.log('Proses dihentikan.');
    process.exit(0);
  });
});
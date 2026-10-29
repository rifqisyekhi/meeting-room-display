require("dotenv").config();

const app = require("./app");
const { initDatabase } = require("./db");
const { syncStoreFromDatabase } = require("./services/dashboard.service");
const { auditKonfigurasi } = require("./config-audit");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    auditKonfigurasi();
    const isDbReady = await initDatabase();
    if (isDbReady) {
        await syncStoreFromDatabase();
    }
});

// Bawaan Node memutus request yang belum selesai diterima dalam 5 menit.
// Unggahan audio rapat (ratusan MB) bisa lebih lama dari itu.
server.requestTimeout = 60 * 60 * 1000;
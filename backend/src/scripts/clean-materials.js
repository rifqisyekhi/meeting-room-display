require("dotenv").config({ path: require("path").join(__dirname, "../../../backend/.env") });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { query, initDatabase } = require("../db");

async function run() {
  const storePath = path.join(__dirname, "../../data/dashboard-store.json");
  const materialsDir = path.join(__dirname, "../../data/materials");
  if (!fs.existsSync(materialsDir)) {
    fs.mkdirSync(materialsDir, { recursive: true });
  }

  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  console.log("Original store size:", fs.statSync(storePath).size);

  // Hapus dummy test meeting jika ada
  store.meetings = (store.meetings || []).filter(
    (m) => m.title !== "tes booking besar" && m.title !== "tes booking"
  );

  let extractedCount = 0;
  for (const m of store.meetings) {
    if (Array.isArray(m.materials)) {
      for (const mat of m.materials) {
        if (mat.url && mat.url.startsWith("data:")) {
          const match = mat.url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const ext =
              path.extname(mat.name || "").toLowerCase() ||
              (mat.type === "pdf" ? ".pdf" : ".bin");
            const cleanExt = [
              ".pdf",
              ".ppt",
              ".pptx",
              ".doc",
              ".docx",
              ".xls",
              ".xlsx",
            ].includes(ext)
              ? ext
              : ".pdf";
            const fileName = crypto.randomUUID() + cleanExt;
            const filePath = path.join(materialsDir, fileName);
            const buffer = Buffer.from(match[2], "base64");
            fs.writeFileSync(filePath, buffer);
            mat.url = "/api/dashboard/materials/files/" + fileName;
            mat.size =
              buffer.length < 1024 * 1024
                ? (buffer.length / 1024).toFixed(1) + " KB"
                : (buffer.length / (1024 * 1024)).toFixed(1) + " MB";
            extractedCount++;
            console.log(
              "Extracted material",
              mat.name,
              "to file",
              fileName,
              "size:",
              buffer.length
            );
          }
        }
      }
    }
  }

  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  console.log("Extracted materials count:", extractedCount);
  console.log("New store size:", fs.statSync(storePath).size);

  // Sync ke database jika DB connect
  try {
    const isDbReady = await initDatabase();
    if (isDbReady) {
      for (const m of store.meetings) {
        try {
          await query(
            "UPDATE meetings SET materials = $1 WHERE id = $2",
            [JSON.stringify(m.materials || []), String(m.id)]
          );
          console.log("Updated DB materials for meeting", m.id);
        } catch (e) {
          console.warn("DB update err for meeting", m.id, e.message);
        }
      }
      try {
        await query(
          "DELETE FROM meetings WHERE title IN ('tes booking besar', 'tes booking')"
        );
      } catch (e) {}
    }
  } catch (err) {
    console.warn("Database sync error (store is already cleaned):", err.message);
  }

  console.log("Clean complete!");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


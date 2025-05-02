// Frontend/serve.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4173;
const distDir = path.resolve(__dirname, "dist");

// 1) Add COOP/COEP headers to every response
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// 2) Serve your built files
app.use(express.static(distDir, { extensions: ["html"] }));

// 3) Fallback all unmatched routes to index.html (for react-router)
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// 4) Start the server
app.listen(port, () => {
  console.log(`🚀 Static server running at http://localhost:${port}`);
});

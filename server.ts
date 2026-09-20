import http from "http";
import { createServer as createViteServer } from "vite";
import { createApp } from "./src/server/app";

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught Exception:", err?.message || err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled Rejection:", reason);
});

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const path = await import("path");
    const fs = await import("fs");
    const distPath = path.join(process.cwd(), "dist");
    const express = (await import("express")).default;
    // 1. Long-term caching for hashed assets (1 year immutable)
    app.use(
      "/assets",
      express.static(path.join(distPath, "assets"), {
        maxAge: "1y",
        immutable: true,
      })
    );
    // 2. Strict anti-caching for HTML and service worker so updates propagate instantly
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html") || filePath.endsWith("sw.js") || filePath.endsWith("manifest.json")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          }
        },
      })
    );
    // 3. SPA Fallback: Never cache index.html
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`GOFAMINT_HOF Sunday School Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('[Server] Startup failed:', error?.message || error);
  process.exit(1);
});

import http from "http";
import { createServer as createViteServer } from "vite";
import { createApp } from "./src/server/app";

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught Exception:", err?.message || err);
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`GOFAMINT_HOF Sunday School Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

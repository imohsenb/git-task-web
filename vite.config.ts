import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api/events": {
        target: "http://127.0.0.1:4600",
        ws: false,
        changeOrigin: true,
        // SSE: disable buffering so events flush immediately
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-cache";
          });
        },
      },
      "/api": {
        target: "http://127.0.0.1:4600",
        changeOrigin: true,
      },
    },
  },
});

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// Despliegue en servidor: rutas relativas para poder servir desde cualquier subcarpeta.
export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Mis Finanzas",
        short_name: "Finanzas",
        description: "Sistema personal de finanzas: pagos, sueldo, ahorros, proyectos y viajes. 100% local.",
        lang: "es-MX",
        dir: "ltr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "any",
        background_color: "#f4f6fb",
        theme_color: "#4f6ef7",
        categories: ["finance", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, open: true },
  build: { outDir: "dist" },
});

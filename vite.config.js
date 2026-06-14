import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Despliegue en servidor: rutas relativas para poder servir desde cualquier subcarpeta.
export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: { port: 5173, open: true },
  build: { outDir: "dist" },
});

import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5340 },
  build: { target: "es2022", cssCodeSplit: false, assetsInlineLimit: 0 },
});

const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  root: path.resolve(__dirname, "dashboard-react"),
  base: "/dashboard/",
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "dashboard", "dist"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020"
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3080"
    }
  }
});

import { defineConfig } from "vite";

export default defineConfig({
  root: new URL("./site", import.meta.url).pathname,
  base: "./",
  publicDir: false,
  server: { host: "127.0.0.1", port: 4176, strictPort: false },
});

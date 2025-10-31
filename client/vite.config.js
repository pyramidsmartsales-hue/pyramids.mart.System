import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // base is '/' by default; kept explicit to avoid routing issues when hosted
  base: "/"
});

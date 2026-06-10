import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: {
    GITHUB_ACTIONS?: string;
  };
};

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/Collection-App/" : "/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173
  }
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "~~": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.eve/**",
      "**/.nuxt/**",
      "**/.output/**",
      "**/dist/**",
    ],
  },
});

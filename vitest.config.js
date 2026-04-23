import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["backend/**/*.test.js"],
    clearMocks: true,
    env: {
      LOG_LEVEL: "silent",
    },
  },
});

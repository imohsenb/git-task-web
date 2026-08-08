import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["src/server/**/*.test.ts", "src/web/**/*.test.ts", "src/shared/**/*.test.ts"],
  },
});

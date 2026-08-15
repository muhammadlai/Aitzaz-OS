import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

if (typeof process !== 'undefined') {
  process.env.ROLLUP_SKIP_NODEJS_REQUIRE = '1'
}

export default defineConfig({
  plugins: [vue()],
  // Tests don't need Tailwind output; bypass the PostCSS plugin so SFC
  // <style lang="postcss"> blocks mount cleanly in happy-dom tests.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    pool: 'threads',
  },
})

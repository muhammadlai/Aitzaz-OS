import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

if (typeof process !== 'undefined') {
  process.env.ROLLUP_SKIP_NODEJS_REQUIRE = '1'
}

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    pool: 'threads',
  },
})

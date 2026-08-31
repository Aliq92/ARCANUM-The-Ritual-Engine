import { defineConfig } from 'vite'

// Declared locally rather than pulling in @types/node for one lookup.
declare const process: { env: Record<string, string | undefined> }

/**
 * ARCANUM builds with a relative base by default (`./`).
 *
 * A relative base makes the production bundle work identically at a domain
 * root, under a GitHub Pages repository subpath, or from the local file
 * system, without needing to know the repository name at build time. Set
 * BASE_PATH explicitly if an absolute base is ever required.
 */
const base = process.env.BASE_PATH ?? './'

export default defineConfig({
  base,
  build: {
    target: 'es2020',
    cssTarget: 'safari15',
    assetsInlineLimit: 2048,
    reportCompressedSize: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
})

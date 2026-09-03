/**
 * Build the browser-side client bundle for dsh-sess.
 *
 * The artifact is a closure-factory module matching the DSH web client module
 * format: it calls `window.__ModuleLoader__.load({ id, factory })` and resolves
 * its externals through the injected `require` (the loader module table). This
 * mirrors the official client preset and third-party plugin builds; only the
 * platform seed entries the client code actually imports are left external.
 *
 * esbuild emits CJS-style output that expects `module`/`exports` in scope, so
 * they are declared at the top of the factory closure and returned at the end.
 */
import { build } from 'esbuild'

const PLUGIN_ID = 'dsh-sess'

/** Module-table words the client bundle requires at runtime. */
const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
]

await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  outfile: 'client/client.js',
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  // The sources use the automatic JSX runtime (tsconfig jsx: react-jsx), so
  // esbuild must compile JSX to react/jsx-runtime calls instead of the default
  // transform mode's React.createElement — the bundle never imports React by
  // value and would otherwise crash with "React is not defined".
  jsx: 'automatic',
  external: EXTERNALS,
  sourcemap: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  banner: {
    js: [
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      'var module = { exports: {} }; var exports = module.exports;',
    ].join('\n'),
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

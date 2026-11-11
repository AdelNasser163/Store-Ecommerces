import { build } from "esbuild";
await build({
  entryPoints: ["src-islands/index.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  jsx: "automatic",
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "js/vendor/rb-islands.js",
  legalComments: "none",
  logLevel: "info",
});

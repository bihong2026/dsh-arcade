// esbuild script:
//  - lib/client.js : IIFE wrapped in window.__ModuleLoader__.load(),
//                    react marked external (provided by DSH web client)
//  - lib/index.js  : plain ESM copy of the host entry (no bundling needed)
import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("lib", { recursive: true });

await esbuild.build({
  entryPoints: ["src/client.js"],
  bundle: true,
  format: "iife",
  outfile: "lib/client.js",
  minify: true,
  target: ["es2020"],
  external: ["react", "react-dom"],
  define: {
    "process.env.NODE_ENV": '"production"',
    "window.__GAMEHUB_URL__": "undefined",
  },
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "@gamehub/dsh-arcade", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
  },
  footer: {
    js: "return module.exports; } });",
  },
});

cpSync("src/index.js", "lib/index.js");
console.log("build ok: lib/index.js, lib/client.js");

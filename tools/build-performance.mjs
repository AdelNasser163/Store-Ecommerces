/* Static assets for GitHub Pages. Run after changing a source stylesheet/script. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { transform, build } from "esbuild";
import { siteComponents } from "./site-components.mjs";
import { format } from "prettier";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { prune } = require("./prune-utilities.cjs");
const { dedupe } = require("./clean-css.cjs");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
const metaFile = "tools/performance-pages.json";
const metadata = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};
const images = JSON.parse(fs.readFileSync("assets/images/image-manifest.json", "utf8"));
const imageLookup = new Map(
  Object.entries(images).flatMap(([source, item]) =>
    item.variants.map((v) => [v.src, { source, item }]),
  ),
);
const manifest = {},
  fontCSS = fs.readFileSync("assets/fonts/fonts-performance.css", "utf8");
fs.mkdirSync("dist", { recursive: true });
const generated = new Set();
const identicalAssets = new Map();
const mainSource = fs.readFileSync("main.js", "utf8");
const cloudEnabled = /enabled\s*:\s*true/.test(fs.readFileSync("supabase-config.js", "utf8"));
const supabaseCode = cloudEnabled
  ? (
      await build({
        entryPoints: ["js/supabase-client.js"],
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: "es2020",
        minify: true,
      })
    ).outputFiles[0].text
  : "";
const dictionaryStart = mainSource.indexOf(
  "{",
  mainSource.indexOf("Object.entries({", mainSource.indexOf("const translations")),
);
let depth = 0,
  quote = "",
  escaped = false,
  dictionaryEnd = dictionaryStart;
for (let i = dictionaryStart; i < mainSource.length; i++) {
  const ch = mainSource[i];
  if (quote) {
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === quote) quote = "";
    continue;
  }
  if (ch === '"' || ch === "'") {
    quote = ch;
    continue;
  }
  if (ch === "{") depth++;
  if (ch === "}" && !--depth) {
    dictionaryEnd = i + 1;
    break;
  }
}
const dictionary = Function("return (" + mainSource.slice(dictionaryStart, dictionaryEnd) + ")")();
function asset(name, code, extension) {
  const key = hash(code) + "." + extension;
  if (identicalAssets.has(key)) return identicalAssets.get(key);
  const file = `dist/${name}.${key}`;
  fs.writeFileSync(file, code);
  generated.add(file);
  identicalAssets.set(key, file);
  return file;
}
const adminModules = {};
if (fs.existsSync("js/admin/pages"))
  for (const name of fs.readdirSync("js/admin/pages").filter((n) => n.endsWith(".js"))) {
    const source = fs.readFileSync("js/admin/pages/" + name, "utf8");
    adminModules[name.replace(".js", "")] = asset(
      "admin-view-" + name.replace(".js", ""),
      (
        await transform(source, {
          loader: "js",
          format: "esm",
          minify: true,
          target: "es2020",
          legalComments: "none",
          charset: "utf8",
        })
      ).code,
      "js",
    );
  }
function staticImages(html) {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    tag = tag.replace(/\s*\/>$/, ">");
    const source = tag.match(/\bsrc=["']([^"']+)["']/)?.[1],
      item = images[source];
    const logo = imageLookup.get(source);
    if (logo && /\/logo(?:-footer)?\.png$/.test(logo.source)) {
      const sizes = logo.source.includes("footer") ? "145px" : "(max-width:767px) 88px, 112px";
      tag = tag
        .replace(/\bsrc=["'][^"']+["']/, `src="${logo.item.src}"`)
        .replace(/\ssrcset=["'][^"']*["']/, "")
        .replace(/\ssizes=["'][^"']*["']/, "")
        .replace(
          />$/,
          ` srcset="${logo.item.variants.map((v) => `${v.src} ${v.width}w`).join(",")}" sizes="${sizes}">`,
        );
    }
    if (item) {
      tag = tag.replace(/\bsrc=["'][^"']+["']/, `src="${item.src}"`);
      if (!/\bsrcset=/.test(tag))
        tag = tag.replace(
          /\s*\/?>$/,
          ` srcset="${item.variants.map((v) => `${v.src} ${v.width}w`).join(",")}">`,
        );
      if (!/\bsizes=/.test(tag))
        tag = tag.replace(
          />$/,
          ` sizes="${/logo/.test(source) ? "150px" : "(max-width:767px) 90vw, 600px"}">`,
        );
    }
    if (!/\bwidth=/.test(tag)) tag = tag.replace(/>$/, ` width="${item?.width || 600}">`);
    if (!/\bheight=/.test(tag)) tag = tag.replace(/>$/, ` height="${item?.height || 600}">`);
    if (!/\bdecoding=/.test(tag)) tag = tag.replace(/>$/, ' decoding="async">');
    if (/optimized\/logo-\d+/.test(tag)) tag = tag.replace(/\sloading=["']lazy["']/, "");
    if (
      !/optimized\/logo-\d+|logo\.png|id=["']mainProductImage/.test(tag) &&
      !/\bloading=/.test(tag)
    )
      tag = tag.replace(/>$/, ' loading="lazy">');
    // Priority artwork must never become lazy during the generic image pass.
    if (/\bfetchpriority=["']high["']/.test(tag))
      tag = tag.replace(/\sloading=["'][^"']*["']/, "").replace(/>$/, ' loading="eager">');
    return tag;
  });
}
for (const page of fs
  .readdirSync(".")
  .filter((n) => n.endsWith(".html") && n !== "products.html")) {
  let html = fs.readFileSync(page, "utf8");
  if (!metadata[page])
    metadata[page] = {
      styles: [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)]
        .map((m) => m[0].match(/href=["']([^"']+)/)?.[1])
        .filter(Boolean)
        .map((s) => s.split("?")[0])
        .filter((s) => !s.startsWith("http")),
      scripts: [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/g)].map(
        (m) => m[1].split("?")[0],
      ),
    };
  const meta = metadata[page];
  html = siteComponents(html, page, meta);
  // Scope utility rules to this page's markup and its actual JS dependencies.
  // Dynamic/stateful selectors are retained conservatively by the pruner.
  const pagePool =
    html.replace(/<style id="perf-critical">[\s\S]*?<\/style>/g, "") +
    "\n" +
    [...new Set([...meta.scripts, "js/image-performance.js"])]
      .filter((s) => fs.existsSync(s))
      .map((s) => fs.readFileSync(s, "utf8"))
      .join("\n");
  let css = "";
  for (let source of new Set(meta.styles)) {
    if (source === "assets/fonts/fonts.css") source = "assets/fonts/fonts-performance.css";
    if (source === "js/vendor/rb-islands.css") source = "src-islands/islands.css";
    let value = fs.readFileSync(source, "utf8");
    if (source !== "admin/index.css") value = prune(value, pagePool);
    value = value.replace(
      /url\((["']?)(?!data:|https?:|\/)([^)'"\s]+)\1\)/g,
      (_, q, url) =>
        `url(${q}../${path.posix.normalize(path.posix.join(path.posix.dirname(source), url))}${q})`,
    );
    css += "\n" + value;
  }
  css += "\n" + fs.readFileSync("performance.css", "utf8");
  const compiled = dedupe(
    (
      await transform(css, {
        loader: "css",
        minify: true,
        target: "es2020",
        legalComments: "none",
        charset: "utf8",
      })
    ).code,
  ).css;
  const cssFile = asset(page.replace(".html", ""), compiled, "css");
  const moveLast = ["js/site-navigation.js", "js/site-theme.js"];
  const informational = ["about.html", "blog.html", "contact.html", "checkout.html"].includes(page);
  const motionVendors = new Set([
    "js/vendor/gsap.min.js",
    "js/vendor/ScrollTrigger.min.js",
    "js/vendor/lenis.min.js",
    "js/vendor/rb-islands.js",
  ]);
  const scripts = meta.scripts.filter(
    (s) =>
      s !== "js/page-bootstrap.js" &&
      !motionVendors.has(s) &&
      !moveLast.includes(s) &&
      s !== "js/fx.js" &&
      !(informational && ["catalog.js", "js/product-card.js"].includes(s)),
  );
  const hasStore = scripts.includes("data/store.js");
  if (hasStore) scripts.unshift("js/image-manifest.js", "js/image-performance.js");
  scripts.push(...moveLast.filter((s) => meta.scripts.includes(s)));
  if (meta.scripts.includes("js/fx.js")) scripts.push("js/fx.js");
  const cloudStore = cloudEnabled && !page.startsWith("admin") && hasStore;
  if (cloudStore) {
    const storeIndex = scripts.indexOf("data/store.js");
    scripts.splice(storeIndex + 1, 0, "admin-config.js", "data/bundles.js", "js/store-cloud.js");
  }
  let code = meta.scripts.includes("js/admin/app.js")
    ? "window.AdminPageModules=" + JSON.stringify(adminModules) + ";\n"
    : "";
  for (const source of [...new Set(scripts)]) {
    if (source === "js/supabase-client.js" && !cloudEnabled) continue;
    let text = source === "js/supabase-client.js" ? supabaseCode : fs.readFileSync(source, "utf8");
    if (!source.startsWith("data/") && source !== "js/image-manifest.js")
      for (const original of ["assets/images/logo.png", "assets/images/logo-footer.png"])
        text = text.split(original).join(images[original]?.src || original);
    code += ";\n" + text;
    if (source === "js/store-cloud.js") code += ";if(await window.StoreCloud.ready===false)return;";
  }
  if (cloudStore) code = "(async()=>{" + code + "})();";
  const jsFile = asset(
    page.replace(".html", ""),
    (
      await transform(code, {
        loader: "js",
        minify: true,
        target: "es2020",
        legalComments: "none",
        charset: "utf8",
      })
    ).code,
    "js",
  );
  html = html
    .replace(/<!--perf-assets:start-->[\s\S]*?<!--perf-assets:end-->/g, "")
    .replace(/<!--perf-bootstrap:start-->[\s\S]*?<!--perf-bootstrap:end-->/g, "")
    .replace(/<!--perf-early:start-->[\s\S]*?<!--perf-early:end-->/g, "")
    .replace(/<!--perf-hero:start-->[\s\S]*?<!--perf-hero:end-->/g, "")
    .replace(/<!--perf-skeleton:start-->[\s\S]*?<!--perf-skeleton:end-->/g, "")
    .replace(/<style id="perf-critical">[\s\S]*?<\/style>/g, "");
  html = html
    .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/g, "")
    .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g, "")
    .replace(/<noscript>\s*<\/noscript>/g, "");
  // The encoding declaration must precede the bootstrap and be inside the first 1024 bytes.
  html = html.replace(/<meta\s+charset=["'][^"']+["'][^>]*>/i, "");
  html = html.replace(/<head\b[^>]*>/, '<head><meta charset="utf-8">');
  if (meta.scripts.includes("js/page-bootstrap.js")) {
    const boot = (
      await transform(
        fs.readFileSync("js/page-bootstrap.js", "utf8") +
          (meta.scripts.includes("js/admin/app.js")
            ? fs.readFileSync("js/admin/bootstrap.js", "utf8")
            : ""),
        { minify: true, loader: "js" },
      )
    ).code;
    const bootFile = asset("page-bootstrap", boot, "js");
    html = html.replace(
      '<meta charset="utf-8">',
      '<meta charset="utf-8"><!--perf-bootstrap:start--><script src="' +
        bootFile +
        '"></script><!--perf-bootstrap:end-->',
    );
  }
  const iconFont = fontCSS.match(/url\((icons-[^)]+)\)/)?.[1];
  const arabicFont = fontCSS.match(/src: url\((arabic-[^)]+)\)[^}]*unicode-range: U\+0600/)?.[1];
  const cairoLatin = fontCSS
    .split("}")
    .find((block) => /font-family: 'Cairo'/.test(block) && /unicode-range: U\+0000/.test(block))
    ?.match(/url\(([^)]+)\)/)?.[1];
  const preloads = [
    !meta.scripts.includes("js/admin/app.js") && iconFont && `assets/fonts/${iconFont}`,
    "assets/fonts/font-2.woff2",
    "assets/fonts/font-6.woff2",
    arabicFont && `assets/fonts/${arabicFont}`,
    cairoLatin && `assets/fonts/${cairoLatin}`,
  ]
    .filter(Boolean)
    .map((src) => `<link rel="preload" href="${src}" as="font" type="font/woff2" crossorigin>`)
    .join("");
  let hero = "";
  if (page === "index.html") {
    html = html.replace(
      /<div\b[^>]*data-products-section="home-(?:flash|featured)"[^>]*>/g,
      (tag) => {
        if (!tag.includes("data-perf-pending"))
          tag = tag.replace(/>$/, ' data-perf-pending aria-busy="true">');
        return (
          tag +
          "<!--perf-skeleton:start-->" +
          Array.from(
            { length: 4 },
            () => '<div class="perf-skeleton" aria-hidden="true"></div>',
          ).join("") +
          "<!--perf-skeleton:end-->"
        );
      },
    );
    const mapping = JSON.parse(
      "{" +
        fs
          .readFileSync("js/hero-b.js", "utf8")
          .match(/const images = \{([\s\S]*?)\};/)[1]
          .replace(/,\s*$/, "") +
        "}",
    );
    const selected = mapping["apple-iphone-15-pro-max-256gb"],
      image = images["assets/images/" + selected];
    if (image)
      hero = `<link rel="preload" as="image" href="${image.src}" imagesrcset="${image.variants.map((v) => `${v.src} ${v.width}w`).join(",")}" imagesizes="(max-width:639px) 258px, 284px" fetchpriority="high">`;
    const artwork = (id, side) => {
      const item = images["assets/images/" + mapping[id]];
      if (!item) return "";
      return `<!--perf-hero:start--><div class="${side ? "hb-side-link" : "hb-slide is-active"}"><img src="${item.src}" srcset="${item.variants.map((v) => `${v.src} ${v.width}w`).join(",")}" sizes="${side ? "220px" : "(max-width:639px) 258px, 284px"}" width="${item.width}" height="${item.height}" decoding="async" ${side ? 'loading="lazy"' : 'fetchpriority="high"'} alt="${side ? "Technology product" : "Smartphone"}"></div><!--perf-hero:end-->`;
    };
    html = html.replace(
      /(<div\b[^>]*data-hb-slides[^>]*>)/,
      "$1" + artwork("apple-iphone-15-pro-max-256gb", false),
    );
    for (const id of ["macbook-pro-16-m3-max", "playstation-5-slim-bundle"])
      html = html.replace(
        new RegExp('(<div\\b[^>]*data-hb-side="' + id + '"[^>]*>)'),
        "$1" + artwork(id, true),
      );
    const heroBlock =
      html.match(/<section\b[^>]*class="[^"]*\bhb-hero\b[\s\S]*?<\/section>/)?.[0] || "";
    const copy = Object.fromEntries(
      Object.entries(dictionary).filter(([key]) => heroBlock.includes(key)),
    );
    const early = `(function(){if(document.documentElement.lang!=="ar")return;const entries=${JSON.stringify(Object.entries(copy).sort((a, b) => b[0].length - a[0].length))};window.AlMumezEarlyTexts=new WeakMap();const w=document.createTreeWalker(document.querySelector('.hb-hero'),NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(n.parentElement.matches('.material-symbols-outlined,script,style'))continue;let text=n.textContent;window.AlMumezEarlyTexts.set(n,text);for(const [en,ar]of entries)if(text.includes(en))text=text.replaceAll(en,ar);if(text!==n.textContent)n.textContent=text}})();`;
    if (heroBlock) {
      fs.writeFileSync(
        "js/pages/home-early-translations.js",
        await format(early, { parser: "babel" }),
      );
      const earlyFile = asset(
        "home-early-translations",
        (await transform(early, { loader: "js", minify: true, charset: "utf8" })).code,
        "js",
      );
      html = html.replace(
        heroBlock,
        heroBlock +
          '<!--perf-early:start--><script src="' +
          earlyFile +
          '"></script><!--perf-early:end-->',
      );
    }
  }
  html = html.replace(
    "</head>",
    `<!--perf-assets:start-->${preloads}${hero}<link rel="stylesheet" href="${cssFile}"><!--perf-assets:end--></head>`,
  );
  html = html.replace(
    "</body>",
    `<!--perf-assets:start--><script defer src="${jsFile}"></script><!--perf-assets:end--></body>`,
  );
  html = staticImages(html);
  html = html.replace(/<link\b(?=[^>]*\brel=["'](?:shortcut )?icon["'])[^>]*>/gi, "");
  html = html.replace(
    "</head>",
    '<link rel="icon" type="image/png" href="assets/images/logo.png"></head>',
  );
  fs.writeFileSync(
    page,
    await format(html, {
      parser: "html",
      htmlWhitespaceSensitivity: "css",
      printWidth: 100,
      tabWidth: 2,
    }),
  );
  manifest[page] = { css: cssFile, js: jsFile, sources: meta };
}
fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
fs.writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2));
// Only remove obsolete generated assets inside the verified dist directory.
for (const name of fs.readdirSync("dist")) {
  const file = "dist/" + name;
  if (/\.[a-f0-9]{12}\.(css|js)$/.test(name) && !generated.has(file)) fs.unlinkSync(file);
}
console.log("Built " + Object.keys(manifest).length + " pages with external CSS and JavaScript.");

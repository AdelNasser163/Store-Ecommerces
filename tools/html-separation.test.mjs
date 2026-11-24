import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parse } from "parse5";

const pages = fs.readdirSync(".").filter((file) => file.endsWith(".html"));
for (const file of pages) {
  const source = fs.readFileSync(file, "utf8"),
    doc = parse(source);
  let icon = false,
    charset = false,
    siteHeader = false;
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map((a) => [a.name, a.value]));
    assert.notEqual(node.tagName, "style", file + ": inline CSS");
    if (node.tagName === "script")
      assert(
        attrs.src && !node.childNodes?.some((n) => n.value?.trim()),
        file + ": inline JavaScript",
      );
    assert(
      !Object.keys(attrs).some((name) => name === "style" || /^on/i.test(name)),
      file + ": inline style/event",
    );
    if (attrs["data-component"] === "site-header" || "data-products-header" in attrs)
      siteHeader = true;
    if (node.tagName === "meta" && attrs.charset === "utf-8") charset = true;
    if (node.tagName === "link" && attrs.rel === "icon") {
      icon = true;
      assert.equal(attrs.href, "assets/images/logo.png");
    }
    const ref = node.tagName === "script" ? attrs.src : node.tagName === "link" ? attrs.href : null;
    if (ref && !/^(?:https?:|data:|#)/.test(ref))
      assert(
        fs.existsSync(path.resolve(path.dirname(file), ref.split("?")[0])),
        file + ": missing resource " + ref,
      );
    for (const child of node.childNodes || []) visit(child);
  }
  visit(doc);
  assert(icon, file + ": missing tab logo");
  assert(charset, file + ": missing UTF-8");
  if (["forgot-password.html", "reset-password.html"].includes(file))
    assert(!siteHeader, file + ": password page navigation");
  assert(
    source.split("\n").some((line) => /^  <head>/.test(line)),
    file + ": unreadable head formatting",
  );
}
console.log(
  "PASS " +
    pages.length +
    " HTML pages: external CSS/JS only, no inline events/styles, valid asset links, tab logos, formatting and password pages without navbar.",
);

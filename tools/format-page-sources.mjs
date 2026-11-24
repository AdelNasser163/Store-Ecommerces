import fs from "node:fs";
import { format } from "prettier";
const pages = fs.readdirSync(".").filter((file) => file.endsWith(".html"));
for (const file of [...pages, "templates/site-header.html", "templates/site-footer.html"]) {
  const source = fs.readFileSync(file, "utf8");
  fs.writeFileSync(
    file,
    await format(source, {
      parser: "html",
      htmlWhitespaceSensitivity: "css",
      printWidth: 100,
      tabWidth: 2,
    }),
  );
}
console.log("Formatted " + pages.length + " pages and shared templates.");

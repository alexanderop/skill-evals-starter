import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve("docs/dist");
const origin = process.env.DOCS_SITE ?? "https://alexanderop.github.io";
const base =
  `/${(process.env.DOCS_BASE ?? "/skill-evals-starter/").replace(/^\/+|\/+$/gu, "")}/`.replace(
    /\/+/gu,
    "/",
  );
const files = await readdir(root, { recursive: true });
const pages = files.filter((file) => file.endsWith(".html"));
const failures = [];
let checked = 0;

for (const file of pages) {
  const source = await readFile(join(root, file), "utf8");
  // Starlight gives the special 404.html page a /404/ canonical URL.
  const html =
    file === "404.html"
      ? source.replace(/<link\b[^>]*rel="canonical"[^>]*>/gu, "")
      : source;
  const route = file.replace(/index\.html$/u, "");
  const current = new URL(base + route, origin);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gu)) {
    const value = match[1].replaceAll("&amp;", "&");
    const url = new URL(value, current);
    if (url.origin !== current.origin) continue;
    if (!url.pathname.startsWith(base)) {
      failures.push(`${file}: outside configured base: ${value}`);
      continue;
    }
    const path = resolve(
      root,
      decodeURIComponent(url.pathname.slice(base.length)),
    );
    if (relative(root, path).startsWith("..")) {
      failures.push(`${file}: path escapes build: ${value}`);
      continue;
    }
    try {
      const entry = await stat(path);
      const target = entry.isDirectory() ? join(path, "index.html") : path;
      await stat(target);
      if (url.hash && target.endsWith(".html")) {
        const targetHtml = await readFile(target, "utf8");
        const ids = new Set(
          Array.from(
            targetHtml.matchAll(/\bid="([^"]+)"/gu),
            (item) => item[1],
          ),
        );
        if (!ids.has(decodeURIComponent(url.hash.slice(1)))) {
          throw new Error(`missing anchor ${url.hash}`);
        }
      }
      checked++;
    } catch (error) {
      failures.push(`${file}: ${value}: ${error.message}`);
    }
  }
}

if (pages.length === 0) failures.push("No documentation pages were built.");
if (failures.length > 0) {
  throw new Error(`Documentation link check failed:\n${failures.join("\n")}`);
}
console.log(
  `Checked ${checked} local links and assets across ${pages.length} HTML pages.`,
);

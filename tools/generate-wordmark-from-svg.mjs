import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "public", "media", "mithron", "shell", "mith logo.svg");
const svgOutPath = join(root, "public", "media", "mithron", "shell", "mithron-wordmark.svg");

let svg = readFileSync(sourcePath, "utf8");
svg = svg.replace(/<path d="M0 0 C241\.23[\s\S]*?fill="#1E272F" transform="translate\(0,0\)"\/>/, "");
svg = svg.replace(
  '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="731" height="271">',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="55 105 575 80" width="575" height="80" role="img" aria-label="Mithron">'
);

writeFileSync(svgOutPath, svg, "utf8");
console.log(`Saved ${svgOutPath}`);

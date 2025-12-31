import fs from "fs";

export function generateTitle() {
  const data = JSON.parse(fs.readFileSync("titles.json", "utf8"));
  const base = data.base[Math.floor(Math.random() * data.base.length)];
  const suffix = data.suffix[Math.floor(Math.random() * data.suffix.length)];
  return `${base} ${suffix}`;
}

#!/usr/bin/env node
// Checks the Spanish UI strings against their upstream sources:
//  - source/server/templates/locales/es.yml has the same keys as en.yml (plural forms grouped)
//    and the same placeholders, $t() nestings, HTML tags and links per key;
//  - branding/language/string.resources.es.json (Voyager overlay) has every key of
//    Voyager's en.json and fr.json plus the literal strings its code localizes, and no other key.
// Usage: node scripts/check-es-locales.cjs   (needs `npm ci` in source/server for js-yaml)
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const yaml = require(path.join(root, "source/server/node_modules/js-yaml"));
let problems = 0;
const report = (...args) => { console.log(...args); problems++; };

// --- eCorpus shell ---
const locales = path.join(root, "source/server/templates/locales");
const load = f => yaml.load(fs.readFileSync(path.join(locales, f), "utf8"));
const flat = (o, p = "", out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === "object") flat(v, key, out); else out[key] = String(v);
  }
  return out;
};
const group = o => {
  const g = {};
  for (const [k, v] of Object.entries(flat(o))) (g[k.replace(/_(zero|one|many|other|plural)$/, "")] ??= []).push(v);
  return g;
};
const tokens = values => [...new Set(values.flatMap(s => [
  ...(s.match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map(t => t.replace(/\s/g, "")),
  ...(s.match(/\$t\([\w.]+/g) || []),
  ...(s.match(/<\/?[a-z]+/g) || []),
  ...(s.match(/href="[^"]*"/g) || []),
]))].filter(t => t !== "{{count}}").sort().join(" "); // plural forms may spell out the count

const en = group(load("en.yml")), es = group(load("es.yml"));
for (const k of Object.keys(en)) if (!(k in es)) report("es.yml missing:", k);
// huaka.pageTitles is only needed in languages that translate titles (see utils/templates/helpers/pageTitle.ts)
for (const k of Object.keys(es)) if (!(k in en) && !k.startsWith("huaka.pageTitles.")) report("es.yml extra:", k);
for (const k of Object.keys(en)) {
  if (k in es && tokens(en[k]) !== tokens(es[k])) report(`es.yml tokens differ for ${k}\n  en: ${tokens(en[k])}\n  es: ${tokens(es[k])}`);
}

// --- Voyager overlay ---
const voyager = path.join(root, "source/voyager/assets/language");
const json = f => JSON.parse(fs.readFileSync(f, "utf8"));
const upstream = new Set([
  ...Object.keys(json(path.join(voyager, "string.resources.en.json"))),
  ...Object.keys(json(path.join(voyager, "string.resources.fr.json"))),
]);
// Literal strings the Voyager code localizes but no upstream dictionary lists (e.g. Story task names)
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []);
for (const file of walk(path.join(root, "source/voyager/source/client"))) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/getUILocalizedString\(\s*(["'`])((?:(?!\1).)*)\1\s*\)/g)) upstream.add(m[2]);
  if (file.endsWith("Task.ts")) for (const m of src.matchAll(/static readonly text: string = "([^"]+)"/g)) upstream.add(m[1]);
}
// Strings that our patches/voyager add (the submodule stays unpatched in git): localized literals and
// the Story panel titles (MainView.panelTitles)
const patchDir = path.join(root, "patches/voyager");
for (const f of fs.readdirSync(patchDir).filter(f => f.endsWith(".patch"))) {
  const added = fs.readFileSync(path.join(patchDir, f), "utf8").split(/\r?\n/)
    .filter(l => l.startsWith("+") && !l.startsWith("+++")).join("\n");
  for (const m of added.matchAll(/get(?:UI)?LocalizedString\(\s*(["'`])((?:(?!\1).)*)\1\s*\)/g)) upstream.add(m[2]);
  const titles = /panelTitles[^{]*\{([^}]*)\}/.exec(added);
  if (titles) for (const m of titles[1].matchAll(/"[\w-]+": "([^"]+)"/g)) upstream.add(m[1]);
  // the editor mode label (TaskBar, patch 0005) is the ETaskMode option name
  if (added.includes("ins.mode.getOptionText()")) {
    const modes = /enum ETaskMode \{([^}]*)\}/.exec(fs.readFileSync(path.join(root, "source/voyager/source/client/applications/taskSets.ts"), "utf8"));
    for (const m of modes[1].matchAll(/\w+/g)) upstream.add(m[0]);
  }
}
const overlay = json(path.join(root, "branding/language/string.resources.es.json"));
for (const k of upstream) if (!(k in overlay)) report("Voyager es.json missing:", JSON.stringify(k));
for (const k of Object.keys(overlay)) if (!upstream.has(k)) report("Voyager es.json extra:", JSON.stringify(k));

console.log(problems ? `${problems} problem(s)` : `OK: es.yml ${Object.keys(es).length} keys, Voyager es.json ${Object.keys(overlay).length} keys`);
process.exit(problems ? 1 : 0);

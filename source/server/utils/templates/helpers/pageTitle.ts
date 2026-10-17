import { TFunction } from "i18next";

/**
 * Huaka: page titles come from routes as English literals (`title: "Home"`,
 * `` `Settings — ${scene.name}` ``). Rather than patching every route, they are
 * translated when rendered, through the `huaka.pageTitles` dictionary of the
 * current language (see templates/locales/es.yml).
 *
 * Dictionary entries are either exact titles or patterns with `{{placeholders}}`:
 *   "Home": "Inicio"
 *   "Settings — {{name}}": "Configuración — {{name}}"
 *
 * Titles with no entry are returned unchanged, so a new upstream route still
 * renders (in English).
 */
interface PageTitleHelperContext {
  data: {
    t?: TFunction;
    root: Record<string, any>;
  };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const patterns = new Map<string, { re: RegExp, names: string[] }>();

function compile(source: string) {
  let compiled = patterns.get(source);
  if (compiled) return compiled;
  const names: string[] = [];
  const re = new RegExp("^" + source.split(/\{\{\s*(\w+)\s*\}\}/).map((part, index) => {
    if (index % 2 === 0) return escapeRegExp(part);
    names.push(part);
    return "(.+?)";
  }).join("") + "$");
  compiled = { re, names };
  patterns.set(source, compiled);
  return compiled;
}

/**
 * Translate an English page title using a `{source: translation}` dictionary.
 * Exact matches win over patterns.
 */
export function translatePageTitle(title: string, dict: Record<string, string>): string {
  if (typeof dict[title] === "string") return dict[title];
  for (const [source, target] of Object.entries(dict)) {
    if (typeof target !== "string" || source.indexOf("{{") === -1) continue;
    const { re, names } = compile(source);
    const m = re.exec(title);
    if (!m) continue;
    return target.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
      const index = names.indexOf(name);
      return index === -1 ? match : m[index + 1];
    });
  }
  return title;
}

/**
 * Handlebars helper: `pageTitle`
 *
 * Template syntax:
 *   {{pageTitle title}}
 */
export function pageTitle(this: any, title: unknown, options: PageTitleHelperContext): string {
  if (typeof title !== "string" || !title) return title as any;
  const { data } = options;
  if (typeof data?.t !== "function") return title;
  // skipInterpolation: the {{placeholders}} are ours, not i18next variables.
  // nsSeparator: titles such as "{{name}}: Explorer" contain ":" (i18next's namespace separator)
  const dict = data.t("huaka.pageTitles", { lng: data.root?.lang ?? "en", returnObjects: true, skipInterpolation: true, nsSeparator: false }) as unknown;
  if (!dict || typeof dict !== "object") return title;
  return translatePageTitle(title, dict as Record<string, string>);
}

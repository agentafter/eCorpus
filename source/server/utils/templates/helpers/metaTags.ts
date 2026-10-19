import Handlebars from "handlebars";
import { TFunction } from "i18next";

import type { Seo } from "../../seo.js";
import { pageTitle } from "./pageTitle.js";

/**
 * Huaka: the <head> tags read by search engines and link previews, from the template context (see utils/seo.ts).
 * Every value is escaped; the JSON-LD has "<" escaped so that no "</script>" can close it.
 *
 * Template syntax (partials/head.hbs, patches/ecorpus/0007):
 *   {{metaTags}}
 */
interface MetaTagsHelperContext {
  data: {
    t?: TFunction;
    root: Record<string, any>;
  };
}

/** Open Graph wants a territory. Spanish is Latin American, where the collections are */
const OG_LOCALES: Record<string, string> = { es: "es_LA", en: "en_US", fr: "fr_FR" };
/** Captures are 1280 px squares (utils/seo.ts SHARE_IMAGE) */
const IMAGE_SIZE = 1280;

/** Attribute values: the five characters that matter, so that URLs keep their "=" (Handlebars would give &#x3D;) */
const ATTR_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, c => ATTR_ENTITIES[c]);
const meta = (attr: "name" | "property", key: string, value: unknown) =>
  `<meta ${attr}="${key}" content="${esc(String(value))}">`;

function withLang(url: string, lang: string): string {
  const u = new URL(url);
  u.searchParams.set("lang", lang);
  return u.toString();
}

export function metaTags(this: any, options: MetaTagsHelperContext): Handlebars.SafeString {
  const root = options?.data?.root ?? {};
  const t = options?.data?.t;
  const seo: Seo = root.seo ?? {};
  const lang: string = root.lang ?? "en";
  const brand: string = root.brand || "eCorpus";

  const routeTitle = typeof root.title === "string" && root.title ? pageTitle(root.title, options) : "";
  const title = seo.title ?? (routeTitle ? `${routeTitle} — ${brand}` : brand);
  const translate = (key: string, params?: Record<string, unknown>) =>
    typeof t === "function" ? String(t(key, { ...params, lng: lang, brand })) : "";
  const description = typeof seo.description === "string" ? seo.description
    : seo.description ? translate(seo.description.key, seo.description.params)
    : translate("huaka.showcase.heroLead");
  const url: string | undefined = seo.url ?? root.pageUrl ?? root.canonical;
  const image: string | null | undefined = seo.image !== undefined ? seo.image : root.siteImage;

  const tags: string[] = [];
  if (description) tags.push(meta("name", "description", description));
  if (seo.noindex) {
    tags.push(meta("name", "robots", "noindex, nofollow"));
  } else if (url) {
    tags.push(`<link rel="canonical" href="${esc(url)}">`);
    //The interface language is chosen by ?lang= (or the browser): one URL per language, the bare one by default
    const languages: Array<{ code?: string }> = Array.isArray(root.languages) ? root.languages : [];
    for (const { code } of languages) {
      if (!code) continue;
      tags.push(`<link rel="alternate" hreflang="${esc(code.toLowerCase())}" href="${esc(withLang(url, code.toLowerCase()))}">`);
    }
    if (languages.length) tags.push(`<link rel="alternate" hreflang="x-default" href="${esc(url)}">`);
  }

  tags.push(meta("property", "og:type", seo.type ?? "website"));
  tags.push(meta("property", "og:site_name", brand));
  tags.push(meta("property", "og:title", title));
  if (description) tags.push(meta("property", "og:description", description));
  if (url) tags.push(meta("property", "og:url", url));
  tags.push(meta("property", "og:locale", OG_LOCALES[lang] ?? lang));
  for (const [code, locale] of Object.entries(OG_LOCALES)) {
    if (code !== lang) tags.push(meta("property", "og:locale:alternate", locale));
  }
  if (image) {
    tags.push(meta("property", "og:image", image));
    tags.push(meta("property", "og:image:width", IMAGE_SIZE));
    tags.push(meta("property", "og:image:height", IMAGE_SIZE));
    tags.push(meta("property", "og:image:alt", title));
  }
  tags.push(meta("name", "twitter:card", image ? "summary_large_image" : "summary"));

  if (seo.jsonLd) {
    const ld = seo.jsonLd.description || !description ? seo.jsonLd : { ...seo.jsonLd, description };
    const json = JSON.stringify(ld).replace(/</g, "\\u003c");
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return new Handlebars.SafeString(tags.join("\n"));
}

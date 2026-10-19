import { NextFunction, Request, Response } from "express";

import { getHost, getVfs } from "./locals.js";
import type Vfs from "../vfs/index.js";
import type { Scene, SceneMeta } from "../vfs/types.js";

/**
 * Huaka: what search engines and link previews (WhatsApp, Facebook, LinkedIn…) read from a page: title,
 * description, image, canonical URL, structured data. Rendered in <head> by the `metaTags` helper
 * (utils/templates/helpers/metaTags.ts), from the `seo` property a route passes to the template.
 * Hooked in by patches/ecorpus/0007.
 *
 * Pages without their own `seo` (lists, collections…) get the site's name and tagline, and the "site image":
 * a capture of a piece chosen by `useSeoDefaults`.
 */
/** A text to translate when rendering, where routes have no i18n: `t(key, params)` in the page language */
export interface SeoText {
  key: string;
  params?: Record<string, unknown>;
}

export interface Seo {
  /** Defaults to the translated page title, then the brand */
  title?: string;
  /** Plain text. Defaults to the site's tagline */
  description?: string | SeoText;
  /** Absolute URL of a capture. Defaults to the site image; null for none (a piece without capture: never another one's) */
  image?: string | null;
  /** Defaults to the canonical URL of the page */
  url?: string;
  type?: "website" | "article";
  /** Keep the page out of search results (private links) */
  noindex?: boolean;
  /** schema.org object, serialized as JSON-LD. Its `description`, when missing, is the page's */
  jsonLd?: Record<string, unknown>;
}

/** Tags that only steer the showcase (routes/views/showcase.ts): never shown as a collection */
const RESERVED_TAGS = ["destacada", "portada"];
/** Voyager's capture, 1280 px square: big enough for large previews, light enough for every network */
export const SHARE_IMAGE = "scene-image-medium.jpg";

const DESCRIPTION_LENGTH = 200;

/** Scene intros are sanitized HTML: keep their text, on one line, cut at a word */
export function plainText(html: string | undefined, max = DESCRIPTION_LENGTH): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, "") + "…";
}

/** A scene's text in the interface language, then in its primary language. Keys are upper case ("ES") */
function localized(dict: Record<string, string> | undefined, primary: string | undefined, lang: string): string | undefined {
  const d = dict ?? {};
  return [d[lang.toUpperCase()], primary ? d[primary] : undefined]
    .find(s => typeof s === "string" && s.trim().length > 0)?.trim();
}

export interface SceneSeoOptions {
  scene: Pick<Scene, "name" | "tags" | "mtime"> & { public_access?: Scene["public_access"] };
  meta: SceneMeta;
  lang: string;
  /** Absolute URL of the folder the scene's files are served from (`https://…/scenes/<name>/`) */
  filesUrl: string;
  /** Whether the scene has its captures */
  captured: boolean;
  /** Absolute URL of the page */
  url: string;
  brand: string;
  noindex?: boolean;
}

/** Title, description, image and structured data of a scene's page or viewer */
export function sceneSeo({ scene, meta, lang, filesUrl, captured, url, brand, noindex }: SceneSeoOptions): Seo {
  const title = localized(meta.titles, meta.primary_language, lang) ?? scene.name;
  const collection = scene.tags.find(tag => !RESERVED_TAGS.includes(tag));
  //A scene without an intro is described by what it is: "<title>, a 3D piece of the collection <collection>"
  const description: string | SeoText = plainText(localized(meta.intros, meta.primary_language, lang))
    || { key: collection ? "huaka.meta.sceneInCollection" : "huaka.meta.scene", params: { title, collection } };
  const image = captured ? new URL(SHARE_IMAGE, filesUrl).toString() : null;
  //Private scenes (listed nowhere, or opened by a secret link) get no structured data: there is nothing to index
  const indexable = !noindex && scene.public_access !== undefined && scene.public_access !== "none";
  return {
    title,
    description,
    image,
    url,
    type: "article",
    noindex,
    jsonLd: indexable ? {
      "@context": "https://schema.org",
      "@type": "3DModel",
      name: title,
      ...(typeof description === "string" ? { description } : {}),
      url,
      ...(image ? { image } : {}),
      inLanguage: lang,
      dateModified: scene.mtime.toISOString(),
      ...(collection ? { isPartOf: { "@type": "Collection", name: collection } } : {}),
      ...(meta.copyright ? { copyrightNotice: plainText(meta.copyright) } : {}),
      publisher: { "@type": "Organization", name: brand },
    } : undefined,
  };
}

/**
 * For a route: the Seo of a scene, from its metadata and captures, in the page language. Needs the template
 * properties (`lang`, `brand`) and `pageUrl` (useSeoDefaults) in `res.locals`.
 * @param options.filesUrl where the scene's files are served, when not under /scenes/<name>/ (a secret link)
 */
export async function sceneSeoFor(req: Request, res: Response, scene: Scene, options: { filesUrl?: string, url?: string, noindex?: boolean } = {}): Promise<Seo> {
  const vfs = getVfs(req);
  const [meta, captured] = await Promise.all([
    vfs.getSceneMeta(scene.name).catch(() => ({} as SceneMeta)),
    vfs.getFileProps({ scene: scene.id, name: SHARE_IMAGE }).then(() => true, () => false),
  ]);
  return sceneSeo({
    scene,
    meta,
    lang: res.locals.lang ?? "en",
    filesUrl: options.filesUrl ?? new URL(`/scenes/${encodeURIComponent(scene.name)}/`, getHost(req)).toString(),
    captured,
    url: options.url ?? res.locals.pageUrl ?? res.locals.canonical,
    brand: res.locals.brand || "eCorpus",
    noindex: options.noindex,
  });
}

/* ---- The site image: a capture of a piece, for pages without one of their own ---- */

const SITE_IMAGE_TTL_MS = 10 * 60 * 1000;
const siteImages = new WeakMap<object, { at: number, image: Promise<string | null> }>();

/**
 * Path of the capture that stands for the whole site: the most recent public piece with a capture among the featured
 * ones (`destacada`), then the hero candidates (`portada`), then all public pieces. Stable between crawls, unlike
 * the showcase's random hero. Null when no public piece has a capture.
 */
export async function findSiteImage(vfs: Vfs): Promise<string | null> {
  const captured = async (scenes: Scene[]) => {
    const candidates = scenes
      .filter(s => !s.archived && s.type === "voyager" && s.public_access !== "none" && s.thumb)
      .sort((a, b) => b.mtime.valueOf() - a.mtime.valueOf());
    for (const s of candidates) {
      const ok = await vfs.getFileProps({ scene: s.id, name: SHARE_IMAGE }).then(() => true, () => false);
      if (ok) return `/scenes/${encodeURIComponent(s.name)}/${SHARE_IMAGE}`;
    }
    return null;
  };
  const tagged = async (tag: string) => {
    const ids = await vfs.getTag(tag, null);
    return (await Promise.all(ids.map(id => vfs.getScene(id).catch(() => null)))).filter((s): s is Scene => !!s);
  };
  return await captured(await tagged("destacada"))
    ?? await captured(await tagged("portada"))
    ?? await captured(await vfs.getScenes(undefined, { limit: 24, orderBy: "mtime", orderDirection: "desc", type: "voyager" }));
}

/**
 * Middleware: set `res.locals.pageUrl`, the absolute URL of the page without its query (eCorpus' `canonical` drops
 * the router's mount point: /scenes/x for /ui/scenes/x), and `res.locals.siteImage` (absolute URL or null), looked
 * up at most every 10 minutes.
 */
export function useSeoDefaults(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  res.locals.pageUrl = new URL(req.originalUrl.split("?")[0], getHost(req)).toString();
  const vfs = getVfs(req);
  let cached = siteImages.get(vfs);
  if (!cached || Date.now() - cached.at > SITE_IMAGE_TTL_MS) {
    cached = { at: Date.now(), image: findSiteImage(vfs).catch(() => null) };
    siteImages.set(vfs, cached);
  }
  cached.image.then(path => {
    res.locals.siteImage = path ? new URL(path, getHost(req)).toString() : null;
    next();
  }, next);
}

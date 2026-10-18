import { Request, Response } from "express";
import { getLocals, getVfs } from "../../utils/locals.js";
import { Scene } from "../../vfs/types.js";

/**
 * Huaka: the public showcase ("vitrina").
 *
 * Shown at /ui/ to anonymous visitors (the home page stays the logged-in dashboard) and at /ui/vitrina/ for
 * everyone. It always lists what an anonymous visitor can read, whoever is logged in, so it doubles as a
 * "view as visitor" page. Hooked into routes/views/index.ts by patches/ecorpus/0005.
 */

/** Scenes carrying this tag are featured. It is not listed as a collection */
export const FEATURED_TAG = "destacada";
/** The hero piece is picked at random among the scenes with this tag (or among all public pieces, when none has it) */
export const HERO_TAG = "portada";
const RESERVED_TAGS = [FEATURED_TAG, HERO_TAG];

const RECENT_LIMIT = 12;
const FEATURED_LIMIT = 6;
const COLLECTIONS_LIMIT = 8;
const COLLECTION_SCENES_LIMIT = 8;
const HERO_POOL_LIMIT = 24;

export interface ShowcaseImage {
  low: string;
  medium: string;
  high: string;
}

export interface ShowcaseCard {
  name: string;
  title: string;
  collection: string | null;
  author: string;
  mtime: Date;
  uri: string;
  viewUri: string;
  /** Voyager's scene captures (640, 1280 and 2560 px), when the scene has them */
  image: ShowcaseImage | null;
  thumb: string | null;
}

/** The sections of the showcase, in page order. Each one gets its own piece on the background stage */
export const STAGE_SECTIONS = ["hero", "featured", "recent", "collections", "about"] as const;
export type StageSection = typeof STAGE_SECTIONS[number];

/**
 * Give each section a different piece with a capture, in page order: the hero keeps its own, then the first unused
 * piece of the section's own list, then any unused one. With fewer pieces than sections, they are reused in order.
 */
export function pickBackdrops(hero: ShowcaseCard | null, lists: Partial<Record<StageSection, ShowcaseCard[]>>): Partial<Record<StageSection, ShowcaseCard>> {
  const all = [hero, ...STAGE_SECTIONS.flatMap(s => lists[s] ?? [])]
    .filter((c): c is ShowcaseCard => !!c?.image)
    .filter((c, i, a) => a.findIndex(o => o.name === c.name) === i);
  const backdrops: Partial<Record<StageSection, ShowcaseCard>> = {};
  if (!all.length) return backdrops;
  const used = new Set<string>();
  let next = 0;
  for (const section of STAGE_SECTIONS) {
    const own = section === "hero" ? (hero?.image ? [hero] : []) : (lists[section] ?? []).filter(c => c.image);
    const card = own.find(c => !used.has(c.name)) ?? all.find(c => !used.has(c.name)) ?? all[next++ % all.length];
    used.add(card.name);
    backdrops[section] = card;
  }
  return backdrops;
}

/**
 * The hero piece: the one asked for (`?pieza=`, the no-script fallback of "Ver otra pieza") when it is in the pool,
 * else a random one. Pieces with a capture are preferred.
 */
export function pickHero(pool: ShowcaseCard[], requested: unknown, random: () => number = Math.random): ShowcaseCard | null {
  const asked = typeof requested === "string" ? pool.find(c => c.name === requested) : undefined;
  if (asked) return asked;
  const withImage = pool.filter(c => c.image);
  const from = withImage.length ? withImage : pool;
  return from.length ? from[Math.floor(random() * from.length) % from.length] : null;
}

export interface ShowcaseCollection {
  name: string;
  size: number;
  uri: string;
  scenes: ShowcaseCard[];
}

/**
 * Pick the scene title in the interface language, then the scene's primary language, then its name.
 * Scene metadata keys languages in upper case ("ES"), the interface in lower case ("es").
 */
export function pickTitle(name: string, titles: Record<string, string> | undefined, primary: string | undefined, lang: string): string {
  const t = titles ?? {};
  return [t[lang.toUpperCase()], primary ? t[primary] : undefined, name]
    .find(s => typeof s === "string" && s.trim().length > 0)!
    .trim();
}

export async function renderShowcase(req: Request, res: Response) {
  const vfs = getVfs(req);
  const lang: string = res.locals.lang ?? "en";
  const cards = new Map<number, ShowcaseCard>();

  async function toCard(scene: Scene): Promise<ShowcaseCard> {
    const cached = cards.get(scene.id);
    if (cached) return cached;
    const base = `/scenes/${encodeURIComponent(scene.name)}/`;
    const [meta, image] = await Promise.all([
      vfs.getSceneMeta(scene.name).catch(() => ({} as Awaited<ReturnType<typeof vfs.getSceneMeta>>)),
      vfs.getFileProps({ scene: scene.id, name: "scene-image-medium.jpg" }).then(
        () => ({ low: base + "scene-image-low.jpg", medium: base + "scene-image-medium.jpg", high: base + "scene-image-high.jpg" }),
        () => null,
      ),
    ]);
    const card: ShowcaseCard = {
      name: scene.name,
      title: pickTitle(scene.name, meta.titles, meta.primary_language, lang),
      collection: scene.tags.find(t => !RESERVED_TAGS.includes(t)) ?? null,
      author: scene.author,
      mtime: scene.mtime,
      uri: `/ui/scenes/${encodeURIComponent(scene.name)}/`,
      viewUri: `/ui/scenes/${encodeURIComponent(scene.name)}/view?lang=${encodeURIComponent(lang)}`,
      image,
      thumb: scene.thumb ? base + encodeURIComponent(scene.thumb) : null,
    };
    cards.set(scene.id, card);
    return card;
  }

  /** Public scenes of a tag, most recent first. getTag(name, null) only returns publicly readable scenes */
  async function tagScenes(tag: string, limit: number): Promise<{ size: number, scenes: ShowcaseCard[] }> {
    const ids = await vfs.getTag(tag, null);
    const scenes = (await Promise.all(ids.map(id => vfs.getScene(id).catch(() => null))))
      .filter((s): s is Scene => !!s && s.public_access !== "none" && s.type === "voyager")
      .sort((a, b) => b.mtime.valueOf() - a.mtime.valueOf());
    return { size: scenes.length, scenes: await Promise.all(scenes.slice(0, limit).map(toCard)) };
  }

  const [recentScenes, featured, heroTagged, tags] = await Promise.all([
    vfs.getScenes(undefined, { limit: RECENT_LIMIT, orderBy: "mtime", orderDirection: "desc", type: "voyager" }),
    tagScenes(FEATURED_TAG, FEATURED_LIMIT),
    tagScenes(HERO_TAG, HERO_POOL_LIMIT),
    vfs.getTags({ limit: COLLECTIONS_LIMIT + RESERVED_TAGS.length }),
  ]);
  const recent = await Promise.all(recentScenes.filter(s => !s.archived).map(toCard));

  const collections: ShowcaseCollection[] = [];
  for (const tag of tags) {
    if (RESERVED_TAGS.includes(tag.name) || collections.length >= COLLECTIONS_LIMIT) continue;
    const { size, scenes } = await tagScenes(tag.name, COLLECTION_SCENES_LIMIT);
    if (size) collections.push({ name: tag.name, size, uri: `/ui/tags/${encodeURIComponent(tag.name)}`, scenes });
  }

  //Pieces tagged for the hero, else every public piece on the page (each once)
  const heroPool = (heroTagged.scenes.length ? heroTagged.scenes : [...featured.scenes, ...recent, ...collections.flatMap(c => c.scenes)])
    .filter((c, i, a) => a.findIndex(o => o.name === c.name) === i)
    .slice(0, HERO_POOL_LIMIT);
  const hero = pickHero(heroPool, req.query.pieza);
  //The others, for "Ver otra pieza": the script swaps the hero without reloading. Dates are formatted here, as
  //dateString would format them in the template
  const heroAlternatives = heroPool.filter(c => c !== hero && c.image).map(c => ({
    name: c.name, title: c.title, collection: c.collection, viewUri: c.viewUri, image: c.image,
    date: c.mtime.toLocaleDateString(lang),
  }));
  const nextHero = heroAlternatives.length ? heroAlternatives[Math.floor(Math.random() * heroAlternatives.length)].name : null;

  const backdrops = pickBackdrops(hero, {
    featured: featured.scenes,
    recent,
    collections: collections.flatMap(c => c.scenes),
  });

  res.render("showcase", {
    layout: "showcase",
    title: "Showcase",
    hero,
    //JSON for a <script type="application/json">: "<" escaped so that no "</script>" can close it
    heroAlternatives: heroAlternatives.length ? JSON.stringify(heroAlternatives).replace(/</g, "\\u003c") : null,
    nextHeroUri: nextHero ? `?pieza=${encodeURIComponent(nextHero)}` : null,
    backdrops,
    featured: featured.scenes,
    recent,
    collections,
    //The default (noreply@<host>) is not an address to write to
    contact_email: /^noreply@/.test(getLocals(req).config.get("contact_email")) ? null : getLocals(req).config.get("contact_email"),
  });
}

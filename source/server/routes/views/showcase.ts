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

const RECENT_LIMIT = 12;
const FEATURED_LIMIT = 6;
const COLLECTIONS_LIMIT = 8;
const COLLECTION_SCENES_LIMIT = 8;

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
      collection: scene.tags.find(t => t !== FEATURED_TAG) ?? null,
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

  const [recentScenes, featured, tags] = await Promise.all([
    vfs.getScenes(undefined, { limit: RECENT_LIMIT, orderBy: "mtime", orderDirection: "desc", type: "voyager" }),
    tagScenes(FEATURED_TAG, FEATURED_LIMIT),
    vfs.getTags({ limit: COLLECTIONS_LIMIT + 1 }),
  ]);
  const recent = await Promise.all(recentScenes.filter(s => !s.archived).map(toCard));

  const collections: ShowcaseCollection[] = [];
  for (const tag of tags) {
    if (tag.name === FEATURED_TAG || collections.length >= COLLECTIONS_LIMIT) continue;
    const { size, scenes } = await tagScenes(tag.name, COLLECTION_SCENES_LIMIT);
    if (size) collections.push({ name: tag.name, size, uri: `/ui/tags/${encodeURIComponent(tag.name)}`, scenes });
  }

  //The hero is the first featured piece with a capture, else the most recent one
  const hero = [...featured.scenes, ...recent].find(c => c.image) ?? featured.scenes[0] ?? recent[0] ?? null;

  res.render("showcase", {
    layout: "showcase",
    title: "Showcase",
    hero,
    featured: featured.scenes,
    recent,
    collections,
    //The default (noreply@<host>) is not an address to write to
    contact_email: /^noreply@/.test(getLocals(req).config.get("contact_email")) ? null : getLocals(req).config.get("contact_email"),
  });
}

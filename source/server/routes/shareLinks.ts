import express, { NextFunction, Request, Response, Router } from "express";

import ShareLinks, { MAX_NAME_LENGTH, ShareLink } from "../utils/shareLinks.js";
import { getHost, getUser, getVfs, policy, useTemplateProperties } from "../utils/locals.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import wrap from "../utils/wrapAsync.js";
import handleGetDocument from "./scenes/scene/files/get/document.js";
import handleGetFile from "./scenes/scene/files/get/file.js";

/**
 * Huaka: routes of the secret links to a private scene (utils/shareLinks.ts).
 * Mounted by patches/ecorpus/0006:
 * - `/compartido/<token>/<file>`: the scene's files, read-only, through eCorpus' own file handlers;
 * - `/ui/compartido/<token>`: the 3D viewer of that scene, pointed at the path above (works embedded too);
 * - `/ui/compartido/escena/<scene>`: create (POST) and revoke (POST …/<id>/revocar), for the scene's administrators.
 */

function shareLinks(req: Request): ShareLinks {
  //The shared pool: there is no other accessor, and opening a second pool for one table would waste connections
  return new ShareLinks(getVfs(req)._db);
}

/** Every response that a link opens is private: no shared cache (Cloudflare) may keep it after a revocation */
function noStore(_req: Request, res: Response, next: NextFunction) {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
}

/** Resolve `:token` into the scene it opens, as the `:scene` parameter the file handlers expect. 404 otherwise */
function resolveToken(req: Request, _res: Response, next: NextFunction) {
  shareLinks(req).resolve(req.params.token).then(share => {
    //Same answer for a malformed, unknown or revoked token: nothing to learn from trying
    if (!share) return next(new NotFoundError(`Can't find the requested resource. It may be private or not exist entirely.`));
    req.params.scene = share.scene_name;
    next();
  }, next);
}

/* ---- Files: GET only, the router answers nothing else ---- */
export const shareFilesRouter = Router();
shareFilesRouter.use(noStore);
shareFilesRouter.get("/:token/:file(*.svx.json)", resolveToken, wrap(handleGetDocument));
shareFilesRouter.get("/:token/:name(*)", resolveToken, wrap(handleGetFile));

/* ---- Viewer and management ---- */
export const shareUiRouter = Router();
shareUiRouter.use(useTemplateProperties);

const sceneUri = (scene: string) => `/ui/scenes/${encodeURIComponent(scene)}`;

shareUiRouter.post("/escena/:scene", policy({ access: "admin" }), express.urlencoded({ extended: false, limit: "4kb" }), wrap(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || MAX_NAME_LENGTH < name.length) throw new BadRequestError(`A link needs a name of 1 to ${MAX_NAME_LENGTH} characters`);
  const scene = await getVfs(req).getScene(req.params.scene);
  const { token } = await shareLinks(req).create(scene.id, name, getUser(req)?.uid ?? null);
  const link = new URL(`/ui/compartido/${token}`, getHost(req)).toString();
  //Shown once: only its hash is stored. Never cached, never indexed
  res.set("Cache-Control", "private, no-store");
  res.render("share/created", {
    layout: "main",
    title: `Share link — ${scene.name}`,
    scene,
    name,
    link,
    embed: `<iframe src="${link}?embed=1" width="800" height="600" style="border:0" allow="fullscreen; xr-spatial-tracking" allowfullscreen></iframe>`,
    settings: `${sceneUri(scene.name)}/settings`,
  });
}));

shareUiRouter.post("/escena/:scene/:id/revocar", policy({ access: "admin" }), wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new BadRequestError(`Bad link id`);
  const scene = await getVfs(req).getScene(req.params.scene);
  await shareLinks(req).revoke(scene.id, id);
  res.redirect(303, `${sceneUri(scene.name)}/settings#enlaces-privados`);
}));

shareUiRouter.get("/:token", noStore, resolveToken, wrap(async (req, res) => {
  res.render("scene/explorer", {
    title: `${req.params.scene}: Explorer`,
    layout: "viewer",
    scene: req.params.scene,
    scenePath: `/compartido/${req.params.token}/`,
    referrer: "",
  });
}));

/** For the scene settings page: the scene's links (patches/ecorpus/0006) */
export async function listShareLinks(req: Request, scene_id: number): Promise<ShareLink[]> {
  return await shareLinks(req).list(scene_id);
}

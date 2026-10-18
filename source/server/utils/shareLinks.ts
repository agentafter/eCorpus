import { hashSecret, makeSecret } from "../auth/Token.js";
import type { DatabaseHandle } from "../vfs/helpers/db.js";

/**
 * Huaka: secret links to a private scene ("enlaces privados").
 *
 * A link gives read-only access to one scene's viewer and files to whoever holds it, without an account, and keeps
 * working embedded in another site. The scene stays private, so it is listed nowhere (showcase, search, tags,
 * sitemap). Links never expire: they last until revoked.
 *
 * Like API tokens (auth/Token.ts), a link is 32 random bytes and only its sha256 is stored: the link is shown once,
 * when created, and can't be recovered afterwards.
 *
 * The table is ours and is created here when missing, outside eCorpus' numbered migrations (a migration of ours
 * would collide with the next upstream one). Routes: routes/shareLinks.ts.
 */

export const SHARE_PREFIX = "ecs";
const shareRe = new RegExp(`^${SHARE_PREFIX}_([-\\w]{43})$`);

/** Last-use timestamps are refreshed at most this often, rather than on every file the viewer loads */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const MAX_NAME_LENGTH = 120;

export interface ShareLink {
  id: number;
  name: string;
  author: string | null;
  created_at: Date;
  last_used_at: Date | null;
}

export interface ResolvedShare {
  id: number;
  scene_id: number;
  scene_name: string;
}

export function formatShareToken(secret: Buffer): string {
  return `${SHARE_PREFIX}_${secret.toString("base64url")}`;
}

/** The 32-byte secret of a well-formed link token, or null */
export function parseShareToken(token: unknown): Buffer | null {
  if (typeof token !== "string") return null;
  const m = shareRe.exec(token);
  if (!m) return null;
  const secret = Buffer.from(m[1], "base64url");
  return secret.length === 32 ? secret : null;
}

const ready = new WeakMap<object, Promise<void>>();

export default class ShareLinks {
  constructor(private db: DatabaseHandle) {}

  /** Create the table once per database handle */
  private init(): Promise<void> {
    let p = ready.get(this.db);
    if (!p) {
      p = this.db.run(`
        CREATE TABLE IF NOT EXISTS huaka_share_links (
          link_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          fk_scene_id BIGINT NOT NULL REFERENCES scenes(scene_id) ON DELETE CASCADE,
          name TEXT NOT NULL CHECK (0 < length(name) AND length(name) <= ${MAX_NAME_LENGTH}),
          hash BYTEA NOT NULL UNIQUE,
          fk_author_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_used_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS huaka_share_links_scene ON huaka_share_links(fk_scene_id);
      `).then(() => undefined);
      p.catch(() => ready.delete(this.db));
      ready.set(this.db, p);
    }
    return p;
  }

  /** Create a link and return its token. This is the only time the token exists in clear */
  async create(scene_id: number, name: string, author_id: number | null): Promise<{ id: number, token: string }> {
    await this.init();
    const secret = makeSecret();
    const row = await this.db.get<{ link_id: number }>(`
      INSERT INTO huaka_share_links (fk_scene_id, name, hash, fk_author_id)
      VALUES ($1, $2, $3, $4)
      RETURNING link_id
    `, [scene_id, name, hashSecret(secret), author_id]);
    return { id: row!.link_id, token: formatShareToken(secret) };
  }

  async list(scene_id: number): Promise<ShareLink[]> {
    await this.init();
    return await this.db.all<ShareLink>(`
      SELECT link_id AS id, name, users.username AS author, created_at, last_used_at
      FROM huaka_share_links
      LEFT JOIN users ON fk_author_id = user_id
      WHERE fk_scene_id = $1
      ORDER BY created_at DESC, link_id DESC
    `, [scene_id]);
  }

  /** Revoke a link of this scene. False if there was none */
  async revoke(scene_id: number, link_id: number): Promise<boolean> {
    await this.init();
    const r = await this.db.run(`DELETE FROM huaka_share_links WHERE fk_scene_id = $1 AND link_id = $2`, [scene_id, link_id]);
    return !!r.changes;
  }

  /**
   * The scene a token opens, or null for a malformed, unknown or revoked token, or an archived scene.
   * The lookup is by sha256 of the secret through a unique index, like API tokens.
   */
  async resolve(token: unknown): Promise<ResolvedShare | null> {
    const secret = parseShareToken(token);
    if (!secret) return null;
    await this.init();
    const row = await this.db.get<ResolvedShare & { last_used_at: Date | null }>(`
      SELECT link_id AS id, scene_id, scene_name, last_used_at
      FROM huaka_share_links
      INNER JOIN scenes ON fk_scene_id = scene_id
      WHERE hash = $1 AND scenes.archived IS NULL
    `, [hashSecret(secret)]);
    if (!row) return null;
    if (!row.last_used_at || Date.now() - row.last_used_at.valueOf() > TOUCH_INTERVAL_MS) {
      await this.db.run(`UPDATE huaka_share_links SET last_used_at = CURRENT_TIMESTAMP WHERE link_id = $1`, [row.id]);
    }
    return { id: row.id, scene_id: row.scene_id, scene_name: row.scene_name };
  }
}

import request from "supertest";
import User from "../../auth/User.js";
import UserManager from "../../auth/UserManager.js";
import Vfs from "../../vfs/index.js";
import { FEATURED_TAG, HERO_TAG, ShowcaseCard, monogram, pickBackdrops, pickHero, pickTitle } from "./showcase.js";

/**
 * Huaka (patches/ecorpus/0005): the public showcase replaces the home page for
 * visitors and is also served at /ui/vitrina/. It must never list a scene that an
 * anonymous visitor cannot read.
 */
describe("Showcase (/ui/ and /ui/vitrina/)", function () {
  let vfs: Vfs, userManager: UserManager, bob: User;

  this.beforeAll(async function () {
    const locals = await createIntegrationContext(this);
    vfs = locals.vfs;
    userManager = locals.userManager;
  });

  this.beforeEach(async function () {
    await resetIntegrationContext(this);
    bob = await userManager.addUser("bob", "12345678", "create");
    const scenes: Array<[string, "read" | "none", string[]]> = [
      ["vasija_publica", "read", ["Corral Redondo"]],
      ["vasija_destacada", "read", [FEATURED_TAG, "Corral Redondo"]],
      ["vasija_privada", "none", [FEATURED_TAG, "Corral Redondo", "Coleccion privada"]],
    ];
    for (const [name, access, tags] of scenes) {
      const id = await vfs.createScene(name, bob.uid);
      await vfs.writeDoc("{}", { scene: id, user_id: bob.uid, name: "scene.svx.json", mime: "application/si-dpo-3d.document+json" });
      await userManager.setPublicAccess(name, access);
      for (const tag of tags) await vfs.addTag(id, tag);
    }
  });

  async function login(server: any) {
    const agent = request.agent(server);
    await agent.post("/auth/login")
      .send({ username: "bob", password: "12345678" })
      .set("Content-Type", "application/json")
      .set("Accept", "")
      .expect(200);
    return agent;
  }

  it("shows the showcase to visitors, with public scenes only", async function () {
    const res = await request(this.server).get("/ui/")
      .set("Accept", "text/html")
      .set("Accept-Language", "es")
      .expect(200);
    expect(res.text).to.include(`data-sc-section="hero"`);
    expect(res.text).to.include("<title>Vitrina — ");
    //"Ver ficha completa" opens the piece's record page, not the viewer; the logo leads to the showcase
    const hero = /data-sc-current="([^"]+)"/.exec(res.text)![1];
    expect(res.text).to.include(`href="/ui/scenes/${encodeURIComponent(hero)}/" data-sc-record>Ver ficha completa</a>`);
    expect(res.text).to.include(`<a class="logo" href="/ui/vitrina/">`);
    expect(res.text).to.include("vasija_publica");
    expect(res.text).to.include("vasija_destacada");
    expect(res.text).not.to.include("vasija_privada");
    expect(res.text).not.to.include("Coleccion privada");
  });

  it("features tagged scenes without listing the tag as a collection", async function () {
    const res = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").expect(200);
    const featured = res.text.slice(res.text.indexOf(`class="sc-feat"`), res.text.indexOf(`class="sc-recent"`));
    expect(featured).to.include("vasija_destacada");
    expect(featured).not.to.include("vasija_publica");
    const collections = res.text.slice(res.text.indexOf(`class="sc-colls"`));
    expect(collections).to.include("Corral Redondo");
    expect(collections).not.to.include(`<span class="sc-bar__name">${FEATURED_TAG}</span>`);
  });

  it("keeps the dashboard as the home page of logged-in users, with a link to the showcase", async function () {
    const agent = await login(this.server);
    const res = await agent.get("/ui/").set("Accept", "text/html").expect(200);
    expect(res.text).not.to.include(`data-sc-section="hero"`);
    expect(res.text).to.include(`href="/ui/vitrina/"`);
  });

  it("shows logged-in users what visitors see", async function () {
    const agent = await login(this.server);
    const res = await agent.get("/ui/vitrina/").set("Accept", "text/html").expect(200);
    expect(res.text).to.include("vasija_publica");
    //bob owns it, but it is not public
    expect(res.text).not.to.include("vasija_privada");
  });

  it("renders when there is nothing public yet", async function () {
    for (const name of ["vasija_publica", "vasija_destacada"]) await userManager.setPublicAccess(name, "none");
    const res = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").expect(200);
    expect(res.text).to.include(`class="sc-empty"`);
    expect(res.text).not.to.include(`class="sc-recent"`);
  });

  it("takes the hero from the scenes tagged for it, and never lists that tag as a collection", async function () {
    await vfs.addTag("vasija_publica", HERO_TAG);
    for (let i = 0; i < 5; i++) {
      const res = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").expect(200);
      expect(res.text).to.include(`data-sc-current="vasija_publica"`);
      expect(res.text).not.to.include(`<span class="sc-bar__name">${HERO_TAG}</span>`);
    }
  });

  it("shows the piece asked for with ?pieza= when it is public, and ignores it otherwise", async function () {
    let res = await request(this.server).get("/ui/vitrina/?pieza=vasija_destacada").set("Accept", "text/html").expect(200);
    expect(res.text).to.include(`data-sc-current="vasija_destacada"`);
    res = await request(this.server).get("/ui/vitrina/?pieza=vasija_privada").set("Accept", "text/html").expect(200);
    //The name still appears in the page's own URL (login link), but the piece is not shown
    expect(res.text).not.to.include(`data-sc-current="vasija_privada"`);
    expect(res.text).not.to.include("/scenes/vasija_privada/");
  });

  it("degrades without captures: no stage, a centred card and named placeholders", async function () {
    const res = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").expect(200);
    //No capture was uploaded in this test: no stage, the hero falls back to the thumbnail or nothing
    expect(res.text).not.to.include(`class="sc-stage"`);
    expect(res.text).to.include(`data-sc-section="hero"`);
    //No empty frames: the hero card is centred and each piece shows its name instead of a photo
    expect(res.text).to.include("sc-hero--bare");
    expect(res.text).to.match(/<span class="sc-ph" aria-hidden="true">VP<\/span>/);
    //"Ver otra pieza" still switches between the pieces without a capture
    expect(res.text).to.include("data-sc-next");
    expect(res.text).to.include(`id="sc-hero-pool"`);
  });

  describe("pickBackdrops()", function () {
    const card = (name: string, image = true) => ({
      name, image: image ? { low: `${name}-l`, medium: `${name}-m`, high: `${name}-h` } : null,
    }) as ShowcaseCard;

    it("uses a different piece per section, the section's own first", function () {
      const [a, b, c, d, e] = ["a", "b", "c", "d", "e"].map(n => card(n));
      const picked = pickBackdrops(a, { featured: [a, b], recent: [b, c], collections: [d, e] });
      expect(Object.keys(picked)).to.deep.equal(["hero", "featured", "recent", "collections", "about"]);
      expect(Object.values(picked).map(c => c!.name)).to.deep.equal(["a", "b", "c", "d", "e"]);
    });

    it("reuses pieces when there are fewer than sections, and skips those without a capture", function () {
      const picked = pickBackdrops(card("a"), { featured: [card("x", false)], recent: [card("b")] });
      expect(Object.values(picked).map(c => c!.name)).to.deep.equal(["a", "b", "a", "b", "a"]);
    });

    it("is empty when no piece has a capture", function () {
      expect(pickBackdrops(card("a", false), { recent: [card("b", false)] })).to.deep.equal({});
    });
  });

  describe("pickHero()", function () {
    const card = (name: string, image = true) => ({ name, image: image ? { low: "", medium: "", high: "" } : null }) as ShowcaseCard;
    it("returns the requested piece when it is in the pool", function () {
      expect(pickHero([card("a"), card("b")], "b", () => 0)!.name).to.equal("b");
    });
    it("otherwise picks at random, preferring pieces with a capture", function () {
      const pool = [card("a", false), card("b"), card("c")];
      expect(pickHero(pool, "zzz", () => 0)!.name).to.equal("b");
      expect(pickHero(pool, undefined, () => 0.99)!.name).to.equal("c");
      expect(pickHero([card("a", false)], undefined, () => 0.5)!.name).to.equal("a");
      expect(pickHero([], undefined)).to.equal(null);
    });
  });

  describe("monogram()", function () {
    it("takes the first letter of the first two words", function () {
      expect(monogram("Urpu decorado")).to.equal("UD");
      expect(monogram("Kero 2")).to.equal("K2");
      expect(monogram("C-067254 - Corral Redondo")).to.equal("C0");
      expect(monogram("ñusta")).to.equal("Ñ");
      expect(monogram("—")).to.equal("·");
    });
  });

  describe("pickTitle()", function () {
    it("prefers the interface language, then the scene's primary language, then the name", function () {
      const titles = { ES: "Cántaro", EN: "Jar" };
      expect(pickTitle("C-1", titles, "EN", "es")).to.equal("Cántaro");
      expect(pickTitle("C-1", titles, "EN", "fr")).to.equal("Jar");
      expect(pickTitle("C-1", { ES: "  " }, undefined, "es")).to.equal("C-1");
      expect(pickTitle("C-1", undefined, undefined, "en")).to.equal("C-1");
    });
  });
});

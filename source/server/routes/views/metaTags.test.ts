import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import User from "../../auth/User.js";
import UserManager from "../../auth/UserManager.js";
import Vfs from "../../vfs/index.js";
import ShareLinks from "../../utils/shareLinks.js";

/**
 * Huaka (patches/ecorpus/0007): description, Open Graph and JSON-LD of every page, for search engines and link
 * previews (WhatsApp, Facebook, LinkedIn…). Crawlers state no language: they must get the Spanish site.
 */
//The site's description is the showcase tagline: read it from es.yml, so that rewording it doesn't break the test
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const esTagline = /^ {4}heroLead: "?(.*?)"?$/m.exec(fs.readFileSync(path.join(thisDir, "../../templates/locales/es.yml"), "utf8"))![1];

describe("Meta tags (utils/seo.ts, metaTags helper)", function () {
  let vfs: Vfs, userManager: UserManager, bob: User;

  this.beforeAll(async function () {
    const locals = await createIntegrationContext(this);
    vfs = locals.vfs;
    userManager = locals.userManager;
  });

  async function addScene(name: string, access: "read" | "none", doc: object, tags: string[], captured: boolean) {
    const id = await vfs.createScene(name, bob.uid);
    await vfs.writeDoc(JSON.stringify(doc), { scene: id, user_id: bob.uid, name: "scene.svx.json", mime: "application/si-dpo-3d.document+json" });
    if (captured) {
      for (const file of ["scene-image-thumb.jpg", "scene-image-medium.jpg"]) {
        await vfs.writeDoc(Buffer.from("jpeg"), { scene: id, user_id: bob.uid, name: file, mime: "image/jpeg" });
      }
    }
    await userManager.setPublicAccess(name, access);
    await userManager.setDefaultAccess(name, access);
    for (const tag of tags) await vfs.addTag(id, tag);
    return id;
  }

  this.beforeEach(async function () {
    await resetIntegrationContext(this);
    bob = await userManager.addUser("bob", "12345678", "create");
    await addScene("kero", "read", { metas: [{ collection: {
      titles: { ES: "Kero ceremonial", EN: "Ceremonial kero" },
      intros: { ES: "<p>Vaso de madera &amp; pigmentos.</p>" },
    } }] }, ["Corral Redondo"], true);
    await addScene("urpu", "read", { metas: [{ collection: { titles: { ES: "Urpu" } } }] }, [], false);
    await addScene("hostil", "read", { metas: [{ collection: { titles: { ES: `Jarra "x" </script><b>` } } }] }, [], false);
  });

  /** The content of a <meta> tag, attribute-decoded */
  function metaOf(html: string, key: string): string | undefined {
    const m = new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)">`).exec(html);
    return m?.[1].replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }
  function jsonLd(html: string): any {
    const m = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);
    return m ? JSON.parse(m[1]) : undefined;
  }

  it("serves Spanish to visitors and crawlers that state no language", async function () {
    const res = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").expect(200);
    expect(res.text).to.include(`<html lang="es">`);
    expect(metaOf(res.text, "description")).to.equal(esTagline);
    expect(metaOf(res.text, "og:locale")).to.equal("es_LA");
    //An explicit preference still wins
    const fr = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").set("Accept-Language", "fr").expect(200);
    expect(fr.text).to.include(`<html lang="fr">`);
    expect(metaOf(fr.text, "og:locale")).to.equal("fr_FR");
  });

  it("describes the showcase with a stable capture and a single URL", async function () {
    for (const path of ["/ui/", "/ui/vitrina/"]) {
      const res = await request(this.server).get(path).set("Accept", "text/html").expect(200);
      expect(metaOf(res.text, "og:title"), path).to.equal("eCorpus");
      expect(metaOf(res.text, "og:url"), path).to.match(/^http:\/\/[^/]+\/ui\/vitrina\/$/);
      expect(res.text, path).to.match(/<link rel="canonical" href="http:\/\/[^/]+\/ui\/vitrina\/">/);
      //The only piece with a capture
      expect(metaOf(res.text, "og:image"), path).to.match(/^http:\/\/[^/]+\/scenes\/kero\/scene-image-medium\.jpg$/);
      expect(metaOf(res.text, "twitter:card"), path).to.equal("summary_large_image");
    }
  });

  it("describes a scene's page from its metadata, with structured data", async function () {
    const res = await request(this.server).get("/ui/scenes/kero").set("Accept", "text/html").expect(200);
    expect(res.text).to.match(/<title>kero — /);
    expect(metaOf(res.text, "og:title")).to.equal("Kero ceremonial");
    expect(metaOf(res.text, "description")).to.equal("Vaso de madera & pigmentos.");
    expect(metaOf(res.text, "og:type")).to.equal("article");
    expect(metaOf(res.text, "og:image")).to.match(/^http:\/\/[^/]+\/scenes\/kero\/scene-image-medium\.jpg$/);
    expect(res.text).to.match(/<link rel="canonical" href="http:\/\/[^/]+\/ui\/scenes\/kero">/);
    expect(res.text).to.match(/<link rel="alternate" hreflang="en" href="http:\/\/[^/]+\/ui\/scenes\/kero\?lang=en">/);
    expect(res.text).to.match(/<link rel="alternate" hreflang="x-default" href="http:\/\/[^/]+\/ui\/scenes\/kero">/);
    const ld = jsonLd(res.text);
    expect(ld).to.include({ "@context": "https://schema.org", "@type": "3DModel", name: "Kero ceremonial", inLanguage: "es" });
    expect(ld.isPartOf).to.deep.equal({ "@type": "Collection", name: "Corral Redondo" });
  });

  it("describes a scene without intro or capture by what it is, without borrowing another image", async function () {
    const res = await request(this.server).get("/ui/scenes/urpu").set("Accept", "text/html").expect(200);
    expect(metaOf(res.text, "description")).to.equal("Urpu: pieza del patrimonio cultural en 3D, en eCorpus.");
    expect(jsonLd(res.text).description).to.equal("Urpu: pieza del patrimonio cultural en 3D, en eCorpus.");
    expect(metaOf(res.text, "og:image")).to.equal(undefined);
    expect(metaOf(res.text, "twitter:card")).to.equal("summary");
  });

  it("gives the viewer absolute image URLs", async function () {
    const res = await request(this.server).get("/ui/scenes/kero/view").set("Accept", "text/html").expect(200);
    expect(metaOf(res.text, "og:image")).to.match(/^http:\/\/[^/]+\/scenes\/kero\/scene-image-medium\.jpg$/);
    expect(res.text).to.match(/<link rel="apple-touch-icon" href="http:\/\/[^/]+\/scenes\/kero\/scene-image-thumb\.jpg">/);
    expect(metaOf(res.text, "og:title")).to.equal("Kero ceremonial");
  });

  it("escapes scene texts in tags and in the JSON-LD", async function () {
    const res = await request(this.server).get("/ui/scenes/hostil").set("Accept", "text/html").expect(200);
    expect(res.text).not.to.include(`</script><b>`);
    expect(res.text).to.include(`content="Jarra &quot;x&quot; &lt;/script&gt;&lt;b&gt;"`);
    expect(jsonLd(res.text).name).to.equal(`Jarra "x" </script><b>`);
  });

  it("shows the piece in a secret link's preview, out of search engines", async function () {
    const id = await addScene("privada", "none", { metas: [{ collection: { titles: { ES: "Pieza reservada" } } }] }, [], true);
    const { token } = await new ShareLinks(vfs._db).create(id, "Museo", bob.uid);
    const res = await request(this.server).get(`/ui/compartido/${token}`).set("Accept", "text/html").expect(200);
    expect(metaOf(res.text, "robots")).to.equal("noindex, nofollow");
    expect(res.text).not.to.match(/rel="canonical"/);
    expect(jsonLd(res.text)).to.equal(undefined);
    expect(metaOf(res.text, "og:title")).to.equal("Pieza reservada");
    expect(metaOf(res.text, "og:url")).to.match(new RegExp(`/ui/compartido/${token}$`));
    //Read through the link: the scene's own path is private
    expect(metaOf(res.text, "og:image")).to.match(new RegExp(`/compartido/${token}/scene-image-medium\\.jpg$`));
    await request(this.server).get(new URL(metaOf(res.text, "og:image")!).pathname).expect(200);
  });

  it("gives other pages the site's capture", async function () {
    const res = await request(this.server).get("/ui/tags/").set("Accept", "text/html").expect(200);
    expect(metaOf(res.text, "og:image")).to.match(/\/scenes\/kero\/scene-image-medium\.jpg$/);
    expect(metaOf(res.text, "og:title")).to.match(/ — eCorpus$/);
  });

  it("lists the showcase in the sitemap", async function () {
    const res = await request(this.server).get("/sitemap.xml").expect(200);
    expect(res.text).to.match(/<loc>http:\/\/[^<]+\/ui\/vitrina\/<\/loc>/);
  });
});

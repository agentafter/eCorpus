import request from "supertest";
import User from "../auth/User.js";
import UserManager from "../auth/UserManager.js";
import Vfs from "../vfs/index.js";
import { formatShareToken, parseShareToken } from "../utils/shareLinks.js";

/**
 * Huaka (patches/ecorpus/0006): secret links to a private scene.
 */
describe("Share links (/ui/compartido, /compartido)", function () {
  let vfs: Vfs, userManager: UserManager, bob: User, oscar: User;

  this.beforeAll(async function () {
    const locals = await createIntegrationContext(this);
    vfs = locals.vfs;
    userManager = locals.userManager;
  });

  this.beforeEach(async function () {
    await resetIntegrationContext(this);
    bob = await userManager.addUser("bob", "12345678", "create");
    oscar = await userManager.addUser("oscar", "12345678", "create");
    for (const name of ["privada", "otra"]) {
      const id = await vfs.createScene(name, bob.uid);
      await vfs.writeDoc(`{"asset":{"version":"1.0"},"note":"${name}"}`, { scene: id, user_id: bob.uid, name: "scene.svx.json", mime: "application/si-dpo-3d.document+json" });
      await vfs.writeDoc(`<p>${name}</p>`, { scene: id, user_id: bob.uid, name: "articles/a.html", mime: "text/html" });
      await userManager.setPublicAccess(name, "none");
      await userManager.setDefaultAccess(name, "none");
    }
  });

  async function login(server: any, username: string) {
    const agent = request.agent(server);
    await agent.post("/auth/login")
      .send({ username, password: "12345678" })
      .set("Content-Type", "application/json")
      .set("Accept", "")
      .expect(200);
    return agent;
  }

  /** Create a link as bob and return its token, read from the page that shows it once */
  async function createLink(server: any, scene = "privada", name = "Museo"): Promise<string> {
    const agent = await login(server, "bob");
    const res = await agent.post(`/ui/compartido/escena/${scene}`)
      .type("form").send({ name })
      .set("Accept", "text/html")
      .expect(200);
    expect(res.get("Cache-Control")).to.include("no-store");
    const m = /\/ui\/compartido\/(ecs_[-\w]{43})/.exec(res.text);
    expect(m, "the created link is shown").to.be.ok;
    return m![1];
  }

  it("opens a private scene's viewer and files, read-only and uncached", async function () {
    const token = await createLink(this.server);
    //Without the link, the scene stays private
    await request(this.server).get("/scenes/privada/scene.svx.json").expect(404);

    const page = await request(this.server).get(`/ui/compartido/${token}`).set("Accept", "text/html").expect(200);
    expect(page.text).to.include(`root="/compartido/${token}/"`);
    expect(page.get("X-Robots-Tag")).to.include("noindex");

    const doc = await request(this.server).get(`/compartido/${token}/scene.svx.json`).expect(200);
    expect(doc.body.note).to.equal("privada");
    expect(doc.get("Cache-Control")).to.include("no-store");
    const article = await request(this.server).get(`/compartido/${token}/articles/a.html`).expect(200);
    expect(article.text).to.equal("<p>privada</p>");
    expect(article.get("Cache-Control")).to.include("no-store");

    //Read-only: nothing but GET is routed
    for (const method of ["put", "post", "delete", "patch"] as const) {
      await request(this.server)[method](`/compartido/${token}/scene.svx.json`).send("{}").expect(404);
    }
  });

  it("gives access to its own scene only", async function () {
    const token = await createLink(this.server);
    const res = await request(this.server).get(`/compartido/${token}/scene.svx.json`).expect(200);
    expect(res.body.note).to.equal("privada");
    //Paths are looked up inside the linked scene: ".." can't reach another one. (eCorpus answers any *.svx.json
    //name with the scene's own document, so these may be 200, but always with "privada"'s content)
    for (const path of ["../otra/scene.svx.json", "%2e%2e%2fotra/scene.svx.json", "../otra/articles/a.html", "%2e%2e%2fotra%2farticles%2fa.html"]) {
      const r = await request(this.server).get(`/compartido/${token}/${path}`);
      //(a 404 message echoes the path, so look for the other scene's content, not its name)
      expect(r.text, path).not.to.include("<p>otra</p>");
      expect(r.text, path).not.to.include(`"note":"otra"`);
    }
    await request(this.server).get(`/scenes/otra/scene.svx.json`).expect(404);
  });

  it("answers 404 for unknown, malformed or revoked links, and for archived scenes", async function () {
    await request(this.server).get(`/ui/compartido/${formatShareToken(Buffer.alloc(32, 7))}`).expect(404);
    await request(this.server).get(`/compartido/ecs_nope/scene.svx.json`).expect(404);
    await request(this.server).get(`/compartido/ec_${"a".repeat(43)}/scene.svx.json`).expect(404);

    const token = await createLink(this.server);
    const agent = await login(this.server, "bob");
    let settings = await agent.get("/ui/scenes/privada/settings").set("Accept", "text/html").expect(200);
    const id = /\/ui\/compartido\/escena\/privada\/(\d+)\/revocar/.exec(settings.text)![1];
    await agent.post(`/ui/compartido/escena/privada/${id}/revocar`).expect(303);
    await request(this.server).get(`/compartido/${token}/scene.svx.json`).expect(404);
    await request(this.server).get(`/ui/compartido/${token}`).expect(404);

    const other = await createLink(this.server);
    await vfs.archiveScene("privada");
    await request(this.server).get(`/compartido/${other}/scene.svx.json`).expect(404);
  });

  it("lists the scene's links in its settings, never their token", async function () {
    const token = await createLink(this.server, "privada", "Revisor externo");
    const agent = await login(this.server, "bob");
    const settings = await agent.get("/ui/scenes/privada/settings").set("Accept", "text/html").expect(200);
    expect(settings.text).to.include("Revisor externo");
    expect(settings.text).to.include(`id="enlaces-privados"`);
    expect(settings.text).not.to.include(token);
    expect(settings.text).not.to.include(token.slice(4));
  });

  it("lets only the scene's administrators create or revoke links", async function () {
    await request(this.server).post("/ui/compartido/escena/privada").type("form").send({ name: "x" }).expect(404);
    const intruder = await login(this.server, "oscar");
    await intruder.post("/ui/compartido/escena/privada").type("form").send({ name: "x" }).expect(404);
    await intruder.post("/ui/compartido/escena/privada/1/revocar").expect(404);
    //A cross-site form post with bob's session is rejected
    const agent = await login(this.server, "bob");
    await agent.post("/ui/compartido/escena/privada").type("form").send({ name: "x" })
      .set("Sec-Fetch-Site", "cross-site").expect(403);
    //Names are required and bounded
    await agent.post("/ui/compartido/escena/privada").type("form").send({ name: "  " }).expect(400);
    await agent.post("/ui/compartido/escena/privada").type("form").send({ name: "n".repeat(121) }).expect(400);
  });

  it("parses only well-formed tokens", function () {
    const token = formatShareToken(Buffer.alloc(32, 1));
    expect(parseShareToken(token)).to.deep.equal(Buffer.alloc(32, 1));
    expect(parseShareToken(token.replace("ecs_", "ec_"))).to.equal(null);
    expect(parseShareToken(token + "x")).to.equal(null);
    expect(parseShareToken(undefined)).to.equal(null);
  });
});

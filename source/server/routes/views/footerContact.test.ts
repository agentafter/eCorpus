import request from "supertest";

/**
 * Huaka (patches/ecorpus/0008): the footer's "report a bug" link writes to the deployment's contact
 * (CONTACT_EMAIL), never to Holusion. Without a real address (the default noreply@<host>), there is no link.
 */
describe("Footer contact (partials/footer.hbs)", function () {
  const mailto = (html: string) => [...html.matchAll(/href="mailto:([^"]*)"/g)].map(m => m[1]);

  describe("with CONTACT_EMAIL", function () {
    this.beforeAll(async function () {
      await createIntegrationContext(this, { CONTACT_EMAIL: "contacto@example.com" });
    });

    it("links the footer and the showcase to the contact address", async function () {
      const res = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").expect(200);
      expect(res.text).to.include(`href="mailto:contacto@example.com">reportar un error</a>`);
      //Footer and showcase letter ("Escríbanos")
      expect(mailto(res.text)).to.deep.equal(["contacto@example.com", "contacto@example.com"]);
      expect(res.text).not.to.include("holusion.com");
    });
  });

  describe("without CONTACT_EMAIL", function () {
    this.beforeAll(async function () {
      await createIntegrationContext(this);
    });

    it("shows no mail link at all", async function () {
      const res = await request(this.server).get("/ui/vitrina/").set("Accept", "text/html").expect(200);
      expect(mailto(res.text)).to.deep.equal([]);
      expect(res.text).not.to.include("reportar un error");
    });
  });
});

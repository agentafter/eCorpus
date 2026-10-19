import { plainText, sceneSeo, SceneSeoOptions } from "./seo.js";

/**
 * Huaka (patches/ecorpus/0007): what search engines and link previews read.
 */
describe("seo", function () {
  describe("plainText()", function () {
    it("keeps the text of an intro, on one line", function () {
      expect(plainText("<p>Vaso de <b>madera</b> &amp; pigmentos.</p>\n<p>Siglo XVI</p>")).to.equal("Vaso de madera & pigmentos. Siglo XVI");
      expect(plainText(undefined)).to.equal("");
      expect(plainText("<p> </p>")).to.equal("");
    });

    it("cuts a long text at a word", function () {
      const text = plainText("palabra ".repeat(60), 50);
      expect(text.length).to.be.at.most(50);
      expect(text).to.match(/palabra…$/);
    });
  });

  describe("sceneSeo()", function () {
    const base: SceneSeoOptions = {
      scene: { name: "C-1", tags: ["destacada", "Corral Redondo"], mtime: new Date("2026-10-01T00:00:00Z"), public_access: "read" },
      meta: { titles: { EN: "Jar", ES: "Cántaro" }, intros: { ES: "<p>Un cántaro.</p>" }, primary_language: "EN" },
      lang: "es",
      filesUrl: "https://example.com/scenes/C-1/",
      captured: true,
      url: "https://example.com/ui/scenes/C-1",
      brand: "Qullqa 3D",
    };

    it("describes a public scene in the page language", function () {
      const seo = sceneSeo(base);
      expect(seo.title).to.equal("Cántaro");
      expect(seo.description).to.equal("Un cántaro.");
      expect(seo.image).to.equal("https://example.com/scenes/C-1/scene-image-medium.jpg");
      expect(seo.noindex).not.to.be.ok;
      expect(seo.jsonLd).to.include({ "@type": "3DModel", name: "Cántaro", description: "Un cántaro.", inLanguage: "es" });
      //The showcase's own tags are not collections
      expect(seo.jsonLd!.isPartOf).to.deep.equal({ "@type": "Collection", name: "Corral Redondo" });
    });

    it("falls back to the primary language, then to the scene's name", function () {
      expect(sceneSeo({ ...base, lang: "fr" }).title).to.equal("Jar");
      expect(sceneSeo({ ...base, meta: {} }).title).to.equal("C-1");
    });

    it("describes a scene without intro by its title and collection, translated when rendered", function () {
      expect(sceneSeo({ ...base, meta: { titles: { ES: "Cántaro" } } }).description).to.deep.equal({
        key: "huaka.meta.sceneInCollection",
        params: { title: "Cántaro", collection: "Corral Redondo" },
      });
      const lone = sceneSeo({ ...base, scene: { ...base.scene, tags: ["portada"] }, meta: {} });
      expect(lone.description).to.deep.include({ key: "huaka.meta.scene" });
    });

    it("gives no image to a scene without captures (not another piece's)", function () {
      expect(sceneSeo({ ...base, captured: false }).image).to.equal(null);
    });

    it("gives no structured data to private scenes or secret links", function () {
      expect(sceneSeo({ ...base, scene: { ...base.scene, public_access: "none" } }).jsonLd).to.equal(undefined);
      const shared = sceneSeo({ ...base, noindex: true });
      expect(shared.noindex).to.equal(true);
      expect(shared.jsonLd).to.equal(undefined);
    });
  });
});

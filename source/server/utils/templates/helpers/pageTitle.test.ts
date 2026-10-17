import i18next from "i18next";
import { pageTitle, translatePageTitle } from "./pageTitle.js";

describe("pageTitle helper", function () {
  const dict = {
    "Home": "Inicio",
    "Settings — {{name}}": "Configuración — {{name}}",
    "{{name}}: Explorer": "{{name}}: Visor",
    "eCorpus: History of {{name}}": "Historial de {{name}}",
    "Task #{{id}} — {{type}}": "Tarea #{{id}} — {{type}}",
  };

  describe("translatePageTitle()", function () {
    it("translates exact titles", function () {
      expect(translatePageTitle("Home", dict)).to.equal("Inicio");
    });

    it("translates patterns", function () {
      expect(translatePageTitle("Settings — Kero", dict)).to.equal("Configuración — Kero");
      expect(translatePageTitle("Kero: Explorer", dict)).to.equal("Kero: Visor");
      expect(translatePageTitle("eCorpus: History of Kero", dict)).to.equal("Historial de Kero");
      expect(translatePageTitle("Task #12 — createSceneFromFiles", dict)).to.equal("Tarea #12 — createSceneFromFiles");
    });

    it("keeps names with special characters", function () {
      expect(translatePageTitle("Settings — a.b (c) [d]", dict)).to.equal("Configuración — a.b (c) [d]");
    });

    it("returns unknown titles unchanged", function () {
      expect(translatePageTitle("Some new page", dict)).to.equal("Some new page");
      expect(translatePageTitle("Home", {})).to.equal("Home");
    });
  });

  describe("i18next engine behavior", function () {
    let t: (...a: any[]) => any;
    const missing: string[] = [];

    before(async function () {
      const instance = i18next.createInstance();
      await instance.init({
        fallbackLng: "en",
        saveMissing: true,
        missingKeyHandler(lngs, ns, key) { missing.push(key); },
        resources: {
          en: { translation: { huaka: { pageTitles: {} } } },
          es: { translation: { huaka: { pageTitles: dict } } },
        },
      });
      t = instance.t as any;
    });

    const opts = (lang: string) => ({ hash: {}, data: { t, root: { lang } } }) as any;

    it("translates with the context language", function () {
      expect(pageTitle.call({}, "Settings — Kero", opts("es"))).to.equal("Configuración — Kero");
      expect(pageTitle.call({}, "Home", opts("es"))).to.equal("Inicio");
    });

    it("keeps dictionary keys that contain \":\"", function () {
      expect(pageTitle.call({}, "Kero: Explorer", opts("es"))).to.equal("Kero: Visor");
      expect(pageTitle.call({}, "eCorpus: History of Kero", opts("es"))).to.equal("Historial de Kero");
      expect(missing).to.deep.equal([]);
    });

    it("leaves titles as they are when the language has no entries", function () {
      expect(pageTitle.call({}, "Settings — Kero", opts("en"))).to.equal("Settings — Kero");
      expect(pageTitle.call({}, "Kero: Explorer", opts("en"))).to.equal("Kero: Explorer");
      expect(missing).to.deep.equal([]);
    });

    it("passes non-string titles through", function () {
      expect(pageTitle.call({}, undefined, opts("es"))).to.equal(undefined);
    });
  });
});

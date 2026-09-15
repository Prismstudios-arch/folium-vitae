import { ToxicityLevel } from "@domain/plant";
import {
  normaliseName,
  genusOf,
  lookupCareGuide,
  getCareGuide,
  searchCareGuides,
  careDatabaseStats,
} from "./careDatabase";

describe("careDatabase", () => {
  describe("normaliseName", () => {
    it("strips the naming authority", () => {
      expect(normaliseName("Monstera deliciosa Liebm.")).toBe("monstera deliciosa");
    });

    it("strips cultivar names", () => {
      expect(normaliseName("Monstera deliciosa 'Thai Constellation'")).toBe("monstera deliciosa");
    });

    it("strips infraspecific ranks", () => {
      expect(normaliseName("Monstera deliciosa var. borsigiana")).toBe("monstera deliciosa");
    });

    it("keeps genus and species only", () => {
      expect(normaliseName("Ficus elastica Roxb. ex Hornem.")).toBe("ficus elastica");
    });

    // Hybrids come back as "Alocasia × amazonica" or "Mentha x piperita".
    it("drops hybrid signs", () => {
      expect(normaliseName("Alocasia × amazonica")).toBe("alocasia amazonica");
      expect(normaliseName("Mentha x piperita")).toBe("mentha piperita");
    });

    it("keeps hyphenated epithets whole", () => {
      expect(normaliseName("Hibiscus rosa-sinensis L.")).toBe("hibiscus rosa-sinensis");
    });

    it("extracts the genus", () => {
      expect(genusOf("Monstera deliciosa Liebm.")).toBe("monstera");
    });
  });

  describe("lookupCareGuide", () => {
    // These are the forms a provider actually returns. Before this change the
    // lookup was an exact string match and every one of them missed.
    it("matches a name carrying an authority", () => {
      const result = lookupCareGuide("Monstera deliciosa Liebm.");

      expect(result).not.toBeNull();
      expect(result!.matchedAt).toBe("species");
      expect(result!.guide.scientificName).toBe("Monstera deliciosa");
    });

    it("matches a cultivar to its species", () => {
      const result = lookupCareGuide("Monstera deliciosa 'Thai Constellation'");

      expect(result!.matchedAt).toBe("species");
      expect(result!.guide.id).toBe("monstera-deliciosa");
    });

    it("resolves a reclassified name through synonyms", () => {
      // Sansevieria trifasciata is now Dracaena trifasciata. A record filed
      // under either name has to answer to both.
      expect(lookupCareGuide("Dracaena trifasciata")!.guide.id).toBe("dracaena-trifasciata");
      expect(lookupCareGuide("Sansevieria trifasciata")!.guide.id).toBe("dracaena-trifasciata");
    });

    it("resolves pothos through its several old genera", () => {
      for (const name of ["Epipremnum aureum", "Scindapsus aureus", "Pothos aureus"]) {
        expect(lookupCareGuide(name)!.guide.id).toBe("epipremnum-aureum");
      }
    });

    it("answers to the old Calathea names, for species and for the genus", () => {
      expect(lookupCareGuide("Calathea orbifolia")!.guide.id).toBe("goeppertia-orbifolia");

      const unlisted = lookupCareGuide("Calathea zebrina");
      expect(unlisted!.matchedAt).toBe("genus");
      expect(unlisted!.guide.id).toBe("genus-goeppertia");
    });

    it("matches a hybrid written with a multiplication sign", () => {
      expect(lookupCareGuide("Alocasia × amazonica")!.guide.id).toBe("alocasia-amazonica");
    });

    it("sends Haworthia names to their new genus", () => {
      expect(lookupCareGuide("Haworthia attenuata")!.guide.id).toBe("haworthiopsis-attenuata");
      expect(lookupCareGuide("Haworthia cooperi")!.guide.id).toBe("genus-haworthiopsis");
    });

    it("falls back to genus for an unknown species", () => {
      const result = lookupCareGuide("Monstera dubia");

      expect(result).not.toBeNull();
      expect(result!.matchedAt).toBe("genus");
      expect(result!.guide.confidence).toBe("genus");
    });

    it("flags genus matches so the UI does not imply species-specific advice", () => {
      expect(lookupCareGuide("Ficus microcarpa")!.matchedAt).toBe("genus");
      expect(lookupCareGuide("Ficus elastica")!.matchedAt).toBe("species");
    });

    // Inventing care advice for an unknown plant is how people lose expensive
    // plants. Returning nothing is the correct behaviour.
    it("returns null for a genus we have nothing for", () => {
      expect(lookupCareGuide("Welwitschia mirabilis")).toBeNull();
    });

    it("reports records that nobody has reviewed", () => {
      const result = lookupCareGuide("Monstera deliciosa");

      // Every record is currently unreviewed, and says so rather than
      // carrying a fabricated reviewer credit.
      expect(result!.unreviewed).toBe(true);
      expect(result!.guide.reviewedBy).toBeUndefined();
    });

    // The one warning that has to be right: lilies kill cats.
    it("rates lilies as severe for cats", () => {
      const lily = lookupCareGuide("Lilium longiflorum")!;

      expect(lily.guide.toxicity.cats).toBe(ToxicityLevel.Severe);
      expect(lily.guide.sources.map((source) => source.id)).toContain("aspca-cats");
    });

    it("resolves cited sources to something a person can open", () => {
      const { sources } = lookupCareGuide("Monstera deliciosa")!.guide;

      expect(sources.map((source) => source.id)).toEqual(["aspca-cats", "aspca-dogs"]);
      for (const source of sources) {
        expect(source.url).toMatch(/^https:\/\/www\.aspca\.org\//);
        expect(source.covers).toBe("toxicity");
      }
    });

    it("carries seasonal watering and troubleshooting", () => {
      const { guide } = lookupCareGuide("Ficus lyrata")!;

      expect(guide.water.growingSeason).toBeTruthy();
      expect(guide.water.restingSeason).toBeTruthy();
      expect(guide.problems.length).toBeGreaterThan(0);
      expect(guide.problems[0]).toEqual(
        expect.objectContaining({ symptom: expect.any(String), cause: expect.any(String), fix: expect.any(String) })
      );
    });
  });

  describe("getCareGuide", () => {
    it("still resolves for existing callers", () => {
      expect(getCareGuide("Ficus elastica")?.scientificName).toBe("Ficus elastica");
      expect(getCareGuide("Welwitschia mirabilis")).toBeNull();
    });
  });

  describe("searchCareGuides", () => {
    it("finds by common name", () => {
      expect(searchCareGuides("snake plant")[0].id).toBe("dracaena-trifasciata");
    });

    it("finds by an old scientific name", () => {
      expect(searchCareGuides("sansevieria")[0].id).toBe("dracaena-trifasciata");
    });

    it("returns nothing for an empty query rather than everything", () => {
      expect(searchCareGuides("   ")).toHaveLength(0);
    });
  });

  describe("careDatabaseStats", () => {
    it("reports how much of the library is filled in, honestly", () => {
      const stats = careDatabaseStats();

      expect(stats.species).toBeGreaterThan(100);
      expect(stats.genera).toBeGreaterThan(50);
      // Toxicity is checked against the ASPCA for many records; nothing has
      // been reviewed by a horticulturist yet.
      expect(stats.reviewed).toBe(0);
      expect(stats.withSources).toBeGreaterThan(0);
      expect(stats.withSources).toBeLessThan(stats.species);
    });
  });
});

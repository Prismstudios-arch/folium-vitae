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
      expect(normaliseName("Monstera deliciosa 'Thai Constellation'")).toBe(
        "monstera deliciosa"
      );
    });

    it("strips infraspecific ranks", () => {
      expect(normaliseName("Monstera deliciosa var. borsigiana")).toBe("monstera deliciosa");
    });

    it("keeps genus and species only", () => {
      expect(normaliseName("Ficus elastica Roxb. ex Hornem.")).toBe("ficus elastica");
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
      const current = lookupCareGuide("Dracaena trifasciata");
      const legacy = lookupCareGuide("Sansevieria trifasciata");

      expect(current!.guide.id).toBe("dracaena-trifasciata");
      expect(legacy!.guide.id).toBe("dracaena-trifasciata");
    });

    it("resolves pothos through its several old genera", () => {
      for (const name of ["Epipremnum aureum", "Scindapsus aureus", "Pothos aureus"]) {
        expect(lookupCareGuide(name)!.guide.id).toBe("epipremnum-aureum");
      }
    });

    it("falls back to genus for an unknown species", () => {
      const result = lookupCareGuide("Monstera adansonii");

      expect(result).not.toBeNull();
      expect(result!.matchedAt).toBe("genus");
      expect(result!.guide.confidence).toBe("genus");
    });

    it("flags genus matches so the UI does not imply species-specific advice", () => {
      expect(lookupCareGuide("Ficus benjamina")!.matchedAt).toBe("genus");
      expect(lookupCareGuide("Ficus elastica")!.matchedAt).toBe("species");
    });

    // Inventing care advice for an unknown plant is how people lose expensive
    // plants. Returning nothing is the correct behaviour.
    it("returns null for a genus we have nothing for", () => {
      expect(lookupCareGuide("Welwitschia mirabilis")).toBeNull();
    });

    it("reports records that nobody has reviewed", () => {
      const result = lookupCareGuide("Monstera deliciosa");

      // Every seeded record is currently unreviewed, and says so rather than
      // carrying a fabricated reviewer credit.
      expect(result!.unreviewed).toBe(true);
      expect(result!.guide.reviewedBy).toBeUndefined();
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
    it("reports how much of the database is actually filled in", () => {
      const stats = careDatabaseStats();

      expect(stats.species).toBeGreaterThan(0);
      expect(stats.genera).toBeGreaterThan(0);
      // Honest accounting: nothing is reviewed or sourced yet.
      expect(stats.reviewed).toBe(0);
      expect(stats.withSources).toBe(0);
    });
  });
});

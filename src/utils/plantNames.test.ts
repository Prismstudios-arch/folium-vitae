import { formatCommonName } from "./plantNames";

describe("formatCommonName", () => {
  it("capitalises each word of a lower-case name", () => {
    expect(formatCommonName("majestic prayer plant")).toBe("Majestic Prayer Plant");
  });

  it("keeps joining words lower case inside a name", () => {
    expect(formatCommonName("rose of sharon")).toBe("Rose of Sharon");
  });

  it("capitalises a joining word that starts the name", () => {
    expect(formatCommonName("the president")).toBe("The President");
  });

  it("leaves existing capitals and hyphenated parts alone", () => {
    expect(formatCommonName("ZZ plant")).toBe("ZZ Plant");
    expect(formatCommonName("mother-in-law's tongue")).toBe("Mother-in-law's Tongue");
  });

  it("tidies stray whitespace", () => {
    expect(formatCommonName("  peace   lily ")).toBe("Peace Lily");
  });
});

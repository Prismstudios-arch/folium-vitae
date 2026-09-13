import {
  toGrayscale,
  laplacianVariance,
  meanLuminance,
  clippedHighlightRatio,
  classifyLight,
  analyseGrayscale,
  LightLevel,
  SHARPNESS_THRESHOLD,
} from "./imageAnalysis";

// ---------------------------------------------------------------------------
// Synthetic frames. Building images with known properties is what makes these
// assertions meaningful — a checkerboard genuinely is the sharpest possible
// image at a given size, and a flat field genuinely has no edges at all.
// ---------------------------------------------------------------------------

function flat(value: number, width: number, height: number): Float32Array {
  return new Float32Array(width * height).fill(value);
}

/** Alternating single pixels — maximum edge energy. */
function checkerboard(width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      gray[y * width + x] = (x + y) % 2 === 0 ? 0 : 255;
    }
  }
  return gray;
}

/** Smooth left-to-right ramp — the second derivative is ~0 everywhere. */
function gradient(width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      gray[y * width + x] = (x / (width - 1)) * 255;
    }
  }
  return gray;
}

describe("imageAnalysis", () => {
  describe("toGrayscale", () => {
    it("weights green most, per Rec. 601 luma", () => {
      // Pure red, pure green, pure blue, white.
      const rgba = new Uint8Array([
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 0, 255, 255,
        255, 255, 255, 255,
      ]);

      const gray = toGrayscale(rgba, 4);

      expect(gray[0]).toBeCloseTo(76.245, 2); // 0.299 * 255
      expect(gray[1]).toBeCloseTo(149.685, 2); // 0.587 * 255
      expect(gray[2]).toBeCloseTo(29.07, 2); // 0.114 * 255
      expect(gray[3]).toBeCloseTo(255, 2);

      // Green must read brighter than red, which must read brighter than blue.
      expect(gray[1]).toBeGreaterThan(gray[0]);
      expect(gray[0]).toBeGreaterThan(gray[2]);
    });
  });

  describe("laplacianVariance", () => {
    it("is zero for a flat field — no edges at all", () => {
      expect(laplacianVariance(flat(128, 16, 16), 16, 16)).toBe(0);
    });

    it("is near zero for a smooth gradient", () => {
      // A linear ramp has a constant first derivative and therefore a second
      // derivative of zero. This is the case a naive contrast-based blur
      // check gets wrong: high contrast, no detail.
      expect(laplacianVariance(gradient(32, 32), 32, 32)).toBeLessThan(1);
    });

    it("is high for a checkerboard — maximum detail", () => {
      expect(laplacianVariance(checkerboard(32, 32), 32, 32)).toBeGreaterThan(10_000);
    });

    it("ranks sharper images above blurrier ones", () => {
      const sharp = laplacianVariance(checkerboard(32, 32), 32, 32);
      const blurry = laplacianVariance(gradient(32, 32), 32, 32);

      expect(sharp).toBeGreaterThan(blurry);
    });

    it("returns 0 rather than throwing on an image with no interior", () => {
      expect(laplacianVariance(flat(128, 2, 2), 2, 2)).toBe(0);
      expect(laplacianVariance(new Float32Array(0), 0, 0)).toBe(0);
    });
  });

  describe("meanLuminance", () => {
    it("averages the frame", () => {
      expect(meanLuminance(flat(100, 8, 8))).toBe(100);
      expect(meanLuminance(gradient(3, 1))).toBeCloseTo(127.5, 1);
    });

    it("returns 0 for an empty frame instead of NaN", () => {
      expect(meanLuminance(new Float32Array(0))).toBe(0);
    });
  });

  describe("clippedHighlightRatio", () => {
    it("counts pixels at the top of the range", () => {
      const gray = new Float32Array([255, 255, 0, 0]);
      expect(clippedHighlightRatio(gray)).toBe(0.5);
    });

    it("is zero for a mid-grey frame", () => {
      expect(clippedHighlightRatio(flat(128, 8, 8))).toBe(0);
    });
  });

  describe("classifyLight", () => {
    it("flags a dark frame", () => {
      expect(classifyLight(20, 0)).toBe(LightLevel.TooDark);
    });

    it("flags a dim frame separately from a dark one", () => {
      expect(classifyLight(55, 0)).toBe(LightLevel.Low);
    });

    it("accepts a well-exposed frame", () => {
      expect(classifyLight(140, 0.01)).toBe(LightLevel.Good);
    });

    it("flags blown-out highlights even when the mean looks fine", () => {
      // The backlit-window case: plenty of light on average, subject in
      // silhouette. Mean alone would call this good.
      expect(classifyLight(140, 0.4)).toBe(LightLevel.BlownOut);
    });
  });

  describe("analyseGrayscale", () => {
    it("calls a detailed frame sharp", () => {
      const result = analyseGrayscale(checkerboard(32, 32), 32, 32);

      expect(result.isBlurry).toBe(false);
      expect(result.sharpness).toBeGreaterThan(SHARPNESS_THRESHOLD);
    });

    it("calls a featureless frame blurry", () => {
      const result = analyseGrayscale(gradient(32, 32), 32, 32);

      expect(result.isBlurry).toBe(true);
      expect(result.sharpness).toBeLessThan(SHARPNESS_THRESHOLD);
    });

    it("reports exposure alongside sharpness", () => {
      const result = analyseGrayscale(flat(10, 16, 16), 16, 16);

      expect(result.light).toBe(LightLevel.TooDark);
      expect(result.meanLuminance).toBe(10);
    });

    // The whole point of replacing the previous implementation: the same
    // photo must always produce the same verdict.
    it("is deterministic", () => {
      const frame = checkerboard(24, 24);
      const first = analyseGrayscale(frame, 24, 24);
      const second = analyseGrayscale(frame, 24, 24);

      expect(first).toEqual(second);
    });
  });
});

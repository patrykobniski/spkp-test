import { describe, expect, it } from "vitest";
import {
  parseMaxSeed,
  plannedRepsPrefill,
  plannedWeightPrefill,
  resolveGoal,
} from "./resolveGoal";

describe("parseMaxSeed", () => {
  it("parses MAX (M)/(N)/(O) and bare MAX", () => {
    expect(parseMaxSeed("MAX (M)")).toEqual({ letter: "M" });
    expect(parseMaxSeed("MAX (N)")).toEqual({ letter: "N" });
    expect(parseMaxSeed("MAX")).toEqual({ letter: "M" });
    expect(parseMaxSeed("MAX w 2 min (minutnik)")).toBeNull();
  });
});

describe("resolveGoal", () => {
  const maxes = { pompki_M: 17, podciaganie_M: 10, podciaganie_N: 12 };

  it("leaves plain targets alone", () => {
    expect(resolveGoal("15 powt.", "pompki", maxes).display).toBe("15 powt.");
  });

  it("resolves M−4", () => {
    const r = resolveGoal("M−4", "pompki", maxes);
    expect(r.display).toBe("M−4 = 13");
    expect(r.primaryNumber).toBe(13);
  });

  it("resolves M−7+2 keeping negatives suffix", () => {
    const r = resolveGoal("M−7+2", "pompki", maxes);
    expect(r.display).toBe("M−7+2 = 10+2");
    expect(r.primaryNumber).toBe(10);
  });

  it("resolves M-1 +5x", () => {
    const r = resolveGoal("M-1 +5x", "podciaganie", maxes);
    expect(r.display).toBe("M-1 +5x = 9 +5x");
    expect(r.primaryNumber).toBe(9);
  });

  it("resolves M +5x", () => {
    const r = resolveGoal("M +5x", "podciaganie", maxes);
    expect(r.display).toBe("M +5x = 10 +5x");
    expect(r.primaryNumber).toBe(10);
  });

  it("resolves N+1+5x", () => {
    const r = resolveGoal("N+1+5x", "podciaganie", maxes);
    expect(r.display).toBe("N+1+5x = 13+5x");
    expect(r.primaryNumber).toBe(13);
  });

  it("marks needsMax when missing", () => {
    const r = resolveGoal("M−4", "pompki", {});
    expect(r.needsMax).toBe(true);
    expect(r.display).toBe("M−4");
  });
});

describe("plannedRepsPrefill", () => {
  const maxes = { pompki_M: 17 };

  it("fills plain powt. and kg sets", () => {
    const plain = resolveGoal("12 powt. na nogę", null, {});
    expect(plannedRepsPrefill("12 powt. na nogę", plain)).toBe("12");
    const kg = resolveGoal("5 × 47,5 kg", null, {});
    expect(plannedRepsPrefill("5 × 47,5 kg", kg)).toBe("5");
  });

  it("keeps 3+2 and fills resolved M−4", () => {
    const plus = resolveGoal("3+2", "pompki", maxes);
    expect(plannedRepsPrefill("3+2", plus)).toBe("3+2");
    const m = resolveGoal("M−4", "pompki", maxes);
    expect(plannedRepsPrefill("M−4", m)).toBe("13");
  });

  it("extracts weight from plan", () => {
    expect(plannedWeightPrefill("5 × 47,5 kg")).toBe(47.5);
    expect(plannedWeightPrefill("15 powt.")).toBeNull();
  });
});

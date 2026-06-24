import { describe, expect, it } from "vitest";
import { normalizeSubmissionDecisionReason } from "./index.js";

describe("submission decision reason contract", () => {
  it.each([
    { input: undefined, expected: null },
    { input: null, expected: null },
    { input: "", expected: null },
    { input: "   ", expected: null },
    { input: " Not aligned. ", expected: "Not aligned." },
  ] as const)("normalizes $input to $expected", ({ expected, input }) => {
    expect(normalizeSubmissionDecisionReason({ reason: input })).toBe(expected);
  });
});

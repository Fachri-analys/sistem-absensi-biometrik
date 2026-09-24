import { describe, expect, it } from "vitest";
import { selectConsistentIdentityFrames, summarizeLiveness } from "../checkin-frame-policy";

describe("checkin frame policy", () => {
  it("requires the configured minimum number of matching identity frames", () => {
    const frames = [
      { frame: "frame-1", similarity: 0.91 },
      { frame: "frame-2", similarity: 0.88 },
      { frame: "frame-3", similarity: 0.94 },
      { frame: "frame-4", similarity: 0.20 },
    ];

    expect(selectConsistentIdentityFrames(frames, 0.9, 3)).toBeNull();
    expect(selectConsistentIdentityFrames(frames, 0.9, 2)?.map((item) => item.frame)).toEqual([
      "frame-1",
      "frame-3",
    ]);
  });

  it("does not let one live frame approve a multi-frame liveness quorum", () => {
    expect(
      summarizeLiveness(
        [
          { passed: true, confidence: 0.95 },
          { passed: false, confidence: 0.12, reason: "SPOOF_SUSPECTED" },
          { passed: false, confidence: 0.10, reason: "SPOOF_SUSPECTED" },
        ],
        2
      )
    ).toEqual({ passed: false, confidence: 0, reason: "SPOOF_SUSPECTED" });
  });

  it("reports the weakest passing liveness frame", () => {
    expect(
      summarizeLiveness(
        [
          { passed: true, confidence: 0.95 },
          { passed: true, confidence: 0.72 },
          { passed: false, confidence: 0.10, reason: "SPOOF_SUSPECTED" },
        ],
        2
      )
    ).toEqual({ passed: true, confidence: 0.72, reason: undefined });
  });
});

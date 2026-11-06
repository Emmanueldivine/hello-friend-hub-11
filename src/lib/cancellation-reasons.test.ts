import { describe, expect, it } from "bun:test";
import {
  CANCELLATION_REASONS,
  cancellationReasonSchema,
} from "@/lib/cancellation-reasons";

describe("assignment cancellation reasons", () => {
  it("offers exactly four clear choices, including a Unieveryhelp follow-up reason", () => {
    expect(CANCELLATION_REASONS).toHaveLength(4);
    expect(CANCELLATION_REASONS.map(({ value }) => value)).toEqual([
      "wrong_details",
      "no_longer_needed",
      "deadline_or_price",
      "service_issue",
    ]);
    expect(CANCELLATION_REASONS[3]?.label).toContain("please contact me");
  });

  it("rejects any reason that is not one of the four choices", () => {
    expect(cancellationReasonSchema.safeParse("other").success).toBe(false);
  });
});
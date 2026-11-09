import { describe, expect, it } from "vitest";
import { getSchoolGroupKey, getSchoolGroupLabel } from "@/lib/school-normalization";

describe("student school grouping", () => {
  it("groups common abbreviations with the university's full name", () => {
    expect(getSchoolGroupKey("UNILAG")).toBe(getSchoolGroupKey("University of Lagos"));
    expect(getSchoolGroupKey("ABU Zaria")).toBe(getSchoolGroupKey("Ahmadu Bello University, Zaria"));
    expect(getSchoolGroupKey("O.A.U.")).toBe(getSchoolGroupKey("Obafemi Awolowo University"));
  });

  it("displays a consistent label for known university variants", () => {
    expect(getSchoolGroupLabel("uniben")).toBe("University of Benin (UNIBEN)");
  });

  it("normalizes punctuation and spacing for custom school names", () => {
    expect(getSchoolGroupKey("Covenant University, Ota")).toBe("covenantuniversityota");
    expect(getSchoolGroupKey("Covenant  University Ota")).toBe("covenantuniversityota");
  });
});
const schoolGroups: Record<string, { label: string; aliases: string[] }> = {
  unilag: {
    label: "University of Lagos (UNILAG)",
    aliases: ["University of Lagos", "UNILAG", "Unilag Lagos"],
  },
  ui: {
    label: "University of Ibadan (UI)",
    aliases: ["University of Ibadan", "UI", "U.I."],
  },
  unn: {
    label: "University of Nigeria, Nsukka (UNN)",
    aliases: ["University of Nigeria Nsukka", "UNN", "UNN Nsukka"],
  },
  abu: {
    label: "Ahmadu Bello University, Zaria (ABU)",
    aliases: ["Ahmadu Bello University Zaria", "ABU", "ABU Zaria"],
  },
  oau: {
    label: "Obafemi Awolowo University (OAU)",
    aliases: ["Obafemi Awolowo University", "OAU", "O.A.U."],
  },
  uniben: {
    label: "University of Benin (UNIBEN)",
    aliases: ["University of Benin", "UNIBEN", "UNIBEN Benin"],
  },
};

const normalizedSchoolGroups = Object.entries(schoolGroups).flatMap(([key, group]) =>
  group.aliases.map((alias) => [normalizeSchoolName(alias), key] as const),
);

function normalizeSchoolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getSchoolGroupKey(name: string): string {
  const normalized = normalizeSchoolName(name);
  return normalizedSchoolGroups.find(([alias]) => alias === normalized)?.[1] ?? normalized;
}

export function getSchoolGroupLabel(name: string): string {
  const group = schoolGroups[getSchoolGroupKey(name)];
  return group?.label ?? name.trim().replace(/\s+/g, " ");
}
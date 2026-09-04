// Removes leftover demo/mock session data from the pre-Supabase prototype so it
// can never be mistaken for a real signed-in admin.
const LEGACY_PREFIXES = [
  "unieveryhelp-demo",
  "unieveryhelp_demo",
  "uh-demo",
  "demo-session",
  "v0-",
  "v0_",
  "adminUser",
  "admin_user",
  "fakeAdmin",
  "mockUser",
];

function purge(store: Storage) {
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && LEGACY_PREFIXES.some((p) => key.startsWith(p))) doomed.push(key);
  }
  doomed.forEach((key) => store.removeItem(key));
}

export function clearLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    purge(window.localStorage);
    purge(window.sessionStorage);
    document.cookie = "unieveryhelp-demo-session=; Max-Age=0; path=/";
  } catch {
    /* storage unavailable */
  }
}

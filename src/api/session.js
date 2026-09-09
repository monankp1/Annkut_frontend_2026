// The signed-in sevak's profile, plus the helpers that read `access` to decide
// what the UI draws.
//
// `access` drives menus and nothing else. The server re-checks every request
// and answers 403 on its own, so hiding a button is a convenience, never a
// protection — and a feature the server would allow should not be hidden.

const SEVAK_KEY = "annkut.sevak";

// The 2025 build kept the whole profile under this key and treated it as proof
// of identity. Cleared on sign-in/sign-out so no stale copy is left behind.
const LEGACY_KEY = "sevakDetails";

export function getSevak() {
  try {
    return JSON.parse(localStorage.getItem(SEVAK_KEY)) || null;
  } catch {
    return null;
  }
}

export function setSevak(sevak) {
  try {
    if (sevak) localStorage.setItem(SEVAK_KEY, JSON.stringify(sevak));
    else localStorage.removeItem(SEVAK_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode — the app still works, it just forgets on reload */
  }
}

export function clearSevak() {
  setSevak(null);
}

// -- access ----------------------------------------------------------------

const EMPTY_ACCESS = { global: false, areas: [], mandal_count: 0 };

export const accessOf = (sevak) => (sevak && sevak.access) || EMPTY_ACCESS;

/** Sees every mandal in the organisation. */
export const isGlobal = (sevak) => Boolean(accessOf(sevak).global);

/** Xetras held outright: [{ id, code, name, type }]. */
export const scopedAreas = (sevak) => accessOf(sevak).areas || [];

/**
 * Holds any mandal beyond their own record — the test for whether the mandal
 * grid, the sevak list and the receipt-book screens are worth showing.
 *
 * An ordinary sevak fails this and legitimately sees none of them; that is an
 * empty state, not an error.
 */
export function hasMandalScope(sevak) {
  const a = accessOf(sevak);
  return (
    Boolean(a.global) ||
    (a.areas || []).length > 0 ||
    Number(a.mandal_count || 0) > 0
  );
}

/** The mandal this person belongs to — null for sants and senior karyakars. */
export const homeMandal = (sevak) => (sevak && sevak.mandal) || null;

// -- parivar (family) ------------------------------------------------------

/** The family, or null for a sant who belongs to none. */
export const parivarOf = (sevak) => (sevak && sevak.parivar) || null;

export const parivarCode = (sevak) => parivarOf(sevak)?.code || "";

/**
 * Everyone in the household, the signed-in sevak first (flagged `is_self`).
 * These rows are what the home-screen tabs are drawn from, and unlike the rest
 * of the payload their numbers really are numbers.
 */
export const parivarMembers = (sevak) => parivarOf(sevak)?.members || [];

/**
 * Whether to draw the edit and void buttons on a seva entry.
 *
 * Only a karyakar may change a recorded receipt — the server answers 403 for
 * everybody else, family included, since the record has to keep matching the
 * paper. Reading is open to the whole family either way.
 */
export const canManageSeva = (sevak) => hasMandalScope(sevak);

// -- who may do what -------------------------------------------------------

/**
 * Mandal Sanchalak.
 *
 * There is no post for this and no scope row either: the posts table holds
 * only KOTHARI, SANT_NIRDESHAK, NIRDESHAK, SAH_NIRDESHAK and YUVA_NIRDESHAK.
 * The 35 sanchalaks are identifiable only by their Sevak ID, which is "RK"
 * plus the mandal code plus a sequence — one per mandal, RKNK036 for Narayan
 * Kunj and so on.
 *
 * Matching on a prefix is brittle, so it lives here and nowhere else: when the
 * backend grows a real MANDAL_SANCHALAK post, this one line changes.
 */
export const isMandalSanchalak = (sevak) =>
  /^RK/i.test(String((sevak && sevak.sevak_id) || ""));

/** Full run of the place. Today that is the Kothari, the only GLOBAL holder. */
export const isAdmin = (sevak) => isGlobal(sevak);

/**
 * Editing an annkut sevak's details — the sanchalak who actually knows the
 * family, or an admin.
 */
export const canEditSevak = (sevak) =>
  isAdmin(sevak) || isMandalSanchalak(sevak);

/**
 * Deactivating one — admin only. A sanchalak may correct a record but not
 * remove a person from the roster.
 */
export const canDeactivateSevak = (sevak) => isAdmin(sevak);

/** Who gets the mandal / sevak-list screens at all. */
export const canSeeSevakList = (sevak) =>
  hasMandalScope(sevak) || isMandalSanchalak(sevak);

export const postCodes = (sevak) =>
  ((sevak && sevak.posts) || []).map((p) => p.code);

export const hasPost = (sevak, code) => postCodes(sevak).includes(code);

/** Highest-ranking post, for display. Posts come back sorted by rank. */
export function postLabel(sevak) {
  const posts = (sevak && sevak.posts) || [];
  return posts.length ? posts[0].name : "";
}

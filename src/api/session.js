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

/**
 * Where a signed-in sevak belongs. Used both after login and when someone
 * lands back on the login page with a session still running, so the two can
 * never disagree about where "in" is.
 */
export function landingPath(sevak) {
  if (!sevak) return "/home";
  if (sevak.must_change_password) return "/change-password";
  return hasMandalScope(sevak) ? "/annkut-sevak-list" : "/home";
}

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

// -- who may do what -------------------------------------------------------
//
// Scope answers "which data", permissions answer "which verbs", and a write
// needs both. A Sant Nirdeshak reaches a whole xetra but may change nothing; a
// Sanchalak may edit, but only inside his own mandal. Permissions come from
// the caller's post and ride along in the login payload.
//
// These gate the UI and nothing more. The server re-checks every request, so a
// hidden button protects nothing — and a feature the server would allow should
// not be hidden.

export const permissionsOf = (sevak) => accessOf(sevak).permissions || [];

/** Holds the ADMIN post: every permission, every mandal. */
export const isAdmin = (sevak) => Boolean(accessOf(sevak).is_admin);

/** Admin implies everything, so it never needs listing in `permissions`. */
export const can = (sevak, code) =>
  isAdmin(sevak) || permissionsOf(sevak).includes(code);

/** Name, mobile, pankh and target. Admin + Sanchalak (own mandal). */
export const canEditSevak = (sevak) => can(sevak, "sevak.edit");

/** Admin only — a Sanchalak corrects a record, he does not add people. */
export const canCreateSevak = (sevak) => can(sevak, "sevak.create");

/** Admin only. */
export const canDeactivateSevak = (sevak) => can(sevak, "sevak.deactivate");

/**
 * Set another sevak's password when they are locked out. Admin only — a
 * Sanchalak cannot, even inside his own mandal.
 */
export const canResetPassword = (sevak) => can(sevak, "user.reset_password");

/**
 * Editing or voiding a recorded seva. Admin only: once the paper receipt is
 * written the record has to keep matching it.
 */
export const canManageSeva = (sevak) => can(sevak, "seva.manage");

/**
 * Who gets the Yuva Pravrutti switch on the mandals screen.
 *
 * Named outright rather than derived, because no permission or post marks this
 * pair out — it is a reporting view two people are responsible for, not a
 * capability the server grants. Everyone else sees the unfiltered screen.
 *
 * The filter itself is enforced nowhere: anyone could send `pravrutti` by
 * hand and the server would honour it within their own scope. This only keeps
 * a switch off screens that have no use for it.
 */
export const YUVA_FILTER_SEVAK_IDS = ["ASMN083", "AGYP011", "ADMIN26"];

export const canFilterYuva = (sevak) =>
  YUVA_FILTER_SEVAK_IDS.includes(
    String((sevak && sevak.sevak_id) || "").toUpperCase()
  );

/** Issue a book the mandal already holds to a parivar. Admin + Sanchalak. */
export const canAssignBook = (sevak) => can(sevak, "book.assign");

/**
 * Stock control — add a book to a mandal, take one back, edit, submit,
 * delete. Admin only.
 */
export const canManageBooks = (sevak) => can(sevak, "book.manage");

export const postCodes = (sevak) =>
  ((sevak && sevak.posts) || []).map((p) => p.code);

export const hasPost = (sevak, code) => postCodes(sevak).includes(code);

/** Highest-ranking post, for display. Posts come back sorted by rank. */
export function postLabel(sevak) {
  const posts = (sevak && sevak.posts) || [];
  return posts.length ? posts[0].name : "";
}

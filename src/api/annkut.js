/**
 * Annkut 2026 API client.
 *
 * Every endpoint is POST + JSON and carries `Authorization: Bearer <token>`,
 * the one exception being login/login. Identity comes from the token alone: a
 * `sevak_id` in a body now means "about this person", never "I am this person".
 *
 *   import api, { ApiError, num, errorText } from "../api/annkut";
 *
 *   const sevak = await api.login("AGSP004", "annkut@2026");
 *   const { sevak: rows, total } = await api.sevaks({ mandal_id: 7 });
 */

import { BACKEND_ENDPOINT } from "./api";
import { setSevak, clearSevak } from "./session";

const TOKEN_KEY = "annkut.token";

/**
 * CodeIgniter 3 resolves a URL segment to a class with ucfirst() and nothing
 * else, so "receiptbooks" looks for Receiptbooks.php. The file is actually
 * ReceiptBooks.php, which only matches on a case-insensitive filesystem —
 * lowercase would 404 on the Linux production box. This casing works on both.
 */
const BOOKS = "ReceiptBooks";

/** Thrown for every non-2xx response. Branch on `.status`. */
export class ApiError extends Error {
  constructor(status, message, body) {
    super(message || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    /** 401 — token missing or expired. Sign out. */
    this.isAuth = status === 401;
    /** 403 — signed in but not permitted. Show a message, do NOT sign out. */
    this.isForbidden = status === 403;
    /** 0 — never reached the server (offline, or blocked by CORS). */
    this.isNetwork = status === 0;
  }
}

/** MySQL hands back numeric columns as strings ("0", "359"). Coerce first. */
export const num = (v) =>
  v === null || v === undefined || v === "" ? 0 : Number(v);

/** Message to put in a toast. Backend text wins; these are the fallbacks. */
export function errorText(e, fallback = "Something went wrong.") {
  if (!e) return fallback;
  if (e.isNetwork) return "Could not reach the server. Is it running?";
  if (e.isForbidden) return e.message || "You do not have access to that.";
  return e.message || fallback;
}

class AnnkutApi {
  constructor(baseUrl = BACKEND_ENDPOINT) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    this.token = this._readToken();
    /** Set by the app so a 401 anywhere can bounce the user to the login page. */
    this.onUnauthorized = null;
  }

  // -- token ---------------------------------------------------------------

  _readToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null; // private mode, or storage disabled
    }
  }

  setToken(token) {
    this.token = token || null;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* keep working from memory even when storage is unavailable */
    }
  }

  get isAuthenticated() {
    return Boolean(this.token);
  }

  // -- transport -----------------------------------------------------------

  async request(path, body = {}) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let res;
    try {
      res = await fetch(this.baseUrl + path, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      // A CORS rejection is indistinguishable from an outage here; the browser
      // console is the only place that tells them apart.
      throw new ApiError(0, "Could not reach the server.", null);
    }

    const text = await res.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text }; // a PHP fatal, or an HTML error page
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        this.setToken(null);
        clearSevak();
        if (typeof this.onUnauthorized === "function") this.onUnauthorized();
      }
      throw new ApiError(res.status, payload && payload.message, payload);
    }

    return payload;
  }

  // -- auth ----------------------------------------------------------------

  async login(sevakId, password) {
    const r = await this.request("login/login", {
      sevak_id: sevakId,
      password,
    });
    this.setToken(r.token);
    setSevak(r.sevak);
    return r.sevak;
  }

  /** Restores a session on reload. Returns null if the token is gone or stale. */
  async me() {
    if (!this.token) return null;
    try {
      const r = await this.request("login/me");
      setSevak(r.sevak);
      return r.sevak;
    } catch (e) {
      if (e.isAuth) return null;
      throw e;
    }
  }

  /**
   * Self-service reset for somebody who cannot sign in at all. No token.
   *
   * Identity is proved with the Sevak ID plus the mobile on file — a low bar,
   * and deliberately so until an OTP exists. 404 covers both "no such sevak"
   * and "wrong number" so it cannot be used to discover whose number is whose.
   */
  forgotPassword(sevakId, phoneNumber, newPassword) {
    return this.request("login/forgot_password", {
      sevak_id: sevakId,
      phone_number: phoneNumber,
      password: newPassword,
    });
  }

  /**
   * On success the server revokes every token for this user, including the one
   * that made the call — route back to the login screen afterwards.
   */
  async changePassword(currentPassword, newPassword) {
    const r = await this.request("login/change_password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    this.setToken(null);
    clearSevak();
    return r;
  }

  async logout() {
    try {
      if (this.token) await this.request("login/logout");
    } catch {
      /* a dead token is already logged out as far as we care */
    } finally {
      this.setToken(null);
      clearSevak();
    }
  }

  // -- organisation --------------------------------------------------------

  /** → { sevak: [...], total } — `total` is the count before `limit`. */
  sevaks(filters = {}) {
    return this.request("sevak/get_sevak", filters);
  }

  /** Accepts a sevak code ("ASNK001") or the numeric id. */
  sevak(sevakId) {
    return this.request("sevak/get_sevak_by_id", { sevak_id: sevakId }).then(
      (r) => r.sevak
    );
  }

  parivar(parivarId) {
    return this.request("sevak/get_parivar", { parivar_id: parivarId }).then(
      (r) => r.parivar
    );
  }

  parivars(mandalId) {
    return this.request(
      "sevak/get_parivar_list",
      mandalId ? { mandal_id: mandalId } : {}
    ).then((r) => r.parivar);
  }

  /**
   * The caller's own family, with each member's live counters.
   *
   * The same block already rides along on login, so this is only for
   * refreshing the home-screen tabs after recording a seva.
   * → { parivar, members } — parivar is null for sants.
   */
  family() {
    return this.request("sevak/get_family", {});
  }

  /** → { mandal_array: [...], target: { total_target, total_filled_form } }. */
  mandals(filters = {}) {
    return this.request("sevak/get_mandal_list", filters);
  }

  areas() {
    return this.request("sevak/get_area_list", {}).then((r) => r.area);
  }

  addSevak(data) {
    return this.request("sevak/add_sevak", data);
  }

  /** `target_forms` here also moves the mandal target by the same delta. */
  editSevak(sevakId, data) {
    return this.request("sevak/edit_sevak", { sevak_id: sevakId, ...data });
  }

  setSevakTarget(sevakId, targetForms, year) {
    return this.request("sevak/set_target", {
      sevak_id: sevakId,
      target_forms: targetForms,
      year,
    });
  }

  /** Deactivates. Receipts reference the collector, so nothing is deleted. */
  deactivateSevak(sevakId) {
    return this.request("sevak/delete_sevak", { sevak_id: sevakId });
  }

  // -- seva ----------------------------------------------------------------

  /**
   * Records a receipt.
   *
   * `onBehalfOf` is the family tab standing selected — omit it and the seva is
   * credited to the caller. The mandal comes from the book, so no mandal_id is
   * ever sent, and prasad_type / payment_method / notes are left to the server
   * (annkut_sevak / cash / null) because the form does not collect them.
   *
   * The sahyogi's name goes in three parts: given one box, no two sevaks fill
   * it in the same order.
   */
  addSeva({
    book_id,
    receipt_no,
    seva_amount,
    sahyogi_surname,
    sahyogi_first_name,
    sahyogi_middle_name,
    sahyogi_number,
    onBehalfOf,
  }) {
    return this.request("seva/add_seva", {
      book_id,
      receipt_no,
      seva_amount,
      sahyogi_surname,
      sahyogi_first_name,
      sahyogi_middle_name,
      sahyogi_number,
      ...(onBehalfOf ? { on_behalf_of: onBehalfOf } : {}),
    });
  }

  /** → { seva: [...], total, achieved_target }. No filters = your own entries. */
  sevaList(filters = {}) {
    return this.request("seva/get_seva", filters);
  }

  /** One family tab's entries. Takes the member's sevak_code or numeric id. */
  sevaFor(sevakId, filters = {}) {
    return this.request("seva/get_seva", { sevak_id: sevakId, ...filters });
  }

  seva(sevaId) {
    return this.request("seva/get_seva_by_id", { seva_id: sevaId }).then(
      (r) => r.seva
    );
  }

  /**
   * Karyakar only — an ordinary sevak gets 403 even on an entry they recorded,
   * because the record has to keep matching the paper receipt. Gate the button
   * on `canManageSeva()`; reading stays open to the whole family.
   *
   * A receipt can move within its book, never to a different one.
   */
  editSeva(sevaId, data) {
    return this.request("seva/edit_seva", { seva_id: sevaId, ...data });
  }

  /** Karyakar only, as editSeva. Soft void — the receipt number stays used. */
  deleteSeva(sevaId) {
    return this.request("seva/delete_seva", { seva_id: sevaId });
  }

  summary(filters = {}) {
    return this.request("seva/get_seva_count", filters);
  }

  /**
   * The one GET, and the token still has to travel in a header — a plain
   * <a href> cannot carry one, so the download is driven from a blob.
   */
  async exportSeva({ year, mandal_id } = {}) {
    const qs = new URLSearchParams();
    if (year) qs.set("year", year);
    if (mandal_id) qs.set("mandal_id", mandal_id);

    let res;
    try {
      res = await fetch(`${this.baseUrl}seva/export_data?${qs}`, {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      });
    } catch {
      throw new ApiError(0, "Could not reach the server.", null);
    }

    if (!res.ok) {
      if (res.status === 401) {
        this.setToken(null);
        clearSevak();
        if (typeof this.onUnauthorized === "function") this.onUnauthorized();
      }
      throw new ApiError(res.status, "Export failed.", null);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annkut_seva_${year || new Date().getFullYear()}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // -- receipt books -------------------------------------------------------
  //
  // Books are addressed by `book_id`. The number on the cover (`book_no`)
  // repeats across mandals and is display-only.

  /** Defaults to your own mandal; 400 if you have none, so pass one. */
  books(mandalId) {
    return this.request(
      `${BOOKS}/list`,
      mandalId ? { mandal_id: mandalId } : {}
    ).then((r) => r.all_books || []);
  }

  /**
   * Books the caller's parivar may write in. A book stays in the house rather
   * than with one person, so this is the same list for every family tab — the
   * selected tab decides who the seva counts for, not whose book it is.
   */
  myBooks() {
    return this.request(`${BOOKS}/my_books`, {}).then((r) => r.books || []);
  }

  createBook(data) {
    return this.request(`${BOOKS}/create`, data);
  }

  /**
   * Issues a book to a family. Naming any one member hands it to their whole
   * household. → { next_receipt_no }.
   */
  assignBook(bookId, { parivarId, sevakId } = {}) {
    return this.request(`${BOOKS}/assign`, {
      book_id: bookId,
      ...(parivarId ? { parivar_id: parivarId } : { sevak_id: sevakId }),
    });
  }

  deassignBook(bookId, lastUsedNo) {
    const body = { book_id: bookId };
    if (lastUsedNo !== undefined && lastUsedNo !== null && lastUsedNo !== "") {
      body.last_used_no = Number(lastUsedNo);
    }
    return this.request(`${BOOKS}/deassign`, body);
  }

  updateBook(bookId, data) {
    return this.request(`${BOOKS}/update`, { book_id: bookId, ...data });
  }

  submitBook(bookId) {
    return this.request(`${BOOKS}/submit`, { book_id: bookId });
  }

  deleteBook(bookId) {
    return this.request(`${BOOKS}/delete`, { book_id: bookId });
  }
}

export const api = new AnnkutApi();
export default api;

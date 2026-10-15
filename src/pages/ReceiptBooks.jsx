// src/pages/ReceiptBooks.jsx
//
// Three views in one page: the mandal list (grouped by xetra), one mandal's
// books, and — for the admin — the office pool. The view lives in the URL
// (?mandal=12, ?view=pool) so the phone's back gesture steps between them and
// a reload stays put.
import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import Header from "../components/Header";
import api, { num, errorText } from "../api/annkut";
import {
  getSevak,
  hasMandalScope,
  canAssignBook,
  canManageBooks,
} from "../api/session";

import BookList, {
  STATE_LABELS,
  StatusPill,
  UsageBar,
  bookState,
} from "../components/receipt-books/BookList";
import AssignBookModal from "../components/receipt-books/AssignBookModal";
import DeassignBookModal from "../components/receipt-books/DeassignBookModal";
import AddBookModal from "../components/receipt-books/AddBookModal";
import EditBookModal from "../components/receipt-books/EditBookModal";
import TransferBookModal from "../components/receipt-books/TransferBookModal";

const STATE_ORDER = ["available", "family", "office", "closed"];

/** Search only what is on screen — never ids, flags or field names. */
const matches = (needle, ...fields) =>
  fields.some((f) =>
    String(f ?? "")
      .toLowerCase()
      .includes(needle),
  );

const SkeletonCards = ({ label }) => (
  <div aria-busy="true" aria-label={label}>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="seva-card is-skeleton" aria-hidden="true">
        <span className="skeleton-line sk-60" />
        <span className="skeleton-line sk-40" />
        <span className="skeleton-line sk-50" />
      </div>
    ))}
  </div>
);

const ErrorState = ({ title, message, onRetry }) => (
  <div className="list-state" role="alert">
    <i className="bi bi-wifi-off list-state-icon" aria-hidden="true" />
    <p className="list-state-title">{title}</p>
    <p className="list-state-text">{message}</p>
    <button type="button" className="outline-btn" onClick={onRetry}>
      <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
    </button>
  </div>
);

const EmptyState = ({ icon = "bi-search", title, text }) => (
  <div className="list-state">
    <i className={`bi ${icon} list-state-icon`} aria-hidden="true" />
    <p className="list-state-title">{title}</p>
    {text && <p className="list-state-text">{text}</p>}
  </div>
);

export default function ReceiptBooks() {
  const me = getSevak();
  const scoped = hasMandalScope(me);
  const ownMandal = me?.mandal || null;

  // Stock control is the admin's: books enter a mandal and come back from a
  // parivar only on his say-so. A sanchalak does one thing — hand a book his
  // mandal already holds to one of its families, and take it back.
  const mayAssign = canAssignBook(me);
  const mayManage = canManageBooks(me);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Someone holding several mandals picks one first; everyone else goes
  // straight to their own. Everything is addressed by mandal_id: a mandal
  // code like "NK" is unique only inside its xetra.
  const selectedId = scoped
    ? num(searchParams.get("mandal")) || null
    : num(ownMandal?.id) || null;
  const view =
    mayManage && searchParams.get("view") === "pool"
      ? "pool"
      : selectedId
        ? "books"
        : "mandals";

  const [mandals, setMandals] = React.useState([]);
  const [books, setBooks] = React.useState([]);
  // The office pool: stock with no family holding it and pages still left,
  // across every mandal in scope.
  const [pool, setPool] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [qMandal, setQMandal] = React.useState("");
  const [qBooks, setQBooks] = React.useState("");
  const [qPool, setQPool] = React.useState("");
  const [stateFilter, setStateFilter] = React.useState("all");

  const [assignBook, setAssignBook] = React.useState(null);
  const [deassignBook, setDeassignBook] = React.useState(null);
  const [editingBook, setEditingBook] = React.useState(null);
  const [transferBook, setTransferBook] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const [deletingBook, setDeletingBook] = React.useState(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [submittingBook, setSubmittingBook] = React.useState(null);
  const [submitBusy, setSubmitBusy] = React.useState(false);

  // ---------- fetchers ----------

  // One request at a time per screen; a reply that arrives after the user
  // has moved on is dropped rather than shown on the wrong view.
  const request = React.useRef(0);

  const load = React.useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      if (view === "mandals") {
        const res = await api.mandals({});
        if (id !== request.current) return;
        setMandals(Array.isArray(res?.mandal_array) ? res.mandal_array : []);
      } else if (view === "pool") {
        const rows = await api.bookPool();
        if (id !== request.current) return;
        setPool(Array.isArray(rows) ? rows : []);
      } else {
        // With no mandal_id the server falls back to the caller's own mandal,
        // and answers 400 for someone attached to none.
        const rows = await api.books(selectedId || undefined);
        if (id !== request.current) return;
        setBooks(Array.isArray(rows) ? rows : []);
      }
    } catch (e) {
      console.error("Receipt books load error:", e);
      if (id !== request.current) return;
      setError(
        errorText(
          e,
          view === "mandals"
            ? "Failed to load mandals."
            : view === "pool"
              ? "Failed to load the office pool."
              : "Failed to load books.",
        ),
      );
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [view, selectedId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // A different mandal starts with a clean search and no filter.
  React.useEffect(() => {
    setQBooks("");
    setStateFilter("all");
    setBooks([]);
  }, [selectedId]);

  // ---------- derived ----------

  const groupedMandals = React.useMemo(() => {
    const needle = qMandal.trim().toLowerCase();
    const map = new Map();
    for (const m of mandals) {
      if (needle && !matches(needle, m?.name, m?.code, m?.area_name)) continue;
      const key = String(m?.area_name ?? "").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return Array.from(map.entries());
  }, [mandals, qMandal]);

  const stateCounts = React.useMemo(() => {
    const c = { all: books.length };
    for (const s of STATE_ORDER) c[s] = 0;
    for (const b of books) c[bookState(b)] += 1;
    return c;
  }, [books]);

  const visibleBooks = React.useMemo(() => {
    const needle = qBooks.trim().toLowerCase();
    return books.filter((b) => {
      if (stateFilter !== "all" && bookState(b) !== stateFilter) return false;
      if (!needle) return true;
      return matches(
        needle,
        b?.book_no,
        b?.parivar_code,
        STATE_LABELS[bookState(b)],
      );
    });
  }, [books, qBooks, stateFilter]);

  const visiblePool = React.useMemo(() => {
    const needle = qPool.trim().toLowerCase();
    if (!needle) return pool;
    return pool.filter((b) => matches(needle, b?.book_no, b?.mandal_name));
  }, [pool, qPool]);

  const selectedName =
    location.state?.mandalName ||
    mandals.find((m) => num(m?.id) === selectedId)?.name ||
    books[0]?.mandal_name ||
    (!scoped ? ownMandal?.name : "") ||
    "Mandal";

  // The modals address the mandal by id and show its name.
  const activeMandal = selectedId
    ? { id: selectedId, name: selectedName }
    : null;

  // ---------- navigation ----------

  function openMandal(m) {
    setSearchParams(
      { mandal: String(num(m?.id)) },
      { state: { mandalName: m?.name || "", fromList: true } },
    );
  }

  function showPool() {
    setSearchParams({ view: "pool" }, { state: { fromList: true } });
  }

  function showMandals() {
    setSearchParams({}, { replace: true });
  }

  // Back to the list. When the list is what brought us here, step back in
  // history so the arrow and the phone's back gesture agree.
  function backToList() {
    if (location.state?.fromList) navigate(-1);
    else showMandals();
  }

  // ---------- actions ----------

  const doDeleteBook = async () => {
    if (!deletingBook?.id) return;
    try {
      setDeleteBusy(true);
      const res = await api.deleteBook(num(deletingBook.id));
      toast.success(res?.message || "Receipt book deleted.");
      setDeletingBook(null);
      load();
    } catch (e) {
      // 409 when the book is issued or already holds receipts.
      toast.error(errorText(e, "Failed to delete book."));
    } finally {
      setDeleteBusy(false);
    }
  };

  const doSubmitBook = async () => {
    if (!submittingBook?.id) return;
    try {
      setSubmitBusy(true);
      const res = await api.submitBook(num(submittingBook.id));
      // SUBMITTED and CLOSED end very differently for the book, so the
      // server's own wording is what the user sees.
      const closed = String(res?.status || "").toUpperCase() === "CLOSED";
      const msg = res?.message || "Receipt book handed in.";
      if (closed) toast.warning(msg);
      else toast.success(msg);
      setSubmittingBook(null);
      load();
    } catch (e) {
      console.error("Submit error:", e);
      toast.error(errorText(e, "Failed to submit book."));
    } finally {
      setSubmitBusy(false);
    }
  };

  // ---------- render pieces ----------

  const query = view === "mandals" ? qMandal : view === "pool" ? qPool : qBooks;
  const setQuery =
    view === "mandals" ? setQMandal : view === "pool" ? setQPool : setQBooks;

  const toolbar = (
    <div className="list-toolbar">
      {/* Stock that came back part-used is worth redistributing, and only the
          office can move it — so the admin gets the pool as a second tab. */}
      {mayManage && view !== "books" && (
        <div className="seg-tabs" role="tablist" aria-label="Receipt books">
          <button
            type="button"
            role="tab"
            aria-selected={view === "mandals"}
            className={`seg-tab${view === "mandals" ? " is-active" : ""}`}
            onClick={() => view === "pool" && backToList()}
          >
            Mandals
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "pool"}
            className={`seg-tab${view === "pool" ? " is-active" : ""}`}
            onClick={() => view !== "pool" && showPool()}
          >
            Office pool
          </button>
        </div>
      )}

      <div className="list-toolbar-row">
        <div className="search-field">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              view === "mandals"
                ? "Search mandals"
                : view === "pool"
                  ? "Search book number or mandal"
                  : "Search book number or parivar"
            }
            aria-label="Search"
            enterKeyHint="search"
          />
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true" />
        </button>
      </div>

      {view === "books" && books.length > 0 && (
        <div className="chip-row" role="group" aria-label="Filter by status">
          {["all", ...STATE_ORDER]
            .filter(
              (s) => s === "all" || stateCounts[s] > 0 || stateFilter === s,
            )
            .map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={stateFilter === s}
                className={`filter-chip${stateFilter === s ? " is-active" : ""}`}
                onClick={() => setStateFilter(s)}
              >
                {s === "all" ? "All" : STATE_LABELS[s]}{" "}
                <span className="filter-chip-count">{stateCounts[s]}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );

  let content;

  if (!scoped && !ownMandal) {
    content = (
      <EmptyState
        icon="bi-journal-x"
        title="No books to manage"
        text="Your account is not attached to a mandal."
      />
    );
  } else if (error) {
    content = (
      <ErrorState
        title={
          view === "mandals"
            ? "Couldn't load mandals"
            : view === "pool"
              ? "Couldn't load the office pool"
              : "Couldn't load books"
        }
        message={error}
        onRetry={load}
      />
    );
  } else if (view === "mandals") {
    if (loading && mandals.length === 0) {
      content = <SkeletonCards label="Loading mandals" />;
    } else if (groupedMandals.length === 0) {
      content = (
        <EmptyState
          title={
            qMandal.trim()
              ? `No mandals match “${qMandal.trim()}”`
              : "No mandals found"
          }
        />
      );
    } else {
      content = groupedMandals.map(([area, rows]) => (
        <section key={area || "no-area"} className="area-group">
          <h2 className="area-heading">
            <span>{area || "(No Xetra)"}</span>
            <span className="area-heading-count">{rows.length} mandals</span>
          </h2>
          <ul className="seva-list">
            {rows.map((m) => (
              <li key={m?.id}>
                <button
                  type="button"
                  className="mandal-row"
                  onClick={() => openMandal(m)}
                >
                  <span className="mandal-row-main">
                    <span className="mandal-row-name">
                      {m?.name || "Mandal"}
                    </span>
                    <span className="mandal-row-meta">
                      {num(m?.sevaks)} sevaks · {num(m?.parivars)} parivars
                    </span>
                  </span>
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ));
    }
  } else if (view === "pool") {
    if (loading && pool.length === 0) {
      content = <SkeletonCards label="Loading the office pool" />;
    } else if (visiblePool.length === 0) {
      content = (
        <EmptyState
          icon="bi-inbox"
          title={
            qPool.trim()
              ? `No books match “${qPool.trim()}”`
              : "Nothing waiting to be redistributed"
          }
          text={
            qPool.trim()
              ? null
              : "Books no family is holding, with receipts still left, show up here."
          }
        />
      );
    } else {
      content = (
        <>
          <p className="section-hint">
            Books no family is holding, with receipts still left. Closed books
            never appear here.
          </p>
          <ul className="seva-list">
            {visiblePool.map((row) => (
              <li key={row.id} className="seva-card book-card">
                <div className="seva-card-top">
                  <span className="seva-card-name">Book {row.book_no}</span>
                  <span
                    className={`status-pill is-${
                      bookState(row) === "office" ? "office" : "available"
                    }`}
                  >
                    {bookState(row) === "office"
                      ? "Came back part-used"
                      : "Never issued"}
                  </span>
                </div>
                <div className="seva-card-meta">
                  From {row.mandal_name || "—"} · {num(row.remaining)} left ·
                  next {num(row.next_receipt_no)}
                </div>
                <UsageBar row={row} />
                <div className="book-card-bottom">
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setTransferBook(row)}
                  >
                    <i className="bi bi-send-fill" aria-hidden="true" /> Send
                    to…
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      );
    }
  } else {
    let list;
    if (loading && books.length === 0) {
      list = <SkeletonCards label="Loading books" />;
    } else if (books.length === 0) {
      list = (
        <EmptyState
          icon="bi-journal-x"
          title="No books in this mandal yet"
          text={mayManage ? "Tap Add book below to add one." : null}
        />
      );
    } else if (visibleBooks.length === 0) {
      list = (
        <EmptyState
          title={
            qBooks.trim()
              ? `No books match “${qBooks.trim()}”`
              : `No ${STATE_LABELS[stateFilter]?.toLowerCase()} books`
          }
        />
      );
    } else {
      list = (
        <BookList
          rows={visibleBooks}
          mayAssign={mayAssign}
          mayManage={mayManage}
          onAssign={setAssignBook}
          onDeassign={setDeassignBook}
          onSubmitBook={setSubmittingBook}
          onTransfer={setTransferBook}
          onEdit={setEditingBook}
          onDelete={setDeletingBook}
        />
      );
    }
    content = list;
  }

  const showAdd = view === "books" && mayManage && Boolean(activeMandal);

  return (
    <div className={`list-page${showAdd ? " has-bottom-action" : ""}`}>
      <Header />

      {view === "books" && (
        <div className="sub-bar">
          {scoped && (
            <button
              type="button"
              className="app-bar-back"
              onClick={backToList}
              aria-label="Back to mandals"
            >
              <i className="bi bi-arrow-left" aria-hidden="true" />
            </button>
          )}
          <h1 className="sub-bar-title">{selectedName}</h1>
        </div>
      )}

      {(scoped || ownMandal) && toolbar}

      <main className="list-body">{content}</main>

      {showAdd && (
        <div className="bottom-action">
          <button
            type="button"
            className="brand-btn"
            onClick={() => setAddOpen(true)}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span>Add book</span>
          </button>
        </div>
      )}

      <AssignBookModal
        open={Boolean(assignBook)}
        onClose={() => setAssignBook(null)}
        mandal={activeMandal}
        book={assignBook}
        onAssigned={load}
      />

      <DeassignBookModal
        open={Boolean(deassignBook)}
        onClose={() => setDeassignBook(null)}
        book={deassignBook}
        onDeassigned={load}
      />

      <AddBookModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mandal={activeMandal}
        onAdded={load}
      />

      <TransferBookModal
        open={Boolean(transferBook)}
        onClose={() => setTransferBook(null)}
        book={transferBook}
        onTransferred={load}
      />

      <EditBookModal
        open={Boolean(editingBook)}
        onClose={() => setEditingBook(null)}
        book={editingBook}
        onSaved={load}
      />

      {/* Submitting is one-way: there is no endpoint that un-submits a book,
          so it is confirmed as plainly as the delete. Where the book ends up
          depends entirely on whether any page is left, so say which of the
          two will happen before they commit. */}
      <Dialog
        open={Boolean(submittingBook)}
        onClose={() => !submitBusy && setSubmittingBook(null)}
        PaperProps={{ className: "app-dialog" }}
      >
        <DialogTitle>Submit book {submittingBook?.book_no}?</DialogTitle>
        <DialogContent>
          {submittingBook && (
            <div className="void-summary">
              <div className="seva-card-top">
                <span className="seva-card-name">
                  Book {submittingBook.book_no}
                </span>
                <StatusPill row={submittingBook} />
              </div>
              <div className="seva-card-meta">
                {num(submittingBook.remaining)} receipts left
              </div>
            </div>
          )}
          {num(submittingBook?.remaining) > 0 ? (
            <div className="notice-box mb-0">
              <i className="bi bi-info-circle-fill" aria-hidden="true" />
              <span>
                It goes back to the office and can be sent to any mandal. It
                leaves
                {submittingBook?.parivar_code
                  ? ` parivar ${submittingBook.parivar_code}`
                  : " this mandal"}{" "}
                and stops accepting seva here. The next mandal picks it up at
                receipt <strong>{num(submittingBook?.next_receipt_no)}</strong>.
              </span>
            </div>
          ) : (
            <div className="notice-box is-danger mb-0">
              <i
                className="bi bi-exclamation-octagon-fill"
                aria-hidden="true"
              />
              <span>
                <strong>This cannot be undone.</strong> Every receipt has been
                used, so the book will be closed permanently. It can never be
                issued again, to this mandal or any other.
              </span>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSubmittingBook(null)}
            disabled={submitBusy}
            className="dialog-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={doSubmitBook}
            disabled={submitBusy}
            variant="contained"
            disableElevation
            className={`dialog-btn ${
              num(submittingBook?.remaining) > 0
                ? "dialog-btn-primary"
                : "dialog-btn-danger"
            }`}
            startIcon={
              submitBusy ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {submitBusy
              ? "Submitting…"
              : num(submittingBook?.remaining) > 0
                ? "Submit book"
                : "Close book"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deletingBook)}
        onClose={() => !deleteBusy && setDeletingBook(null)}
        PaperProps={{ className: "app-dialog" }}
      >
        <DialogTitle>Delete book {deletingBook?.book_no}?</DialogTitle>
        <DialogContent>
          This removes the receipt book record. A book that is issued, or that
          already holds receipts, cannot be deleted.
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeletingBook(null)}
            disabled={deleteBusy}
            className="dialog-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={doDeleteBook}
            disabled={deleteBusy}
            variant="contained"
            disableElevation
            className="dialog-btn dialog-btn-danger"
            startIcon={
              deleteBusy ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {deleteBusy ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer
        position="top-center"
        autoClose={5000}
        closeOnClick
        pauseOnHover
        theme="colored"
      />
    </div>
  );
}

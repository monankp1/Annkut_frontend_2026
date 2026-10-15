// src/pages/BookLookup.jsx
//
// The office's book screen: type the number printed on a cover, get back
// everything written in that book. Book numbers are unique across the whole
// organisation, so one number is one book — no mandal to pick first.
//
// Entries are listed in page order rather than date order, because this screen
// is used with the physical book open alongside it. The book looked up lives
// in the URL (?book=12), so the back gesture steps through earlier lookups and
// a reload — or coming back from an edit — keeps it on screen.
import React from "react";
import { useSearchParams } from "react-router-dom";
import { IconButton } from "@mui/material";
import { ToastContainer } from "react-toastify";
import Header from "../components/Header";
import EditSevaModal from "../components/EditSevaModal";
import {
  StatusPill,
  UsageBar,
  formatDate,
} from "../components/receipt-books/BookList";
import api, { num, errorText } from "../api/annkut";

const money = new Intl.NumberFormat("en-IN");

// The last few books looked up, on this phone only. Storage can be missing or
// refuse (private mode), and the screen works the same without it.
const RECENT_KEY = "annkut.recentBooks";
const RECENT_MAX = 5;

const readRecent = () => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
};

const rememberRecent = (no) => {
  const next = [no, ...readRecent().filter((x) => x !== no)].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* not remembered — no harm done */
  }
  return next;
};

const SkeletonCards = () => (
  <div aria-busy="true" aria-label="Looking up the book">
    {[0, 1, 2].map((i) => (
      <div key={i} className="seva-card is-skeleton" aria-hidden="true">
        <span className="skeleton-line sk-60" />
        <span className="skeleton-line sk-40" />
        <span className="skeleton-line sk-50" />
      </div>
    ))}
  </div>
);

export default function BookLookup() {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get("book") || "";

  const [bookNo, setBookNo] = React.useState(current);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [recent, setRecent] = React.useState(readRecent);

  const [editRow, setEditRow] = React.useState(null);

  const request = React.useRef(0);

  const search = React.useCallback(async (no) => {
    const term = String(no ?? "").trim();
    if (!term) return;

    const id = ++request.current;
    setLoading(true);
    setError(null);

    try {
      const res = await api.lookupBook(term);
      if (id !== request.current) return;
      setResult(res);
      setRecent(rememberRecent(term));
    } catch (e) {
      if (id !== request.current) return;
      setResult(null);
      // 404 "no such number" and 403 "not your mandal" carry different
      // messages on purpose — show whichever the server sent.
      setError({
        title:
          e?.status === 404
            ? `No book with number ${term}`
            : e?.isForbidden
              ? "This book isn't in your scope"
              : "Couldn't look that book up",
        message: errorText(e, "Could not look that book up."),
        retry: !e?.status || e.status >= 500 || e.isNetwork,
      });
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  // The URL is the source of truth: typing a number and pressing Search
  // writes it there, and this follows.
  React.useEffect(() => {
    setBookNo(current);
    if (current) search(current);
    else {
      request.current += 1;
      setResult(null);
      setError(null);
      setLoading(false);
    }
  }, [current, search]);

  const lookUp = (no) => {
    const term = String(no ?? "").trim();
    if (!term) return;
    if (term === current) search(term);
    else setSearchParams({ book: term });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    lookUp(bookNo);
  };

  const book = result?.book;
  const receipts = result?.receipts || [];
  const summary = result?.summary;
  const canEdit = Boolean(result?.can_edit);

  // Prasad goes by amount: one box for ₹500, another for ₹1,000 and up.
  const forms500 = receipts.filter((r) => num(r.seva_amount) === 500).length;
  const forms1000 = receipts.length - forms500;

  let content;

  if (loading) {
    content = <SkeletonCards />;
  } else if (error) {
    content = (
      <div className="list-state" role="alert">
        <i className="bi bi-journal-x list-state-icon" aria-hidden="true" />
        <p className="list-state-title">{error.title}</p>
        <p className="list-state-text">{error.message}</p>
        {error.retry && (
          <button
            type="button"
            className="outline-btn"
            onClick={() => search(current)}
          >
            <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
          </button>
        )}
      </div>
    );
  } else if (!book) {
    content = (
      <div className="list-state">
        <i className="bi bi-journal-text list-state-icon" aria-hidden="true" />
        <p className="list-state-title">Find a receipt book</p>
        <p className="list-state-text">
          Enter the number printed on the book's cover.
        </p>
      </div>
    );
  } else {
    const filled = num(summary?.filled);
    const pages = num(summary?.pages);

    content = (
      <>
        <section className="progress-card" aria-label={`Book ${book.book_no}`}>
          <div className="seva-card-top book-summary-top">
            <span className="book-summary-title">Book {book.book_no}</span>
            <StatusPill row={book} />
          </div>
          <div className="seva-card-meta">
            {[book.mandal_name, book.area_name || book.area_code]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="seva-card-meta">
            Receipts {num(book.start_no)}–{num(book.end_no)}
          </div>
          <UsageBar row={{ ...book, remaining: summary?.remaining }} />
          <div className="book-summary-stats">
            <span>
              <strong>{filled}</strong> of {pages} filled
            </span>
            <span>
              <strong>{num(summary?.remaining)}</strong> left
            </span>
            <span>
              <strong>₹{money.format(num(summary?.collected_amount))}</strong>
            </span>
          </div>
          {filled > 0 && (
            <div className="split-pills mt-2">
              <span
                className={`split-pill is-500${forms500 ? "" : " is-zero"}`}
                aria-label={`₹500 forms: ${forms500}`}
              >
                ₹500 <strong>{forms500}</strong>
              </span>
              <span
                className={`split-pill is-1000${forms1000 ? "" : " is-zero"}`}
                aria-label={`₹1,000 and above forms: ${forms1000}`}
              >
                ₹1,000+ <strong>{forms1000}</strong>
              </span>
            </div>
          )}
        </section>

        {/* Pages below the high-water mark with nothing against them: torn
            out, spoiled or voided. The thing you are looking for when
            reconciling a returned book. */}
        {summary?.unused_numbers?.length > 0 && (
          <div className="notice-box">
            <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
            <span>
              No entry for receipt
              {summary.unused_numbers.length === 1 ? "" : "s"}{" "}
              <strong>{summary.unused_numbers.join(", ")}</strong> — torn out,
              spoiled or voided.
            </span>
          </div>
        )}

        <h2 className="section-title">Receipts ({receipts.length})</h2>

        {receipts.length === 0 ? (
          <div className="list-state">
            <i className="bi bi-journal list-state-icon" aria-hidden="true" />
            <p className="list-state-title">Nothing written in this book yet</p>
          </div>
        ) : (
          <ul className="seva-list">
            {receipts.map((row) => {
              const by = [
                row.collected_by_name,
                row.collected_by_code,
                formatDate(row.collected_at),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={row.id} className="seva-card">
                  <div className="seva-card-top">
                    <span className="receipt-no">#{row.receipt_no}</span>
                    <span
                      className={`receipt-card-right${
                        canEdit ? " has-action" : ""
                      }`}
                    >
                      <span className="seva-card-amount">
                        ₹{money.format(num(row.seva_amount))}
                      </span>
                      {canEdit && (
                        <IconButton
                          className="seva-card-more"
                          onClick={() => setEditRow(row)}
                          aria-label={`Edit receipt ${row.receipt_no}`}
                        >
                          <i className="bi bi-pencil-fill" aria-hidden="true" />
                        </IconButton>
                      )}
                    </span>
                  </div>
                  <div className="seva-card-name">
                    {row.sahyogi_name || "—"}
                  </div>
                  {row.sahyogi_number && (
                    <a
                      className="seva-card-phone"
                      href={`tel:${row.sahyogi_number}`}
                    >
                      <i className="bi bi-telephone" aria-hidden="true" />
                      {row.sahyogi_number}
                    </a>
                  )}
                  {by && <div className="seva-card-meta">By {by}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className="list-page">
      <Header />

      <div className="list-toolbar">
        <form className="list-toolbar-row" onSubmit={handleSubmit}>
          <div className="search-field">
            <i className="bi bi-journal-bookmark" aria-hidden="true" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bookNo}
              onChange={(e) => setBookNo(e.target.value.replace(/\D/g, ""))}
              placeholder="Book number"
              aria-label="Book number"
              autoComplete="off"
              enterKeyHint="search"
              autoFocus={!current}
            />
          </div>
          <button
            type="submit"
            className="toolbar-btn"
            disabled={loading || !bookNo.trim()}
          >
            Search
          </button>
        </form>

        {recent.length > 0 && (
          <div className="chip-row" aria-label="Recent books">
            {recent.map((no) => (
              <button
                key={no}
                type="button"
                className={`filter-chip${no === current ? " is-active" : ""}`}
                onClick={() => lookUp(no)}
              >
                <i className="bi bi-clock-history" aria-hidden="true" /> {no}
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="list-body">{content}</main>

      {editRow && (
        <EditSevaModal
          modal={Boolean(editRow)}
          setModal={(open) => !open && setEditRow(null)}
          sevakData={editRow}
          refreshData={() => search(current)}
        />
      )}

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

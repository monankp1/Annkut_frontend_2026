// src/components/receipt-books/AssignBookModal.jsx
//
// A book goes to a household, not to one person: naming any member hands it to
// their whole parivar, and any of them can then write in it. The roster is the
// mandal's own sevaks, because a book cannot follow anyone into another mandal
// without its receipts being filed under a mandal that never held it.
import React from "react";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";
import { FormError } from "../AuthFields";
import SevaSheet from "../seva-form/SevaSheet";
import { SaveButton } from "../seva-form/SevaFields";

// Searchable by name, Sevak ID, Parivar ID or mobile — whichever the karyakar
// happens to have to hand. The whole roster is in memory from one request, so
// this filters what is there rather than asking the server on every keystroke.
const matchesSevak = (needle, u) =>
  [u?.full_name, u?.sevak_code, u?.parivar_code, u?.mobile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);

const AssignBookModal = ({ open, onClose, mandal, book, onAssigned }) => {
  const [roster, setRoster] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  const mandalId = mandal?.id;

  const loadRoster = React.useCallback(async () => {
    if (!open || !mandalId) return;
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.sevaks({ mandal_id: mandalId, limit: 500 });
      const rows = Array.isArray(res?.sevak) ? res.sevak : [];
      rows.sort((a, b) =>
        (a?.full_name || "").localeCompare(b?.full_name || ""),
      );
      setRoster(rows);
    } catch (e) {
      setLoadError(errorText(e, "Failed to load the sevak list."));
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [open, mandalId]);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setError("");
    loadRoster();
  }, [open, loadRoster]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? roster.filter((u) => matchesSevak(needle, u)) : roster;
  }, [roster, query]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) {
      setError("Pick the sevak whose family gets this book.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      // The server resolves the sevak to their parivar and issues it there.
      const res = await api.assignBook(num(book?.id), {
        sevakId: selected.sevak_code,
      });
      toast.success(
        res?.next_receipt_no
          ? `Issued. Next receipt to use: ${res.next_receipt_no}`
          : res?.message || "Receipt book issued.",
      );
      onClose?.();
      onAssigned?.();
    } catch (err) {
      // 409 when the sevak is in another mandal or the book is exhausted.
      // Shown above the button with the list still there, so another sevak
      // can be picked without starting over.
      setError(errorText(err, "Failed to assign book."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SevaSheet
      open={open}
      title={`Assign book ${book?.book_no ?? ""}`}
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          <FormError>{error}</FormError>
          <SaveButton busy={submitting} form="assign-form">
            {selected
              ? `Assign to ${selected.parivar_code || "their parivar"}`
              : "Assign book"}
          </SaveButton>
        </>
      }
    >
      <div className="receipt-info mt-0 mb-3">
        <i className="bi bi-journal-bookmark" aria-hidden="true" />
        <span>
          Book <strong>{book?.book_no}</strong> · next receipt{" "}
          {num(book?.next_receipt_no)}
          <span className="receipt-info-sub">
            {num(book?.remaining)} left · {mandal?.name || "—"}
          </span>
        </span>
      </div>

      <div className="notice-box">
        <i className="bi bi-people-fill" aria-hidden="true" />
        <span>
          The book goes to the chosen sevak's whole parivar — anyone in the
          family can write in it.
        </span>
      </div>

      <form id="assign-form" onSubmit={submit} noValidate>
        {loadError ? (
          <div className="list-state" role="alert">
            <p className="list-state-title">Couldn't load sevaks</p>
            <p className="list-state-text">{loadError}</p>
            <button type="button" className="outline-btn" onClick={loadRoster}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="search-field">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, Sevak ID, parivar or mobile"
                aria-label="Search sevaks"
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>

            {loading && roster.length === 0 ? (
              <div aria-busy="true" aria-label="Loading sevaks">
                <span className="skeleton-line skeleton-input mt-2" />
                <span className="skeleton-line skeleton-input mt-2" />
                <span className="skeleton-line skeleton-input mt-2" />
              </div>
            ) : (
              <div
                className="pick-list is-tall"
                role="radiogroup"
                aria-label="Sevak"
              >
                {visible.length === 0 ? (
                  <p className="pick-empty">
                    {roster.length === 0
                      ? "No sevaks in this mandal."
                      : "No match — try a name, Sevak ID or parivar."}
                  </p>
                ) : (
                  visible.map((u) => {
                    const active = selected?.id === u.id;
                    const sub = [u?.sevak_code, u?.parivar_code, u?.mobile]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <button
                        key={u.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`pick-item is-two-line${
                          active ? " is-active" : ""
                        }`}
                        onClick={() => {
                          setSelected(u);
                          setError("");
                        }}
                      >
                        <span>
                          <span className="pick-item-title">
                            {u?.full_name || "(no name)"}
                          </span>
                          <span className="pick-item-sub">{sub}</span>
                        </span>
                        {active && (
                          <i className="bi bi-check-lg" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </form>
    </SevaSheet>
  );
};

export default AssignBookModal;

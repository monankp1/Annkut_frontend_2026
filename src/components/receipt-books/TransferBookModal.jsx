// src/components/receipt-books/TransferBookModal.jsx
//
// Sends a part-used book from the office to whichever mandal needs it. ADMIN
// only.
//
// The count travels with the book: submitted at receipt 4 of 10, it lands in
// the next mandal starting at 5. Receipts already written keep the mandal that
// collected them, so moving a book never rewrites history.
import React from "react";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";
import { FormError } from "../AuthFields";
import SevaSheet from "../seva-form/SevaSheet";
import { SaveButton } from "../seva-form/SevaFields";

const TransferBookModal = ({ open, onClose, book, onTransferred }) => {
  const [mandals, setMandals] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [target, setTarget] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  const fromMandalId = num(book?.mandal_id);

  const loadMandals = React.useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.mandals({});
      setMandals(Array.isArray(res?.mandal_array) ? res.mandal_array : []);
    } catch (e) {
      setMandals([]);
      setLoadError(errorText(e, "Could not load the mandal list."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setTarget(null);
    setError("");
    loadMandals();
  }, [open, loadMandals]);

  // Sending a book to the mandal it is already in is a 409, so that one is
  // simply not offered.
  const options = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return mandals.filter(
      (m) =>
        num(m?.id) !== fromMandalId &&
        (!needle ||
          [m?.name, m?.area_name, m?.area_code]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [mandals, fromMandalId, query]);

  const submit = async (e) => {
    e.preventDefault();
    if (!target) {
      setError("Choose a mandal to send it to.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const res = await api.transferBook(num(book?.id), num(target.id));
      toast.success(res?.message || "Book moved.");
      onClose?.();
      onTransferred?.();
    } catch (err) {
      // 409 if it closed or went back out to a family since the list loaded.
      setError(errorText(err, "Could not move the book."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SevaSheet
      open={open}
      title={`Send book ${book?.book_no ?? ""}`}
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          <FormError>{error}</FormError>
          <SaveButton busy={submitting} form="transfer-form">
            {target ? `Send to ${target.name}` : "Send book"}
          </SaveButton>
        </>
      }
    >
      <div className="receipt-info mt-0 mb-3">
        <i className="bi bi-journal-bookmark" aria-hidden="true" />
        <span>
          Now in <strong>{book?.mandal_name || "—"}</strong>
          <span className="receipt-info-sub">
            {num(book?.remaining)} left · the next family starts at receipt{" "}
            {num(book?.next_receipt_no)}
          </span>
        </span>
      </div>

      <form id="transfer-form" onSubmit={submit} noValidate>
        {loadError ? (
          <div className="list-state" role="alert">
            <p className="list-state-title">Couldn't load mandals</p>
            <p className="list-state-text">{loadError}</p>
            <button type="button" className="outline-btn" onClick={loadMandals}>
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
                placeholder="Search mandal or xetra"
                aria-label="Search mandals"
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>

            {loading && mandals.length === 0 ? (
              <div aria-busy="true" aria-label="Loading mandals">
                <span className="skeleton-line skeleton-input mt-2" />
                <span className="skeleton-line skeleton-input mt-2" />
                <span className="skeleton-line skeleton-input mt-2" />
              </div>
            ) : (
              <div
                className="pick-list is-tall"
                role="radiogroup"
                aria-label="Send to"
              >
                {options.length === 0 ? (
                  <p className="pick-empty">No other mandal matches.</p>
                ) : (
                  options.map((m) => {
                    const active = num(target?.id) === num(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`pick-item is-two-line${
                          active ? " is-active" : ""
                        }`}
                        onClick={() => {
                          setTarget(m);
                          setError("");
                        }}
                      >
                        <span>
                          <span className="pick-item-title">{m.name}</span>
                          <span className="pick-item-sub">
                            {m.area_name || m.area_code || ""}
                          </span>
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

        <p className="section-hint mt-3 mb-0">
          Receipts already written stay with the mandal that collected them.
        </p>
      </form>
    </SevaSheet>
  );
};

export default TransferBookModal;

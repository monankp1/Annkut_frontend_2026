// src/components/receipt-books/DeassignBookModal.jsx
//
// Takes a book back from a family so it can go to the next one. Admin and the
// mandal's own Sanchalak.
//
// `last_used_no` is the last receipt the family actually wrote, and it carries
// over: hand a book back at 7 and the next parivar starts at 8, not 1. It only
// ever moves forward — the server knows the highest receipt already written and
// answers 422 for anything lower, so that is the floor here too.
import React from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";
import { FieldHint, FormError } from "../AuthFields";

const DeassignBookModal = ({ open, onClose, book, onDeassigned }) => {
  const recorded = num(book?.last_used_no);
  const endNo = num(book?.end_no) || 50;
  const holder = book?.parivar_code || "this family";

  const [lastUsedNo, setLastUsedNo] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setError("");
      setLastUsedNo(String(recorded));
    }
  }, [open, recorded]);

  const n = Number(lastUsedNo || 0);
  const outOfRange =
    lastUsedNo !== "" && (!Number.isInteger(n) || n < recorded || n > endNo);

  const set = (v) => {
    setLastUsedNo(String(Math.min(endNo, Math.max(recorded, v))));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (outOfRange) {
      document.getElementById("last_used_no")?.focus();
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const res = await api.deassignBook(num(book?.id), lastUsedNo);
      toast.success(res?.message || "Receipt book taken back.");
      onClose?.();
      onDeassigned?.();
    } catch (err) {
      // 422 when the number is below what is already recorded — the server
      // message names the floor, so show it rather than swallowing it.
      setError(errorText(err, "Failed to take the book back."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose?.()}
      PaperProps={{ className: "app-dialog" }}
    >
      <DialogTitle>Take back book {book?.book_no}?</DialogTitle>
      <DialogContent>
        <p className="dialog-subtitle">
          Currently with parivar <strong>{holder}</strong>.
        </p>

        <form
          id="deassign-form"
          className="auth-form"
          onSubmit={submit}
          noValidate
        >
          <div className="auth-field">
            <label htmlFor="last_used_no">Last receipt used</label>
            <div className="stepper">
              <button
                type="button"
                className="stepper-btn"
                onClick={() => set(n - 1)}
                disabled={n <= recorded}
                aria-label="One less"
              >
                <i className="bi bi-dash-lg" aria-hidden="true" />
              </button>
              <input
                id="last_used_no"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="done"
                value={lastUsedNo}
                onChange={(e) => {
                  setLastUsedNo(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                aria-invalid={outOfRange}
                aria-describedby="last_used_no_hint"
              />
              <button
                type="button"
                className="stepper-btn"
                onClick={() => set(n + 1)}
                disabled={n >= endNo}
                aria-label="One more"
              >
                <i className="bi bi-plus-lg" aria-hidden="true" />
              </button>
            </div>
            <FieldHint
              id="last_used_no_hint"
              status={outOfRange ? "error" : "info"}
            >
              {outOfRange
                ? `Enter a number between ${recorded} and ${endNo}.`
                : `Between ${recorded} and ${endNo}. The next family continues from ${
                    n + 1
                  }.`}
            </FieldHint>
          </div>

          <div className="notice-box mb-0">
            <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
            <span>
              {holder} won't be able to add any more seva in this book.
            </span>
          </div>

          <FormError>{error}</FormError>
        </form>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting} className="dialog-btn">
          Cancel
        </Button>
        <Button
          type="submit"
          form="deassign-form"
          variant="contained"
          disableElevation
          disabled={submitting}
          className="dialog-btn dialog-btn-primary"
          startIcon={
            submitting ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {submitting ? "Taking back…" : "Take back"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeassignBookModal;

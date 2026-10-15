// src/components/receipt-books/AddBookModal.jsx
//
// Receipt books are printed in two sizes, so the size is a one-tap choice —
// but the numbers stay editable, because a book does not always arrive whole.
// A book printed 1–25 with the first three receipts already torn out is
// entered as 4–25: it still ends at 25, it just starts later.
//
// That is why `pages` is not sent. The server derives end = start + pages - 1
// from it, which would turn a start of 4 into 4–28 — receipt numbers the book
// does not have. Sending start and end outright says exactly what is printed.
import React from "react";
import { toast } from "react-toastify";
import api, { errorText } from "../../api/annkut";
import { FieldHint, FormError } from "../AuthFields";
import SevaSheet from "../seva-form/SevaSheet";
import {
  Field,
  SaveButton,
  advanceOnEnter,
  focusFirstError,
} from "../seva-form/SevaFields";

const PAGE_OPTIONS = [25, 10];
const DEFAULT_PAGES = 25;
const ORDER = ["book_no", "start_no", "end_no"];

const NUMBER_PROPS = {
  type: "text",
  inputMode: "numeric",
  pattern: "[0-9]*",
  autoComplete: "off",
  enterKeyHint: "next",
};

const AddBookModal = ({ open, onClose, mandal, onAdded }) => {
  const [bookNo, setBookNo] = React.useState("");
  const [pages, setPages] = React.useState(DEFAULT_PAGES);
  const [startNo, setStartNo] = React.useState("");
  const [endNo, setEndNo] = React.useState("");
  const [errors, setErrors] = React.useState({});
  const [serverError, setServerError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setBookNo("");
      setPages(DEFAULT_PAGES);
      setStartNo("");
      setEndNo("");
      setErrors({});
      setServerError("");
    }
  }, [open]);

  // Blank means "as printed": start at 1, end at the chosen size.
  const start = startNo === "" ? 1 : Number(startNo);
  const end = endNo === "" ? pages : Number(endNo);
  const count = end - start + 1;
  const rangeInvalid = start < 1 || end < start;

  const digits = (setter, key) => (e) => {
    setter(e.target.value.replace(/\D/g, ""));
    setErrors((p) => ({ ...p, [key]: undefined }));
    setServerError("");
  };

  // The size is a preset for the last receipt number, so changing it moves
  // the end unless the admin has typed one.
  const choosePages = (p) => {
    setPages(p);
    setEndNo("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!mandal?.id) return;

    const errs = {};
    if (!bookNo) errs.book_no = "Enter the book number.";
    if (rangeInvalid) {
      errs.start_no = "The start must be 1 or more, and not past the end.";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      focusFirstError(errs, ORDER);
      return;
    }

    try {
      setSubmitting(true);
      setServerError("");
      const res = await api.createBook({
        mandal_id: mandal.id,
        book_no: bookNo,
        start_no: start,
        end_no: end,
      });
      toast.success(res?.message || "Receipt book created.");
      onClose?.();
      onAdded?.();
    } catch (err) {
      // 409 names the mandal already holding that number — book numbers are
      // unique across the whole organisation, not per mandal.
      setServerError(errorText(err, "Failed to add book."));
    } finally {
      setSubmitting(false);
    }
  };

  const dirty = Boolean(bookNo || startNo || endNo);

  return (
    <SevaSheet
      open={open}
      title="Add book"
      dirty={dirty}
      busy={submitting}
      discardTitle="Discard this book?"
      onClose={onClose}
      footer={
        <>
          <FormError>{serverError}</FormError>
          <SaveButton busy={submitting} form="add-book-form">
            Add book
          </SaveButton>
        </>
      }
    >
      <div className="receipt-info mt-0 mb-3">
        <i className="bi bi-geo-alt" aria-hidden="true" />
        <span>
          Mandal <strong>{mandal?.name || "—"}</strong>
        </span>
      </div>

      <form
        id="add-book-form"
        className="auth-form"
        onSubmit={submit}
        onKeyDown={advanceOnEnter}
        noValidate
      >
        <Field
          id="book_no"
          label="Book number"
          value={bookNo}
          onChange={digits(setBookNo, "book_no")}
          error={errors.book_no}
          hint="Unique across the whole organisation."
          {...NUMBER_PROPS}
        />

        <div className="auth-field">
          <span className="field-label" id="pages_label">
            Receipts in the book
          </span>
          <div
            className="choice-row"
            role="radiogroup"
            aria-labelledby="pages_label"
          >
            {PAGE_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={pages === p}
                className={`choice-btn${pages === p ? " is-active" : ""}`}
                onClick={() => choosePages(p)}
              >
                {p} receipts
              </button>
            ))}
          </div>
        </div>

        <div className="field-pair">
          <Field
            id="start_no"
            label="Start receipt no."
            placeholder="1"
            value={startNo}
            onChange={digits(setStartNo, "start_no")}
            {...NUMBER_PROPS}
            aria-invalid={rangeInvalid}
          />
          <Field
            id="end_no"
            label="End receipt no."
            placeholder={String(pages)}
            value={endNo}
            onChange={digits(setEndNo, "start_no")}
            {...NUMBER_PROPS}
            enterKeyHint="done"
            aria-invalid={rangeInvalid}
          />
        </div>
        <FieldHint status={rangeInvalid ? "error" : "info"}>
          {rangeInvalid
            ? "The start must be 1 or more, and not past the end."
            : `Receipts will be numbered ${start}–${end} (${count} receipt${
                count === 1 ? "" : "s"
              }). Leave blank for 1–${pages}.`}
        </FieldHint>
      </form>
    </SevaSheet>
  );
};

export default AddBookModal;

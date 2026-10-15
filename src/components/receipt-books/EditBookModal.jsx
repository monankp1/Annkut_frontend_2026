// src/components/receipt-books/EditBookModal.jsx
//
// The range is not capped here: the server is the one that refuses a range
// excluding a used receipt. The one check made locally is the obvious one —
// the end cannot fall below a receipt already written.
import React from "react";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";
import { FormError } from "../AuthFields";
import SevaSheet from "../seva-form/SevaSheet";
import {
  Field,
  SaveButton,
  advanceOnEnter,
  focusFirstError,
} from "../seva-form/SevaFields";

const ORDER = ["book_no", "start_no", "end_no"];

const NUMBER_PROPS = {
  type: "text",
  inputMode: "numeric",
  pattern: "[0-9]*",
  autoComplete: "off",
  enterKeyHint: "next",
};

const fromBook = (book) => ({
  book_no: String(book?.book_no ?? ""),
  start_no: String(num(book?.start_no)),
  end_no: String(num(book?.end_no)),
});

const EditBookModal = ({ open, onClose, book, onSaved }) => {
  const [form, setForm] = React.useState(() => fromBook(book));
  const [errors, setErrors] = React.useState({});
  const [serverError, setServerError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && book) {
      setForm(fromBook(book));
      setErrors({});
      setServerError("");
    }
  }, [open, book]);

  const lastUsed = num(book?.last_used_no);

  const update = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value.replace(/[^\d]/g, "") }));
    setErrors((p) => ({ ...p, [k]: undefined }));
    setServerError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!book?.id) return;

    const start_no = form.start_no ? Number(form.start_no) : 0;
    const end_no = form.end_no ? Number(form.end_no) : 0;

    const errs = {};
    if (!form.book_no) errs.book_no = "Enter the book number.";
    if (!start_no) errs.start_no = "Required.";
    if (!end_no) errs.end_no = "Required.";
    else if (start_no && start_no > end_no) {
      errs.end_no = "Must not be below the start number.";
    } else if (lastUsed > 0 && end_no < lastUsed) {
      errs.end_no = `Receipt ${lastUsed} is already used, so the end can't be below it.`;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      focusFirstError(errs, ORDER);
      return;
    }

    try {
      setSaving(true);
      setServerError("");
      const res = await api.updateBook(num(book.id), {
        book_no: form.book_no,
        start_no,
        end_no,
      });
      toast.success(res?.message || "Receipt book updated.");
      onClose?.();
      onSaved?.();
    } catch (err) {
      setServerError(errorText(err, "Failed to update book."));
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    Boolean(book) && JSON.stringify(form) !== JSON.stringify(fromBook(book));

  return (
    <SevaSheet
      open={open}
      title={`Edit book ${book?.book_no ?? ""}`}
      dirty={dirty}
      busy={saving}
      discardTitle="Discard changes?"
      discardText="Your changes to this book will be lost."
      onClose={onClose}
      footer={
        <>
          <FormError>{serverError}</FormError>
          <SaveButton busy={saving} form="edit-book-form">
            Save changes
          </SaveButton>
        </>
      }
    >
      <div className="receipt-info mt-0 mb-3">
        <i className="bi bi-journal-bookmark" aria-hidden="true" />
        <span>
          {book?.mandal_name || "This mandal"}
          {lastUsed > 0 && (
            <span className="receipt-info-sub">
              Receipt {lastUsed} already used
            </span>
          )}
        </span>
      </div>

      <form
        id="edit-book-form"
        className="auth-form"
        onSubmit={handleSave}
        onKeyDown={advanceOnEnter}
        noValidate
      >
        <Field
          id="book_no"
          label="Book number"
          value={form.book_no}
          onChange={update("book_no")}
          error={errors.book_no}
          {...NUMBER_PROPS}
        />
        <div className="field-pair">
          <Field
            id="start_no"
            label="Start receipt no."
            value={form.start_no}
            onChange={update("start_no")}
            error={errors.start_no}
            {...NUMBER_PROPS}
          />
          <Field
            id="end_no"
            label="End receipt no."
            value={form.end_no}
            onChange={update("end_no")}
            error={errors.end_no}
            {...NUMBER_PROPS}
            enterKeyHint="done"
          />
        </div>
      </form>
    </SevaSheet>
  );
};

export default EditBookModal;

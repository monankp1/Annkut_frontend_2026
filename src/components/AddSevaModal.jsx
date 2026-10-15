import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import api, { num, errorText } from "../api/annkut";
import { cleanPhone } from "../utils/phone";
import { amountForBook, amountRuleForBook } from "../utils/sevaAmount";
import { FieldHint, FormError } from "./AuthFields";
import SevaSheet from "./seva-form/SevaSheet";
import {
  AmountPicker,
  FormSkeleton,
  SahyogiFields,
  SaveButton,
  advanceOnEnter,
  focusFirstError,
  validateSahyogi,
} from "./seva-form/SevaFields";

const EMPTY_FORM = {
  book_id: "",
  receipt_no: "",
  seva_amount: "500",
  sahyogi_surname: "",
  sahyogi_first_name: "",
  sahyogi_middle_name: "",
  sahyogi_number: "",
};

// Books are addressed by book_id; book_no is only what is on the cover.
const bookLabel = (b) =>
  `Book ${b?.book_no ?? ""} · ${num(b?.start_no)}–${num(b?.end_no)} · ${num(
    b?.remaining
  )} left`;

/**
 * `onBehalfOf` is the family member whose tab is open. The seva is credited to
 * them, not to whoever is typing — the book is the household's either way.
 *
 * Success is toasted through the host page's container; this form has none of
 * its own, because a second container unregisters the page's when it closes.
 */
function AddSevaModal({ modal, setModal, onBehalfOf, onAdded }) {
  const [loader, setLoader] = useState(false);

  const [myBooks, setMyBooks] = useState([]);
  // Finished books, kept only so a family with nothing left to write in is
  // told why rather than seeing an empty dropdown.
  const [fullBooks, setFullBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState("");

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [customAmount, setCustomAmount] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const close = () => setModal(false);

  const selectedBook = useMemo(
    () => myBooks.find((b) => String(b.id) === String(formData.book_id)),
    [myBooks, formData.book_id]
  );

  // Which amounts this book collects: 25 receipts means ₹500, 10 means ₹1000+.
  const amountRule = useMemo(
    () => amountRuleForBook(selectedBook),
    [selectedBook]
  );

  // The book settles the receipt number and the amount, so moving to another
  // book moves both to something that book allows.
  const applyBook = useCallback((b) => {
    setFormData((p) => ({
      ...p,
      book_id: b ? String(b.id) : "",
      receipt_no: b?.next_receipt_no ? String(b.next_receipt_no) : "",
      seva_amount: amountForBook(b, p.seva_amount),
    }));
  }, []);

  // A custom amount only means something while "Other" is chosen.
  useEffect(() => {
    if (formData.seva_amount !== "other") setCustomAmount("");
  }, [formData.seva_amount]);

  const request = useRef(0);

  const loadBooks = useCallback(async () => {
    const id = ++request.current;
    setBooksLoading(true);
    setBooksError("");
    try {
      const { books, full_books } = await api.myBooksWithFull();
      if (id !== request.current) return;
      setMyBooks(books);
      setFullBooks(full_books);
      // Most families hold one book; choose it rather than make them pick it
      // for every receipt.
      if (books.length === 1) applyBook(books[0]);
    } catch (e) {
      console.error("my_books error:", e);
      if (id !== request.current) return;
      setBooksError(errorText(e, "Unable to load your books."));
      setMyBooks([]);
      setFullBooks([]);
    } finally {
      if (id === request.current) setBooksLoading(false);
    }
  }, [applyBook]);

  useEffect(() => {
    if (!modal) return undefined;
    loadBooks();
    return () => {
      request.current += 1;
    };
  }, [modal, loadBooks]);

  const clearError = (name) => {
    setErrors((p) => {
      if (!p[name]) return p;
      const { [name]: _gone, ...rest } = p;
      return rest;
    });
    if (serverError) setServerError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const v = name === "sahyogi_number" ? cleanPhone(value) : value;
    setFormData((p) => ({ ...p, [name]: v }));
    clearError(name);
  };

  const handleBookChange = (e) => {
    applyBook(myBooks.find((x) => String(x.id) === String(e.target.value)));
    clearError("book_id");
    clearError("receipt_no");
  };

  const selectAmount = (value) => {
    setFormData((p) => ({ ...p, seva_amount: value }));
    clearError("customAmount");
  };

  const handleCustomAmountChange = (e) => {
    setCustomAmount(e.target.value.replace(/[^\d]/g, ""));
    clearError("customAmount");
  };

  const validateForm = () => {
    const errs = {};

    if (!formData.book_id) errs.book_id = "બુક નંબર પસંદ કરો";
    if (!formData.receipt_no) errs.receipt_no = "રસીદ નંબર લખો";

    Object.assign(errs, validateSahyogi(formData, customAmount));

    // The server checks the range too and answers 422; catching it here saves
    // a round trip on the common mistake.
    if (selectedBook) {
      const r = num(formData.receipt_no);
      const s = num(selectedBook.start_no);
      const e = num(selectedBook.end_no);
      if (s && e && (r < s || r > e)) {
        errs.receipt_no = `રસીદ ${s} થી ${e} વચ્ચે લખો`;
      }
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      focusFirstError(formErrors);
      return;
    }

    setLoader(true);
    setServerError("");

    try {
      const res = await api.addSeva({
        book_id: Number(formData.book_id),
        receipt_no: Number(formData.receipt_no),
        seva_amount: Number(
          formData.seva_amount === "other" ? customAmount : formData.seva_amount
        ),
        sahyogi_surname: formData.sahyogi_surname.trim(),
        sahyogi_first_name: formData.sahyogi_first_name.trim(),
        sahyogi_middle_name: formData.sahyogi_middle_name.trim(),
        sahyogi_number: formData.sahyogi_number,
        onBehalfOf: onBehalfOf?.is_self ? undefined : onBehalfOf?.sevak_code,
      });

      toast.success(res?.message || "Seva Added Successfully");

      if (typeof onAdded === "function") onAdded();
      close();
    } catch (error) {
      console.error("add_seva error:", error);
      // 409 duplicate receipt, 422 out of range, 403 not your book. Kept on
      // screen above Save rather than in a toast that is gone in seconds.
      setServerError(errorText(error, "Failed to add Seva"));
    } finally {
      setLoader(false);
    }
  };

  // Only what they typed counts; the auto-picked book does not.
  const dirty = Boolean(
    formData.sahyogi_surname ||
      formData.sahyogi_first_name ||
      formData.sahyogi_middle_name ||
      formData.sahyogi_number ||
      customAmount
  );

  const showForm = !booksError && (myBooks.length > 0 || booksLoading);
  const forSomeoneElse = onBehalfOf && !onBehalfOf.is_self;

  let body;
  if (booksLoading && myBooks.length === 0) {
    body = <FormSkeleton />;
  } else if (booksError) {
    body = (
      <div className="list-state" role="alert">
        <i className="bi bi-wifi-off list-state-icon" aria-hidden="true" />
        <p className="list-state-title">Couldn't load your books</p>
        <p className="list-state-text">{booksError}</p>
        <button type="button" className="outline-btn" onClick={loadBooks}>
          <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
        </button>
      </div>
    );
  } else if (myBooks.length === 0) {
    // A finished book disappears from the list, which looks like the family
    // has none at all. Say what actually happened.
    body = (
      <div className="list-state">
        <i className="bi bi-journal-x list-state-icon" aria-hidden="true" />
        <p className="list-state-title">
          {fullBooks.length === 1
            ? `બુક ${fullBooks[0].book_no} પૂરી થઈ ગઈ છે.`
            : fullBooks.length > 1
            ? "તમારી બધી બુક પૂરી થઈ ગઈ છે."
            : "No receipt book has been issued to your parivar."}
        </p>
        <p className="list-state-text">
          {fullBooks.length > 0
            ? "નવી બુક માટે તમારા સંચાલકનો સંપર્ક કરો."
            : "Contact your sanchalak."}
        </p>
      </div>
    );
  } else {
    body = (
      <form
        id="seva-form"
        className="auth-form"
        onSubmit={handleSubmit}
        onKeyDown={advanceOnEnter}
        noValidate
      >
        <div className="auth-field">
          <label htmlFor="book_id">બુક નંબર</label>
          <select
            id="book_id"
            name="book_id"
            value={formData.book_id}
            onChange={handleBookChange}
            aria-invalid={Boolean(errors.book_id)}
          >
            <option value="" disabled>
              Choose a book
            </option>
            {myBooks.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {bookLabel(b)}
              </option>
            ))}
          </select>
          {errors.book_id && (
            <FieldHint status="error">{errors.book_id}</FieldHint>
          )}

          {/* Set from the book, not typed — shown as information. */}
          <div className="receipt-info">
            <i className="bi bi-receipt" aria-hidden="true" />
            {selectedBook ? (
              <span>
                Receipt no. <strong>{formData.receipt_no || "—"}</strong>
                <span className="receipt-info-sub">
                  {num(selectedBook.remaining)} left in this book
                </span>
              </span>
            ) : (
              <span>પહેલા બુક પસંદ કરો</span>
            )}
          </div>
          {errors.receipt_no && (
            <FieldHint status="error">{errors.receipt_no}</FieldHint>
          )}
        </div>

        <SahyogiFields
          form={formData}
          errors={errors}
          onChange={handleChange}
        />

        <AmountPicker
          value={formData.seva_amount}
          customAmount={customAmount}
          rule={amountRule}
          error={errors.customAmount}
          onSelect={selectAmount}
          onCustomChange={handleCustomAmountChange}
        />
      </form>
    );
  }

  return (
    <SevaSheet
      open={modal}
      title="Add seva"
      dirty={dirty}
      busy={loader}
      onClose={close}
      footer={
        showForm && (
          <>
            <FormError>{serverError}</FormError>
            <SaveButton busy={loader} disabled={booksLoading}>
              Save
            </SaveButton>
          </>
        )
      }
    >
      {/* Adding while another member's tab is open credits it to them. */}
      {forSomeoneElse && (
        <div className="behalf-banner">
          <span className="member-avatar" aria-hidden="true">
            {(onBehalfOf.full_name || "?").trim().charAt(0)}
          </span>
          <span>
            <span className="behalf-label">Recording for</span>
            <span className="behalf-name">
              {onBehalfOf.full_name} · {onBehalfOf.sevak_code}
            </span>
          </span>
        </div>
      )}

      {body}
    </SevaSheet>
  );
}

export default AddSevaModal;

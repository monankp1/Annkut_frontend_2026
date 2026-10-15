// src/components/EditSevaModal.jsx
//
// Karyakar only. An ordinary sevak gets 403 even on an entry they recorded
// themselves, because once the paper receipt is written the record has to keep
// matching it — so the button that opens this is gated on access scope.
//
// Shares its fields and sheet with AddSevaModal. Success is toasted through
// the host page's container; this form has none of its own, because a second
// container unregisters the page's when it closes.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import api, { num, errorText } from "../api/annkut";
import { cleanPhone } from "../utils/phone";
import { amountRuleForBook } from "../utils/sevaAmount";
import { FormError } from "./AuthFields";
import SevaSheet from "./seva-form/SevaSheet";
import {
  AmountPicker,
  Field,
  FormSkeleton,
  SahyogiFields,
  SaveButton,
  advanceOnEnter,
  focusFirstError,
  validateSahyogi,
} from "./seva-form/SevaFields";

const EMPTY_FORM = {
  receipt_no: "",
  seva_amount: "500",
  sahyogi_surname: "",
  sahyogi_first_name: "",
  sahyogi_middle_name: "",
  sahyogi_number: "",
};

function EditSevaModal({ modal, setModal, sevakData, refreshData }) {
  const sevaId = useMemo(
    () => sevakData?.id ?? sevakData?.seva_id,
    [sevakData]
  );

  const [loader, setLoader] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [customAmount, setCustomAmount] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  // What was loaded, to tell whether anything has been changed since.
  const [initial, setInitial] = useState(null);

  // A receipt may move to another number inside its own book, never to a
  // different book — so the book is shown, not chosen.
  const [book, setBook] = useState({ book_no: "", start_no: 0, end_no: 0 });

  // The same size rule as the add form, with one allowance: whatever is
  // already recorded stays selectable, so an entry made before the rule — or
  // on an odd-sized book — can still be corrected without being forced onto a
  // different amount.
  const amountRule = useMemo(() => {
    const rule = amountRuleForBook(book);
    const current = formData.seva_amount;
    return {
      ...rule,
      allow500: rule.allow500 || current === "500",
      allow1000: rule.allow1000 || current === "1000",
      allowOther: rule.allowOther || current === "other",
    };
  }, [book, formData.seva_amount]);

  const close = () => setModal(false);

  // A custom amount only means something while "Other" is chosen.
  useEffect(() => {
    if (formData.seva_amount !== "other") setCustomAmount("");
  }, [formData.seva_amount]);

  const request = useRef(0);

  const load = useCallback(async () => {
    if (!sevaId) return;
    const id = ++request.current;
    setFetching(true);
    setFetchError("");
    try {
      const s = (await api.seva(sevaId)) || {};
      if (id !== request.current) return;

      // "500.00" and "500" are the same preset as far as the picker cares;
      // anything else is a custom amount.
      const amt = String(num(s.seva_amount));
      const isPreset = amt === "500" || amt === "1000";

      const loaded = {
        receipt_no: String(s.receipt_no ?? ""),
        seva_amount: isPreset ? amt : "other",
        sahyogi_surname: String(s.sahyogi_surname ?? ""),
        sahyogi_first_name: String(s.sahyogi_first_name ?? ""),
        sahyogi_middle_name: String(s.sahyogi_middle_name ?? ""),
        sahyogi_number: String(s.sahyogi_number ?? ""),
      };
      const loadedCustom = isPreset ? "" : amt;

      setFormData(loaded);
      setCustomAmount(loadedCustom);
      setInitial(JSON.stringify([loaded, loadedCustom]));
      setBook({
        book_no: s.book_no ?? "",
        start_no: num(s.start_no),
        end_no: num(s.end_no),
      });
      setErrors({});
    } catch (e) {
      console.error("Error fetching seva by id:", e);
      if (id !== request.current) return;
      setFetchError(errorText(e, "Unable to fetch seva details."));
    } finally {
      if (id === request.current) setFetching(false);
    }
  }, [sevaId]);

  useEffect(() => {
    if (!modal) return undefined;
    load();
    return () => {
      request.current += 1;
    };
  }, [modal, load]);

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

    let nextValue = value;
    if (name === "sahyogi_number") nextValue = cleanPhone(value);
    else if (name === "receipt_no") nextValue = value.replace(/[^\d]/g, "");

    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    clearError(name);
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
    const formErrors = {};

    if (!formData.receipt_no) formErrors.receipt_no = "રસીદ નંબર લખો";

    Object.assign(formErrors, validateSahyogi(formData, customAmount));

    if (book.start_no && book.end_no) {
      const r = num(formData.receipt_no);
      if (r < book.start_no || r > book.end_no) {
        formErrors.receipt_no = `રસીદ ${book.start_no} થી ${book.end_no} વચ્ચે લખો`;
      }
    }

    return formErrors;
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
      const res = await api.editSeva(sevaId, {
        receipt_no: Number(formData.receipt_no),
        seva_amount: Number(
          formData.seva_amount === "other" ? customAmount : formData.seva_amount
        ),
        sahyogi_surname: formData.sahyogi_surname.trim(),
        sahyogi_first_name: formData.sahyogi_first_name.trim(),
        sahyogi_middle_name: formData.sahyogi_middle_name.trim(),
        sahyogi_number: formData.sahyogi_number,
      });

      toast.success(res?.message || "Seva updated successfully");
      close();
      if (typeof refreshData === "function") refreshData();
    } catch (error) {
      console.error("Error editing seva:", error);
      setServerError(errorText(error, "Failed to update seva."));
    } finally {
      setLoader(false);
    }
  };

  const dirty =
    initial !== null && JSON.stringify([formData, customAmount]) !== initial;

  let body;
  if (fetching) {
    body = <FormSkeleton />;
  } else if (fetchError) {
    body = (
      <div className="list-state" role="alert">
        <i className="bi bi-wifi-off list-state-icon" aria-hidden="true" />
        <p className="list-state-title">Couldn't load this entry</p>
        <p className="list-state-text">{fetchError}</p>
        <button type="button" className="outline-btn" onClick={load}>
          <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
        </button>
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
        <div className="receipt-info mt-0 mb-3">
          <i className="bi bi-journal-bookmark" aria-hidden="true" />
          <span>
            બુક નંબર <strong>{book.book_no || "—"}</strong>
            {Boolean(book.start_no || book.end_no) && (
              <span className="receipt-info-sub">
                Receipts {book.start_no}–{book.end_no}
              </span>
            )}
          </span>
        </div>

        <Field
          id="receipt_no"
          label="રસીદ નંબર"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="next"
          value={formData.receipt_no}
          onChange={handleChange}
          error={errors.receipt_no}
        />

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
      title="Edit seva"
      dirty={dirty}
      busy={loader}
      discardTitle="Discard changes?"
      discardText="Your changes to this entry will be lost."
      onClose={close}
      footer={
        !fetchError && (
          <>
            <FormError>{serverError}</FormError>
            <SaveButton busy={loader} disabled={fetching}>
              Save changes
            </SaveButton>
          </>
        )
      }
    >
      {body}
    </SevaSheet>
  );
}

export default EditSevaModal;

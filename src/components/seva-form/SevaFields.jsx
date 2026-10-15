import React from "react";
import { FieldHint } from "../AuthFields";
import {
  isCompletePhone,
  phoneInputProps,
  PHONE_ERROR_GU,
  PHONE_LENGTH,
} from "../../utils/phone";

// Fields, checks and keyboard handling shared by the Add and Edit seva forms,
// so the two cannot drift apart. Styles live in App.css.

/** Field-level checks both forms share. Keys match the input ids. */
export function validateSahyogi(form, customAmount) {
  const errs = {};

  if (!form.sahyogi_surname.trim()) errs.sahyogi_surname = "સહયોગી ની અટક લખો";
  if (!form.sahyogi_first_name.trim())
    errs.sahyogi_first_name = "સહયોગી નું નામ લખો";
  if (!form.sahyogi_middle_name.trim())
    errs.sahyogi_middle_name = "સહયોગી ના પિતા નું નામ લખો";
  if (!form.sahyogi_number) errs.sahyogi_number = "સહયોગી નો નંબર લખો";
  else if (!isCompletePhone(form.sahyogi_number))
    errs.sahyogi_number = PHONE_ERROR_GU;

  if (form.seva_amount === "other") {
    if (!customAmount) {
      errs.customAmount = "Custom amount is required";
    } else if (parseInt(customAmount, 10) <= 1000) {
      errs.customAmount = "રકમ 1000 કરતા વધારે હોય તો જ લખો";
    }
  }

  return errs;
}

// Screen order, so the first problem is the one we take them to.
const FIELD_ORDER = [
  "book_id",
  "receipt_no",
  "sahyogi_surname",
  "sahyogi_first_name",
  "sahyogi_middle_name",
  "sahyogi_number",
  "customAmount",
];

/**
 * On a phone the field with the problem is often scrolled off screen, so
 * pressing Save would seem to do nothing. Bring the first one into view.
 * `order` is the form's field ids top to bottom (the seva form's by default).
 */
export function focusFirstError(errs, order = FIELD_ORDER) {
  const el = order
    .filter((k) => errs[k])
    .map((k) => document.getElementById(k))
    .find(Boolean);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}

/**
 * Enter moves to the next field; only the last one submits. Without this the
 * keyboard's Enter key submits a half-filled form from the first box.
 */
export function advanceOnEnter(e) {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  const fields = Array.from(e.currentTarget.elements).filter(
    (el) =>
      (el.tagName === "INPUT" || el.tagName === "SELECT") &&
      !el.disabled &&
      !el.readOnly &&
      el.type !== "hidden",
  );
  const i = fields.indexOf(e.target);
  if (i >= 0 && i < fields.length - 1) {
    e.preventDefault();
    fields[i + 1].focus();
  }
}

/** Label above, 48px input, error or hint underneath. */
export const Field = ({ id, label, error, hint, counter, ...input }) => {
  const hintId = error || hint ? `${id}_hint` : undefined;
  return (
    <div className="auth-field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        {counter && <span className="field-counter">{counter}</span>}
      </div>
      <input
        id={id}
        name={id}
        aria-invalid={Boolean(error)}
        aria-describedby={hintId}
        {...input}
      />
      {error ? (
        <FieldHint id={hintId} status="error">
          {error}
        </FieldHint>
      ) : hint ? (
        <FieldHint id={hintId}>{hint}</FieldHint>
      ) : null}
    </div>
  );
};

// The sahyogi's details, not the sevak's: keep the browser from offering the
// signed-in sevak's own name and number here.
const NAME_PROPS = {
  type: "text",
  autoComplete: "off",
  autoCapitalize: "words",
  autoCorrect: "off",
  spellCheck: false,
  enterKeyHint: "next",
};

/**
 * Three name boxes rather than one: given a single box no two sevaks fill the
 * name in the same order.
 */
export const SahyogiFields = ({ form, errors, onChange }) => (
  <>
    <Field
      id="sahyogi_surname"
      label="સહયોગી ની અટક"
      value={form.sahyogi_surname}
      onChange={onChange}
      error={errors.sahyogi_surname}
      {...NAME_PROPS}
    />
    <Field
      id="sahyogi_first_name"
      label="સહયોગી નું નામ"
      value={form.sahyogi_first_name}
      onChange={onChange}
      error={errors.sahyogi_first_name}
      {...NAME_PROPS}
    />
    <Field
      id="sahyogi_middle_name"
      label="સહયોગી ના પિતા/પતિ નું નામ"
      value={form.sahyogi_middle_name}
      onChange={onChange}
      error={errors.sahyogi_middle_name}
      {...NAME_PROPS}
    />
    <Field
      id="sahyogi_number"
      label="સહયોગી નો ફોન નંબર"
      type="tel"
      autoComplete="off"
      enterKeyHint="next"
      value={form.sahyogi_number || ""}
      onChange={onChange}
      error={errors.sahyogi_number}
      counter={`${(form.sahyogi_number || "").length}/${PHONE_LENGTH}`}
      {...phoneInputProps}
    />
  </>
);

const AMOUNT_OPTIONS = [
  { value: "500", label: "₹500", allow: "allow500" },
  { value: "1000", label: "₹1,000", allow: "allow1000" },
  { value: "other", label: "Other", allow: "allowOther" },
];

/**
 * Big segmented buttons rather than radios. Only the amounts the book
 * collects are offered; when that leaves one, it is shown locked with the
 * reason underneath.
 */
export const AmountPicker = ({
  value,
  customAmount,
  rule,
  error,
  onSelect,
  onCustomChange,
}) => {
  const allowed = AMOUNT_OPTIONS.filter((o) => rule[o.allow]);

  return (
    <>
      <div className="auth-field">
        <span className="field-label" id="amount_label">
          Amount
        </span>
        {allowed.length === 1 ? (
          <div className="amount-locked">
            <i className="bi bi-lock-fill" aria-hidden="true" />
            {allowed[0].label}
          </div>
        ) : (
          <div
            className="amount-segments"
            role="radiogroup"
            aria-labelledby="amount_label"
          >
            {allowed.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={value === o.value}
                className={`amount-segment${
                  value === o.value ? " is-active" : ""
                }`}
                onClick={() => onSelect(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {rule.note && <FieldHint>{rule.note}</FieldHint>}
      </div>

      {value === "other" && (
        <div className="auth-field">
          <label htmlFor="customAmount">Enter Custom Amount</label>
          <div className="input-prefix">
            <span className="input-prefix-symbol" aria-hidden="true">
              ₹
            </span>
            <input
              id="customAmount"
              name="customAmount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              enterKeyHint="done"
              value={customAmount}
              onChange={onCustomChange}
              aria-invalid={Boolean(error)}
              aria-describedby="customAmount_hint"
            />
          </div>
          <FieldHint id="customAmount_hint" status={error ? "error" : "info"}>
            {error || "More than ₹1,000"}
          </FieldHint>
        </div>
      )}
    </>
  );
};

/** The form's Save button, with the same loading state as the rest of the app. */
export const SaveButton = ({
  busy,
  disabled,
  form = "seva-form",
  children,
}) => (
  <button
    type="submit"
    form={form}
    className="brand-btn"
    disabled={busy || disabled}
  >
    {busy ? (
      <>
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>Saving…</span>
      </>
    ) : (
      children
    )}
  </button>
);

/** Grey placeholder lines while the form's data loads. */
export const FormSkeleton = () => (
  <div aria-busy="true" aria-label="Loading">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="auth-field">
        <span className="skeleton-line sk-40 mb-2" />
        <span className="skeleton-line skeleton-input" />
      </div>
    ))}
  </div>
);

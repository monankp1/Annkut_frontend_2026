import React from "react";
import { Field } from "../seva-form/SevaFields";
import { FieldHint } from "../AuthFields";
import { phoneInputProps, PHONE_LENGTH } from "../../utils/phone";

// Fields shared by the Add and Edit sevak forms, so the two cannot drift
// apart. Styles live in App.css.

export const PANKH_OPTIONS = [
  { code: "S", label: "Sanyukt" },
  { code: "M", label: "Mahila" },
  { code: "YK", label: "Yuvak" },
  { code: "YT", label: "Yuvati" },
  { code: "BL", label: "Bal" },
  { code: "BK", label: "Balika" },
];

/** Field ids top to bottom, for taking them to the first problem. */
export const SEVAK_FIELD_ORDER = [
  "parivar_code",
  "sevak_code",
  "surname",
  "first_name",
  "middle_name",
  "mobile",
  "target_forms",
];

// The sevak's own details, not the person typing: keep the browser from
// offering the signed-in user's name and number.
const NAME_PROPS = {
  type: "text",
  autoComplete: "off",
  autoCapitalize: "words",
  autoCorrect: "off",
  spellCheck: false,
  enterKeyHint: "next",
};

/**
 * The name is stored in three parts and full_name is rebuilt from them
 * server-side, so it is edited as three fields rather than one.
 */
export const NameAndMobileFields = ({ form, errors, onChange }) => (
  <>
    <Field
      id="surname"
      label="Surname"
      value={form.surname}
      onChange={onChange}
      error={errors.surname}
      {...NAME_PROPS}
    />
    <Field
      id="first_name"
      label="First name"
      value={form.first_name}
      onChange={onChange}
      error={errors.first_name}
      {...NAME_PROPS}
    />
    <Field
      id="middle_name"
      label="Father's / Husband's name"
      value={form.middle_name}
      onChange={onChange}
      error={errors.middle_name}
      {...NAME_PROPS}
    />
    <Field
      id="mobile"
      label="Mobile"
      type="tel"
      autoComplete="off"
      enterKeyHint="next"
      value={form.mobile}
      onChange={onChange}
      error={errors.mobile}
      counter={`${(form.mobile || "").length}/${PHONE_LENGTH}`}
      {...phoneInputProps}
    />
  </>
);

/**
 * One tap per pankh instead of a dropdown. With `allowNone`, tapping the
 * chosen one again clears it — 19 sevaks legitimately have no pankh, and it
 * must never be filled in with a guess.
 */
export const PankhPicker = ({ value, onChange, allowNone = false }) => (
  <div className="auth-field">
    <span className="field-label" id="pankh_label">
      Pankh
    </span>
    <div
      className="choice-grid"
      role="radiogroup"
      aria-labelledby="pankh_label"
    >
      {PANKH_OPTIONS.map((p) => {
        const active = value === p.code;
        return (
          <button
            key={p.code}
            type="button"
            role="radio"
            aria-checked={active}
            className={`choice-btn${active ? " is-active" : ""}`}
            onClick={() => onChange(active && allowNone ? "" : p.code)}
          >
            {p.label}
          </button>
        );
      })}
    </div>
    {allowNone && !value && <FieldHint>Not set</FieldHint>}
  </div>
);

/** Whole number with − / + either side; never below zero. */
export const TargetStepper = ({ value, onChange, error }) => {
  const n = Number(value || 0);
  const set = (next) => onChange(String(Math.max(0, next)));

  return (
    <div className="auth-field">
      <label htmlFor="target_forms">Target</label>
      <div className="stepper">
        <button
          type="button"
          className="stepper-btn"
          onClick={() => set(n - 1)}
          disabled={n <= 0}
          aria-label="Decrease target"
        >
          <i className="bi bi-dash-lg" aria-hidden="true" />
        </button>
        <input
          id="target_forms"
          name="target_forms"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          aria-invalid={Boolean(error)}
          aria-describedby="target_forms_hint"
        />
        <button
          type="button"
          className="stepper-btn"
          onClick={() => set(n + 1)}
          aria-label="Increase target"
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
        </button>
      </div>
      <FieldHint id="target_forms_hint" status={error ? "error" : "info"}>
        {error || "Also moves the mandal target by the same amount."}
      </FieldHint>
    </div>
  );
};

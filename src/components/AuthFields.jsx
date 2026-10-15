import React, { useState } from "react";

// Shared pieces of the sign-in, change-password and reset-password forms, so
// the three screens look and behave the same. Styles live in App.css.

/**
 * A password input with a show/hide eye. Every prop goes to the <input>, so
 * it is used exactly like one.
 */
export const PasswordInput = (props) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        <i className={visible ? "bi bi-eye-slash" : "bi bi-eye"} aria-hidden="true" />
      </button>
    </div>
  );
};

const HINT_ICONS = {
  info: "bi-info-circle",
  ok: "bi-check-circle-fill",
  error: "bi-exclamation-circle-fill",
};

/** The line under a field: a neutral rule, a green tick, or a red problem. */
export const FieldHint = ({ id, status = "info", children }) => (
  <p id={id} className={`field-hint is-${status}`} aria-live="polite">
    <i className={`bi ${HINT_ICONS[status]}`} aria-hidden="true" />
    <span>{children}</span>
  </p>
);

/** What the server said went wrong, under the submit button. */
export const FormError = ({ children }) =>
  children ? (
    <p className="form-error" role="alert">
      <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
      <span>{children}</span>
    </p>
  ) : null;

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import api, { errorText } from "../api/annkut";
import {
  cleanPhone,
  isCompletePhone,
  phoneInputProps,
  PHONE_ERROR,
} from "../utils/phone";
import { PasswordInput, FieldHint, FormError } from "../components/AuthFields";

const MIN_LENGTH = 6;

// Reached from the login screen by somebody who cannot sign in at all, so it
// takes no token: the Sevak ID plus the mobile on file stand in for the old
// password. Anyone who can already sign in uses /change-password instead.
const ForgotPassword = () => {
  const [loader, setLoader] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    sevak_id: "",
    phone_number: "",
    password: "",
  });

  const navigate = useNavigate();

  const phoneOk = isCompletePhone(form.phone_number);
  const lengthOk = form.password.length >= MIN_LENGTH;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: name === "phone_number" ? cleanPhone(value) : value,
    });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    // The problem is already spelled out under the field; just take them there.
    const firstBad = !phoneOk ? "phone_number" : !lengthOk ? "password" : null;
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return;
    }

    setLoader(true);
    setError("");

    try {
      const res = await api.forgotPassword(
        form.sevak_id.trim(),
        form.phone_number,
        form.password
      );

      // Shown by the login page's toast container; see ChangePassword.
      toast.success(res?.message || "Password reset. Please sign in.");
      navigate("/", { replace: true });
    } catch (error) {
      // 404 is returned for a wrong Sevak ID and a wrong number alike, so the
      // message stays as the server worded it.
      setError(errorText(error, "Could not reset the password."));
    } finally {
      setLoader(false);
    }
  };

  const backToLogin = () => navigate("/", { replace: true });

  return (
    <div className="pw-page">
      <header className="app-bar">
        <button
          type="button"
          className="app-bar-back"
          onClick={backToLogin}
          aria-label="Back to login"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <h1 className="app-bar-title">Reset password</h1>
      </header>

      <main className="pw-body">
        <p className="pw-meta">
          Enter your Sevak ID and the phone number registered against it, then
          choose a new password.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="sevak_id">Sevak ID</label>
            <input
              id="sevak_id"
              type="text"
              name="sevak_id"
              onChange={handleChange}
              value={form.sevak_id}
              autoCapitalize="characters"
              autoComplete="username"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="phone_number">Registered phone number</label>
            <input
              id="phone_number"
              type="tel"
              name="phone_number"
              onChange={handleChange}
              value={form.phone_number}
              {...phoneInputProps}
              autoComplete="tel-national"
              enterKeyHint="next"
              aria-describedby="phone_number_hint"
              aria-invalid={submitted && !phoneOk}
              required
            />
            {submitted && !phoneOk && (
              <FieldHint id="phone_number_hint" status="error">
                {PHONE_ERROR}
              </FieldHint>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="password">New password</label>
            <PasswordInput
              id="password"
              name="password"
              onChange={handleChange}
              value={form.password}
              autoComplete="new-password"
              enterKeyHint="done"
              aria-describedby="password_hint"
              aria-invalid={submitted && !lengthOk}
              required
            />
            <FieldHint
              id="password_hint"
              status={lengthOk ? "ok" : submitted ? "error" : "info"}
            >
              At least {MIN_LENGTH} characters
            </FieldHint>
          </div>

          <button type="submit" disabled={loader} className="brand-btn mt-2">
            {loader ? (
              <>
                <span
                  className="spinner-border spinner-border-sm"
                  aria-hidden="true"
                />
                <span>Saving…</span>
              </>
            ) : (
              "Reset password"
            )}
          </button>

          <FormError>{error}</FormError>

          <Link to="/" replace className="text-btn">
            Back to login
          </Link>
        </form>
      </main>
    </div>
  );
};

export default ForgotPassword;

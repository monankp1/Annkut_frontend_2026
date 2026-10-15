import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api, { errorText } from "../api/annkut";
import { getSevak, landingPath } from "../api/session";
import { PasswordInput, FieldHint, FormError } from "../components/AuthFields";

const MIN_LENGTH = 6;

// Changing a password now proves you know the current one, so this screen sits
// behind the login rather than in front of it. There is no self-service reset:
// that needs an OTP flow the backend does not have yet.
//
// Two ways in: forced on first sign-in (must_change_password), or by choice
// from the header menu. Only the second gets a back arrow; the first has to
// finish here or sign out.
const ChangePassword = () => {
  const [loader, setLoader] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const navigate = useNavigate();
  const sevak = getSevak();
  const firstTime = Boolean(sevak?.must_change_password);

  const lengthOk = form.new_password.length >= MIN_LENGTH;
  const sameAsCurrent =
    form.new_password !== "" && form.new_password === form.current_password;
  const matches =
    form.confirm_password !== "" &&
    form.confirm_password === form.new_password;
  // Judge the confirmation once it is as long as the new password, not from
  // its first character, or it shouts "don't match" the whole time they type.
  const showMatch =
    submitted ||
    (form.confirm_password !== "" &&
      form.confirm_password.length >= form.new_password.length);
  const newInvalid = sameAsCurrent || (submitted && !lengthOk);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    // The problem is already spelled out under the field; just take them there.
    const firstBad =
      !lengthOk || sameAsCurrent
        ? "new_password"
        : !matches
        ? "confirm_password"
        : null;
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return;
    }

    setLoader(true);
    setError("");

    try {
      const res = await api.changePassword(
        form.current_password,
        form.new_password
      );

      // Every token for this account is now revoked, this one included, so
      // there is nothing to go back to but the login screen. No toast
      // container is mounted here, so react-toastify holds this until the
      // login page's container mounts and shows it there.
      toast.success(res?.message || "Password changed. Please sign in again.");
      navigate("/", { replace: true });
    } catch (error) {
      setError(errorText(error, "Could not change the password."));
    } finally {
      setLoader(false);
    }
  };

  // Back to wherever they opened this from. history.state.idx is React
  // Router's position in this tab; 0 means this was the first page loaded.
  const handleBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(landingPath(sevak), { replace: true });
  };

  const handleSignOut = async () => {
    await api.logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="pw-page">
      <header className="app-bar">
        {!firstTime && (
          <button
            type="button"
            className="app-bar-back"
            onClick={handleBack}
            aria-label="Back"
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
          </button>
        )}
        <h1 className="app-bar-title">
          {firstTime ? "Set your password" : "Change password"}
        </h1>
      </header>

      <main className="pw-body">
        {firstTime && (
          <div className="notice-box">
            <i className="bi bi-shield-lock-fill" aria-hidden="true" />
            <span>
              Please choose your own password before you continue.
            </span>
          </div>
        )}

        {sevak?.sevak_id && (
          <p className="pw-meta">Signed in as {sevak.sevak_id}</p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Lets Google / iCloud Keychain update the saved login for this
              Sevak ID instead of saving a second, nameless one. */}
          {sevak?.sevak_id && (
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={sevak.sevak_id}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="visually-hidden"
            />
          )}

          <div className="auth-field">
            <label htmlFor="current_password">Current password</label>
            <PasswordInput
              id="current_password"
              name="current_password"
              onChange={handleChange}
              value={form.current_password}
              autoComplete="current-password"
              enterKeyHint="next"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="new_password">New password</label>
            <PasswordInput
              id="new_password"
              name="new_password"
              onChange={handleChange}
              value={form.new_password}
              autoComplete="new-password"
              enterKeyHint="next"
              aria-describedby="new_password_hint"
              aria-invalid={newInvalid}
              required
            />
            <FieldHint
              id="new_password_hint"
              status={newInvalid ? "error" : lengthOk ? "ok" : "info"}
            >
              {sameAsCurrent
                ? "Must be different from your current password"
                : `At least ${MIN_LENGTH} characters`}
            </FieldHint>
          </div>

          <div className="auth-field">
            <label htmlFor="confirm_password">Confirm new password</label>
            <PasswordInput
              id="confirm_password"
              name="confirm_password"
              onChange={handleChange}
              value={form.confirm_password}
              autoComplete="new-password"
              enterKeyHint="done"
              aria-describedby="confirm_password_hint"
              aria-invalid={showMatch && !matches}
              required
            />
            {showMatch && (
              <FieldHint
                id="confirm_password_hint"
                status={matches ? "ok" : "error"}
              >
                {matches ? "Passwords match" : "Passwords don't match"}
              </FieldHint>
            )}
          </div>

          <p className="pw-footnote">
            You'll be signed out and asked to log in with your new password.
          </p>

          <button type="submit" disabled={loader} className="brand-btn">
            {loader ? (
              <>
                <span
                  className="spinner-border spinner-border-sm"
                  aria-hidden="true"
                />
                <span>Saving…</span>
              </>
            ) : (
              "Change password"
            )}
          </button>

          <FormError>{error}</FormError>

          {firstTime && (
            <button type="button" className="text-btn" onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </form>
      </main>
    </div>
  );
};

export default ChangePassword;

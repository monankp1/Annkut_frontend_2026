// src/components/ResetPasswordModal.jsx
//
// Admin only. For a sevak who cannot get in at all — wrong password and a
// mobile that is wrong or is the 1234567890 placeholder, so the self-service
// reset on the login screen is no help to them.
//
// The server returns the new password exactly once and stores nothing in
// readable form, so once it is shown only Done closes this: a stray tap
// outside or the back gesture must not throw away the only copy.
import React from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import api, { errorText } from "../api/annkut";
import { FieldHint, FormError } from "./AuthFields";
import SignInCard from "./sevak-form/SignInCard";

const MIN_LENGTH = 6;
const DEFAULT_PASSWORD = "annkut@2026";

const OPTIONS = [
  {
    mode: "default",
    title: `Reset to ${DEFAULT_PASSWORD}`,
    sub: "They choose their own after signing in.",
  },
  {
    mode: "custom",
    title: "Set a specific password",
    sub: "Shown once after saving, so you can pass it on.",
  },
];

export default function ResetPasswordModal({ open, onClose, sevak }) {
  const [mode, setMode] = React.useState("default");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [tried, setTried] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMode("default");
      setPassword("");
      setResult(null);
      setSubmitting(false);
      setError("");
      setTried(false);
    }
  }, [open]);

  const custom = mode === "custom";
  const tooShort = custom && password.length < MIN_LENGTH;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (tooShort) {
      setTried(true);
      setError("");
      document.getElementById("reset_password")?.focus();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await api.resetPassword(
        sevak?.sevak_code,
        custom ? password : undefined,
      );
      setResult(res);
    } catch (e) {
      setError(errorText(e, "Could not reset the password."));
    } finally {
      setSubmitting(false);
    }
  };

  // Nothing closes it mid-request, and nothing but Done once it has a result.
  const handleDialogClose = () => {
    if (submitting || result) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      PaperProps={{ className: "app-dialog" }}
    >
      <DialogTitle>{result ? "Password reset" : "Reset password"}</DialogTitle>

      <DialogContent>
        <p className="dialog-subtitle">
          {sevak?.full_name} · {sevak?.sevak_code}
        </p>

        {result ? (
          <SignInCard
            title="New password set"
            sevakId={sevak?.sevak_code}
            password={result.password}
            note={`${
              result.must_change_password
                ? "They'll choose their own password when they sign in."
                : "They can change it themselves from the menu once signed in."
            } This password won't be shown again.`}
          />
        ) : (
          <form
            id="reset-form"
            className="auth-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="option-cards" role="radiogroup">
              {OPTIONS.map((o) => (
                <label
                  key={o.mode}
                  className={`option-card${mode === o.mode ? " is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="reset_mode"
                    value={o.mode}
                    checked={mode === o.mode}
                    onChange={() => setMode(o.mode)}
                  />
                  <span>
                    <span className="option-card-title">{o.title}</span>
                    <span className="option-card-sub">{o.sub}</span>
                  </span>
                </label>
              ))}
            </div>

            {custom && (
              <div className="auth-field mt-3 mb-0">
                <label htmlFor="reset_password">New password</label>
                {/* Plain text on purpose: it is about to be read out. */}
                <input
                  id="reset_password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  aria-describedby="reset_password_hint"
                />
                <FieldHint
                  id="reset_password_hint"
                  status={
                    password.length >= MIN_LENGTH
                      ? "ok"
                      : password.length > 0 || tried
                        ? "error"
                        : "info"
                  }
                >
                  At least {MIN_LENGTH} characters
                </FieldHint>
              </div>
            )}

            {/* Said before, not after: it is part of deciding to do this. */}
            <div className="notice-box mt-3 mb-0">
              <i
                className="bi bi-exclamation-triangle-fill"
                aria-hidden="true"
              />
              <span>They'll be signed out on every device they use.</span>
            </div>

            <FormError>{error}</FormError>
          </form>
        )}
      </DialogContent>

      <DialogActions>
        {result ? (
          <Button
            onClick={onClose}
            variant="contained"
            disableElevation
            className="dialog-btn dialog-btn-primary"
          >
            Done
          </Button>
        ) : (
          <>
            <Button
              onClick={onClose}
              disabled={submitting}
              className="dialog-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="reset-form"
              variant="contained"
              disableElevation
              disabled={submitting}
              className="dialog-btn dialog-btn-danger"
              startIcon={
                submitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : null
              }
            >
              {submitting ? "Resetting…" : "Reset password"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

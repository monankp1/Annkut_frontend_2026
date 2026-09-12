// src/components/ResetPasswordModal.jsx
//
// Admin only. For a sevak who cannot get in at all — wrong password and a
// mobile that is wrong or is the 1234567890 placeholder, so the self-service
// reset on the login screen is no help to them.
//
// The server returns the new password exactly once and stores nothing in
// readable form, so this dialog does NOT close on success: it shows the value
// and waits, because there is no way to ask for it again.
import React from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { errorText } from "../api/annkut";

const MIN_LENGTH = 6;
const DEFAULT_PASSWORD = "annkut@2026";

export default function ResetPasswordModal({ open, onClose, sevak }) {
  const [mode, setMode] = React.useState("default");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    if (open) {
      setMode("default");
      setPassword("");
      setResult(null);
      setSubmitting(false);
    }
  }, [open]);

  const custom = mode === "custom";
  const tooShort = custom && password.length > 0 && password.length < MIN_LENGTH;
  const cannotSubmit =
    submitting || (custom && password.length < MIN_LENGTH);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.resetPassword(
        sevak?.sevak_code,
        custom ? password : undefined
      );
      setResult(res);
    } catch (e) {
      toast.error(errorText(e, "Could not reset the password."));
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.password);
      toast.success("Password copied.");
    } catch {
      // Clipboard needs a secure context; the value is on screen regardless.
      toast.info("Copy it from the box above.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {result ? "Password reset" : "Reset password"}
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {sevak?.full_name} · {sevak?.sevak_code}
        </Typography>

        {result ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              {result.message ||
                "Password reset. Give this to the sevak — it will not be shown again."}
            </Alert>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              <Typography
                sx={{
                  fontFamily: "monospace",
                  fontSize: 18,
                  fontWeight: 700,
                  flex: 1,
                  wordBreak: "break-all",
                  userSelect: "all",
                }}
              >
                {result.password}
              </Typography>
              <Tooltip title="Copy">
                <IconButton onClick={copy} size="small">
                  <i className="bi bi-clipboard"></i>
                </IconButton>
              </Tooltip>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {result.must_change_password
                ? "They will be asked to choose their own password when they sign in."
                : "They can change it themselves from the menu once signed in."}{" "}
              Any device they were already signed in on has been signed out.
            </Typography>
          </>
        ) : (
          <>
            <FormControl component="fieldset">
              <FormLabel component="legend">New password</FormLabel>
              <RadioGroup
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <FormControlLabel
                  value="default"
                  control={<Radio />}
                  label={`Reset to ${DEFAULT_PASSWORD} (they must then choose their own)`}
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label="Set a specific password"
                />
              </RadioGroup>
            </FormControl>

            {custom && (
              <TextField
                fullWidth
                margin="normal"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={tooShort}
                helperText={
                  tooShort
                    ? `At least ${MIN_LENGTH} characters.`
                    : "Shown once after saving, so you can pass it on."
                }
                autoComplete="off"
              />
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {result ? (
          <Button onClick={onClose} variant="contained">
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose} color="inherit" disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              color="warning"
              disabled={cannotSubmit}
            >
              {submitting ? "Resetting..." : "Reset password"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

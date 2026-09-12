import React from "react";
import {
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  Button,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";

/**
 * Takes a book back from a family so it can go to the next one. Admin and the
 * mandal's own Sanchalak.
 *
 * `last_used_no` is how many receipts the family actually wrote, and it
 * carries over: hand a book back at 7 and the next parivar starts at 8, not 1.
 * It only ever moves forward — the server knows the highest receipt already
 * written and answers 422 for anything lower, so that is the floor here too.
 */
const DeassignBookModal = ({ open, onClose, book, onDeassigned }) => {
  const recorded = num(book?.last_used_no);
  const endNo = num(book?.end_no) || 50;
  const holder = book?.parivar_code || "this family";

  const [lastUsedNo, setLastUsedNo] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setError("");
      setLastUsedNo(String(recorded));
    }
  }, [open, recorded]);

  const validate = (val) => {
    if (val === "") return "";
    const n = Number(val);
    if (!Number.isInteger(n) || n < recorded || n > endNo) {
      return `Enter a number between ${recorded} and ${endNo}.`;
    }
    return "";
  };

  const submit = async () => {
    const vErr = validate(lastUsedNo);
    if (vErr) {
      setError(vErr);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.deassignBook(num(book?.id), lastUsedNo);
      toast.success(res?.message || "Receipt book taken back.");
      onClose?.();
      onDeassigned?.();
    } catch (e) {
      // 422 when the number is below what is already recorded — the server
      // message names the floor, so show it rather than swallowing it.
      toast.error(errorText(e, "Failed to take the book back."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Take back book {book?.book_no}?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Currently with parivar <strong>{holder}</strong>.
        </Typography>

        <TextField
          fullWidth
          label="Receipts used so far"
          inputMode="numeric"
          margin="dense"
          value={lastUsedNo}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setLastUsedNo(v);
            setError(validate(v));
          }}
          helperText={
            error ||
            `Between ${recorded} and ${endNo}. The next family continues from ${
              num(lastUsedNo) + 1
            }.`
          }
          error={Boolean(error)}
        />

        <Alert severity="warning" sx={{ mt: 2 }}>
          {holder} will not be able to add any more seva in this book.
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          color="warning"
          disabled={submitting || Boolean(error)}
        >
          {submitting ? "Taking back..." : "Take back"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeassignBookModal;

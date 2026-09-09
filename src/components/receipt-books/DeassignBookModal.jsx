import React from "react";
import {
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

// `last_used_no` only ever moves forward. The server already knows the highest
// receipt actually written in the book and answers 422 for anything lower, so
// that value is the floor here too.
const DeassignBookModal = ({ open, onClose, book, onDeassigned }) => {
  const recorded = num(book?.last_used_no);
  const endNo = num(book?.end_no) || 50;

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
      toast.success(res?.message || "Receipt book returned.");
      onClose?.();
      onDeassigned?.();
    } catch (e) {
      toast.error(errorText(e, "Failed to deassign book."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Deassign Book {book?.book_no}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Record the <strong>last used receipt number</strong>.
          {recorded > 0 ? (
            <>
              {" "}
              Receipt <strong>{recorded}</strong> is already recorded, so it
              cannot go below that.
            </>
          ) : (
            <> Leave it at 0 if none were used.</>
          )}
        </Typography>

        <TextField
          fullWidth
          label="Last Used Receipt No."
          inputMode="numeric"
          margin="dense"
          value={lastUsedNo}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setLastUsedNo(v);
            setError(validate(v));
          }}
          helperText={error || `Between ${recorded} and ${endNo}`}
          error={Boolean(error)}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          color="warning"
          disabled={submitting || Boolean(error)}
        >
          {submitting ? "Deassigning..." : "Deassign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeassignBookModal;

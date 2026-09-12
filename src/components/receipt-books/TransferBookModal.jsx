// src/components/receipt-books/TransferBookModal.jsx
//
// Sends a part-used book from the office to whichever mandal needs it. ADMIN
// only.
//
// The count travels with the book: submitted at receipt 4 of 10, it lands in
// the next mandal starting at 5. Receipts already written keep the mandal that
// collected them, so moving a book never rewrites history.
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Button,
  CircularProgress,
  Box,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";

const TransferBookModal = ({ open, onClose, book, onTransferred }) => {
  const [mandals, setMandals] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const fromMandalId = num(book?.mandal_id);

  React.useEffect(() => {
    if (!open) return undefined;

    let ignore = false;
    setTarget("");

    (async () => {
      try {
        setLoading(true);
        const res = await api.mandals({});
        const rows = Array.isArray(res?.mandal_array) ? res.mandal_array : [];
        if (!ignore) setMandals(rows);
      } catch (e) {
        if (!ignore) {
          setMandals([]);
          toast.error(errorText(e, "Could not load the mandal list."));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [open]);

  // Sending a book to the mandal it is already in is a 409, so that one is
  // simply not offered.
  const options = mandals.filter((m) => num(m?.id) !== fromMandalId);

  const submit = async () => {
    if (!target) {
      toast.error("Choose a mandal to send it to.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.transferBook(num(book?.id), Number(target));
      toast.success(res?.message || "Book moved.");
      onClose?.();
      onTransferred?.();
    } catch (e) {
      // 409 if it closed or went back out to a family since the list loaded.
      toast.error(errorText(e, "Could not move the book."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Send book {book?.book_no} to another mandal</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Currently in <strong>{book?.mandal_name || "—"}</strong> ·{" "}
          {num(book?.remaining)} receipts left · the next family starts at
          receipt <strong>{num(book?.next_receipt_no)}</strong>.
        </Typography>

        {loading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={18} /> loading mandals…
          </Box>
        ) : (
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel id="transfer-mandal-label">Send to</InputLabel>
            <Select
              labelId="transfer-mandal-label"
              label="Send to"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {options.length === 0 && (
                <MenuItem disabled>No other mandal available</MenuItem>
              )}
              {options.map((m) => (
                <MenuItem key={m.id} value={String(m.id)}>
                  {m.name}
                  {m.area_code ? ` — ${m.area_code}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Receipts already written stay with the mandal that collected them.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={submitting || !target}
        >
          {submitting ? "Sending..." : "Send book"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransferBookModal;

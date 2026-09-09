// src/components/receipt-books/AddBookModal.jsx
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
import api, { errorText } from "../../api/annkut";

// Creating a book is its own endpoint now. The 2025 API overloaded `assign`
// with a mandal name to mean "create", which is why this used to send
// to_mandal_name and a null end_no.
const AddBookModal = ({ open, onClose, mandal, onAdded }) => {
  const [form, setForm] = React.useState({ book_no: "", start_no: "", end_no: "" });
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm({ book_no: "", start_no: "", end_no: "" });
  }, [open]);

  const update = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, "") }));

  const submit = async () => {
    if (!form.book_no) {
      toast.error("Enter the book number.");
      return;
    }

    if (!mandal?.id) {
      toast.error("Select a mandal first.");
      return;
    }

    const payload = { mandal_id: mandal.id, book_no: form.book_no };

    // Left blank, the server defaults the range to 1–50.
    if (form.start_no) payload.start_no = Number(form.start_no);
    if (form.end_no) payload.end_no = Number(form.end_no);

    if (payload.start_no && payload.end_no && payload.start_no > payload.end_no) {
      toast.error("Start number cannot exceed end number.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createBook(payload);
      toast.success(res?.message || "Receipt book created.");
      onClose?.();
      onAdded?.();
    } catch (e) {
      // 409 when that number is already used in this mandal.
      toast.error(errorText(e, "Failed to add book."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Book to Mandal</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mandal: <strong>{mandal?.name || "-"}</strong>
        </Typography>

        <TextField
          fullWidth
          margin="dense"
          label="Book Number"
          inputMode="numeric"
          value={form.book_no}
          onChange={update("book_no")}
        />
        <TextField
          fullWidth
          margin="dense"
          label="Start Receipt Number"
          inputMode="numeric"
          value={form.start_no}
          onChange={update("start_no")}
          helperText="Leave blank for 1"
        />
        <TextField
          fullWidth
          margin="dense"
          label="End Receipt Number"
          inputMode="numeric"
          value={form.end_no}
          onChange={update("end_no")}
          helperText="Leave blank for 50"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="outlined">
          Cancel
        </Button>
        <Button onClick={submit} variant="contained" disabled={submitting}>
          {submitting ? "Saving..." : "Add Book"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBookModal;

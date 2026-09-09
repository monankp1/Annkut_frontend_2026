import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";

// The range is not capped at 50 here: 50 is only the default a new book gets,
// and the server is the one that refuses a range excluding a used receipt.
const EditBookModal = ({ open, onClose, book, onSaved }) => {
  const [form, setForm] = React.useState({
    book_no: "",
    start_no: "",
    end_no: "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && book) {
      setForm({
        book_no: String(book?.book_no ?? ""),
        start_no: String(num(book?.start_no)),
        end_no: String(num(book?.end_no)),
      });
    }
  }, [open, book]);

  const update = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: e.target.value.replace(/[^\d]/g, "") }));

  const handleSave = async () => {
    if (!book?.id) {
      toast.error("Book id missing.");
      return;
    }

    const start_no = form.start_no ? Number(form.start_no) : undefined;
    const end_no = form.end_no ? Number(form.end_no) : undefined;

    if (!start_no || !end_no) {
      toast.error("Start and end are required.");
      return;
    }

    if (start_no > end_no) {
      toast.error("Start number must be less than or equal to the end number.");
      return;
    }

    const lastUsed = num(book?.last_used_no);
    if (lastUsed > 0 && end_no < lastUsed) {
      toast.error(
        `Receipt ${lastUsed} has already been used, so the end number cannot be below it.`
      );
      return;
    }

    try {
      setSaving(true);
      const res = await api.updateBook(num(book.id), {
        book_no: form.book_no,
        start_no,
        end_no,
      });
      toast.success(res?.message || "Receipt book updated.");
      onClose?.();
      onSaved?.();
    } catch (e) {
      toast.error(errorText(e, "Failed to update book."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Book</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Editing book <strong>{book?.book_no}</strong> in{" "}
          {book?.mandal_name || "this mandal"}
          {num(book?.last_used_no) > 0
            ? ` · receipt ${num(book.last_used_no)} already used`
            : ""}
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
        />
        <TextField
          fullWidth
          margin="dense"
          label="End Receipt Number"
          inputMode="numeric"
          value={form.end_no}
          onChange={update("end_no")}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditBookModal;

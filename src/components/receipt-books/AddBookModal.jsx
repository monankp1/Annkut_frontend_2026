// src/components/receipt-books/AddBookModal.jsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
  TextField,
  Button,
  Box,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { errorText } from "../../api/annkut";

// Receipt books are printed in two sizes, so the size is a radio — but the
// numbers stay editable, because a book does not always arrive whole. A book
// printed 1–25 with the first three receipts already torn out is entered as
// 4–25: it still ends at 25, it just starts later.
//
// That is why `pages` is not sent. The server derives end = start + pages - 1
// from it, which would turn a start of 4 into 4–28 — receipt numbers the book
// does not have. Sending start and end outright says exactly what is printed.
const PAGE_OPTIONS = [25, 10];
const DEFAULT_PAGES = 25;

const AddBookModal = ({ open, onClose, mandal, onAdded }) => {
  const [bookNo, setBookNo] = React.useState("");
  const [pages, setPages] = React.useState(String(DEFAULT_PAGES));
  const [startNo, setStartNo] = React.useState("");
  const [endNo, setEndNo] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setBookNo("");
      setPages(String(DEFAULT_PAGES));
      setStartNo("");
      setEndNo("");
    }
  }, [open]);

  const digits = (setter) => (e) => setter(e.target.value.replace(/\D/g, ""));

  // Blank means "as printed": start at 1, end at the chosen size.
  const start = startNo === "" ? 1 : Number(startNo);
  const end = endNo === "" ? Number(pages) : Number(endNo);
  const count = end - start + 1;
  const rangeInvalid = start < 1 || end < start;

  // The radio is a preset for the last receipt number, so changing it moves
  // the end unless the admin has typed one.
  const choosePages = (e) => {
    setPages(e.target.value);
    setEndNo("");
  };

  const submit = async () => {
    if (!bookNo) {
      toast.error("Enter the book number.");
      return;
    }

    if (!mandal?.id) {
      toast.error("Select a mandal first.");
      return;
    }

    if (rangeInvalid) {
      toast.error("The start number must be 1 or more, and not past the end.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createBook({
        mandal_id: mandal.id,
        book_no: bookNo,
        start_no: start,
        end_no: end,
      });
      toast.success(res?.message || "Receipt book created.");
      onClose?.();
      onAdded?.();
    } catch (e) {
      // 409 names the mandal already holding that number — book numbers are
      // unique across the whole organisation, not per mandal.
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
          value={bookNo}
          onChange={digits(setBookNo)}
        />

        <FormControl component="fieldset" margin="normal">
          <FormLabel component="legend">Pages</FormLabel>
          <RadioGroup row name="pages" value={pages} onChange={choosePages}>
            {PAGE_OPTIONS.map((p) => (
              <FormControlLabel
                key={p}
                value={String(p)}
                control={<Radio />}
                label={`${p} pages`}
              />
            ))}
          </RadioGroup>
        </FormControl>

        <Box display="flex" gap={2}>
          <TextField
            margin="dense"
            label="Start receipt no."
            inputMode="numeric"
            value={startNo}
            onChange={digits(setStartNo)}
            placeholder="1"
            helperText="Leave blank for 1"
            error={rangeInvalid}
            fullWidth
          />
          <TextField
            margin="dense"
            label="End receipt no."
            inputMode="numeric"
            value={endNo}
            onChange={digits(setEndNo)}
            placeholder={pages}
            helperText={`Leave blank for ${pages}`}
            error={rangeInvalid}
            fullWidth
          />
        </Box>

        <Typography
          variant="body2"
          color={rangeInvalid ? "error.main" : "text.secondary"}
          sx={{ mt: 1 }}
        >
          {rangeInvalid
            ? "The start number must be 1 or more, and not past the end."
            : `Receipts will be numbered ${start}–${end} (${count} receipt${
                count === 1 ? "" : "s"
              }).`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={submitting || rangeInvalid}
        >
          {submitting ? "Saving..." : "Add Book"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBookModal;

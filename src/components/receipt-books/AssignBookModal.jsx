import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";

// A book goes to a household, not to one person: naming any member hands it to
// their whole parivar, and any of them can then write in it. The roster is the
// mandal's own sevaks, because a book cannot follow anyone into another mandal
// without its receipts being filed under a mandal that never held it.
const AssignBookModal = ({ open, onClose, mandal, book, onAssigned }) => {
  const [roster, setRoster] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [selected, setSelected] = React.useState("");

  const mandalId = mandal?.id;

  const loadRoster = React.useCallback(async () => {
    if (!open || !mandalId) return;

    setLoading(true);
    setErr("");
    setSelected("");

    try {
      const res = await api.sevaks({ mandal_id: mandalId, limit: 500 });
      const rows = Array.isArray(res?.sevak) ? res.sevak : [];
      rows.sort((a, b) => (a?.full_name || "").localeCompare(b?.full_name || ""));
      setRoster(rows);
    } catch (e) {
      setErr(errorText(e, "Failed to load the karyakar list."));
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [open, mandalId]);

  React.useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const submit = async () => {
    if (!selected) {
      toast.error("Please select a karyakar.");
      return;
    }

    try {
      setLoading(true);
      setErr("");

      // The server resolves the sevak to their parivar and issues it there.
      const res = await api.assignBook(num(book?.id), { sevakId: selected });

      toast.success(
        res?.next_receipt_no
          ? `Issued. Next receipt to use: ${res.next_receipt_no}`
          : res?.message || "Receipt book issued."
      );

      onClose?.();
      onAssigned?.();
    } catch (e) {
      // 409 when the sevak is in another mandal or the book is exhausted.
      const msg = errorText(e, "Failed to assign book.");
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign Book {book?.book_no} to Karyakar</DialogTitle>
      <DialogContent>
        <Box mt={1} mb={2}>
          <Typography variant="body2" color="text.secondary">
            Mandal: <strong>{mandal?.name || "-"}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The book goes to the selected karyakar's whole parivar — anyone in
            the family can write in it.
          </Typography>
        </Box>

        {loading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={18} /> loading karyakar…
          </Box>
        ) : err ? (
          <Box color="error.main">{err}</Box>
        ) : (
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel id="karyakar-select-label">Select Karyakar</InputLabel>
            <Select
              labelId="karyakar-select-label"
              label="Select Karyakar"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {roster.length === 0 && (
                <MenuItem disabled>No sevaks in this mandal</MenuItem>
              )}
              {roster.map((u) => (
                <MenuItem key={u?.id} value={u?.sevak_code}>
                  {u?.full_name || "(no name)"}
                  {u?.sevak_code ? ` — ${u.sevak_code}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="outlined">
          Cancel
        </Button>
        <Button onClick={submit} variant="contained" disabled={loading || !selected}>
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignBookModal;

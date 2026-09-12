import React from "react";
import {
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  createFilterOptions,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { num, errorText } from "../../api/annkut";

// A book goes to a household, not to one person: naming any member hands it to
// their whole parivar, and any of them can then write in it. The roster is the
// mandal's own sevaks, because a book cannot follow anyone into another mandal
// without its receipts being filed under a mandal that never held it.

// A mandal can run to 40-odd sevaks, so the picker is searchable. The whole
// roster is already in memory from the one request, so this filters what is
// there rather than asking the server again on every keystroke.
const filterRoster = createFilterOptions({
  trim: true,
  // Searchable by name, Sevak ID, Parivar ID or mobile — whichever the
  // karyakar happens to have to hand.
  stringify: (u) =>
    [u?.full_name, u?.sevak_code, u?.parivar_code, u?.mobile]
      .filter(Boolean)
      .join(" "),
});

const AssignBookModal = ({ open, onClose, mandal, book, onAssigned }) => {
  const [roster, setRoster] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [selected, setSelected] = React.useState(null);

  const mandalId = mandal?.id;

  const loadRoster = React.useCallback(async () => {
    if (!open || !mandalId) return;

    setLoading(true);
    setErr("");
    setSelected(null);

    try {
      const res = await api.sevaks({ mandal_id: mandalId, limit: 500 });
      const rows = Array.isArray(res?.sevak) ? res.sevak : [];
      rows.sort((a, b) =>
        (a?.full_name || "").localeCompare(b?.full_name || "")
      );
      setRoster(rows);
    } catch (e) {
      setErr(errorText(e, "Failed to load the sevak list."));
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
      toast.error("Please select a sevak.");
      return;
    }

    try {
      setLoading(true);
      setErr("");

      // The server resolves the sevak to their parivar and issues it there.
      const res = await api.assignBook(num(book?.id), {
        sevakId: selected.sevak_code,
      });

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
      <DialogTitle>Assign Book {book?.book_no} to sevak</DialogTitle>
      <DialogContent>
        <Box mt={1} mb={2}>
          <Typography variant="body2" color="text.secondary">
            Mandal: <strong>{mandal?.name || "-"}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The book goes to the selected sevak's whole parivar — anyone in the
            family can write in it.
          </Typography>
        </Box>

        {err ? (
          <Box color="error.main">{err}</Box>
        ) : (
          <Autocomplete
            fullWidth
            openOnFocus
            autoHighlight
            options={roster}
            loading={loading}
            value={selected}
            onChange={(_, value) => setSelected(value)}
            filterOptions={filterRoster}
            isOptionEqualToValue={(a, b) => a?.id === b?.id}
            getOptionLabel={(u) =>
              u?.sevak_code
                ? `${u.full_name || "(no name)"} (${u.sevak_code})`
                : u?.full_name || ""
            }
            noOptionsText={
              roster.length === 0
                ? "No sevaks in this mandal"
                : "No match — try a name, Sevak ID or Parivar ID"
            }
            renderOption={(props, u) => (
              <li {...props} key={u.id}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {u?.full_name || "(no name)"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u?.sevak_code}
                    {u?.parivar_code ? ` · Parivar ${u.parivar_code}` : ""}
                    {u?.mobile ? ` · ${u.mobile}` : ""}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search by name, Sevak ID or Parivar ID"
                margin="normal"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={loading || !selected}
        >
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignBookModal;

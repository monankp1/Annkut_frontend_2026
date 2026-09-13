// src/pages/BookLookup.jsx
//
// The office's book screen: type the number printed on a cover, get back
// everything written in that book. Book numbers are unique across the whole
// organisation, so one number is one book — no mandal to pick first.
//
// Entries are listed in page order rather than date order, because this screen
// is used with the physical book open alongside it.
import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ToastContainer } from "react-toastify";
import Header from "../components/Header";
import EditSevaModal from "../components/EditSevaModal";
import api, { num, errorText } from "../api/annkut";

const money = new Intl.NumberFormat("en-IN");

export default function BookLookup() {
  const [bookNo, setBookNo] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [searched, setSearched] = React.useState("");

  const [editModal, setEditModal] = React.useState(false);
  const [selectedSeva, setSelectedSeva] = React.useState(null);

  const search = React.useCallback(async (no) => {
    const term = String(no ?? "").trim();
    if (!term) return;

    setLoading(true);
    setError("");

    try {
      const res = await api.lookupBook(term);
      setResult(res);
      setSearched(term);
    } catch (e) {
      setResult(null);
      setSearched(term);
      // 404 "no such number" and 403 "not your mandal" carry different
      // messages on purpose — show whichever the server sent.
      setError(errorText(e, "Could not look that book up."));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    search(bookNo);
  };

  const handleEdit = (row) => {
    setSelectedSeva(row);
    setEditModal(true);
  };

  const book = result?.book;
  const receipts = result?.receipts || [];
  const summary = result?.summary;
  const canEdit = Boolean(result?.can_edit);

  return (
    <>
      <Header />

      <Box p={2}>
        <Typography variant="h5" mb={2}>
          Find a Receipt Book
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          display="flex"
          gap={1}
          mb={3}
        >
          <TextField
            size="small"
            label="Book number"
            value={bookNo}
            onChange={(e) => setBookNo(e.target.value.replace(/\D/g, ""))}
            inputProps={{ inputMode: "numeric" }}
            sx={{ width: 240 }}
            autoFocus
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !bookNo.trim()}
          >
            {loading ? "Searching..." : "Search"}
          </Button>
        </Box>

        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {book && (
          <>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                flexWrap="wrap"
                mb={1}
              >
                <Typography variant="h6">Book {book.book_no}</Typography>
                <Chip
                  size="small"
                  label={`${book.mandal_name} · ${book.area_code}`}
                />
                {book.parivar_code ? (
                  <Chip
                    size="small"
                    color="primary"
                    label={`Parivar: ${book.parivar_code}`}
                  />
                ) : (
                  <Chip size="small" variant="outlined" label="Not issued" />
                )}
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Receipts ${num(book.start_no)}–${num(book.end_no)}`}
                />
              </Box>

              <Box display="flex" gap={3} flexWrap="wrap">
                <Typography variant="body2">
                  Filled: <strong>{num(summary?.filled)}</strong> of{" "}
                  {num(summary?.pages)}
                </Typography>
                <Typography variant="body2">
                  Remaining: <strong>{num(summary?.remaining)}</strong>
                </Typography>
                <Typography variant="body2">
                  Collected:{" "}
                  <strong>
                    ₹{money.format(num(summary?.collected_amount))}
                  </strong>
                </Typography>
              </Box>

              {/* Pages below the high-water mark with nothing against them:
                  torn out, spoiled or voided. The thing you are looking for
                  when reconciling a returned book. */}
              {summary?.unused_numbers?.length > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  No entry recorded against receipt{" "}
                  {summary.unused_numbers.length === 1 ? "" : "numbers"}{" "}
                  <strong>{summary.unused_numbers.join(", ")}</strong> — torn
                  out, spoiled or voided.
                </Alert>
              )}
            </Paper>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Receipt</TableCell>
                    <TableCell>Sahyogi</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Collected by</TableCell>
                    <TableCell>Date</TableCell>
                    {canEdit && <TableCell>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receipts.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.receipt_no}</TableCell>
                      <TableCell>{row.sahyogi_name || "—"}</TableCell>
                      <TableCell>{row.sahyogi_number || "—"}</TableCell>
                      <TableCell>
                        ₹{money.format(num(row.seva_amount))}
                      </TableCell>
                      <TableCell>
                        {row.collected_by_name}
                        <Typography variant="caption" display="block">
                          {row.collected_by_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.collected_at
                          ? new Date(row.collected_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Tooltip title="Edit this entry">
                            <IconButton
                              color="warning"
                              size="small"
                              onClick={() => handleEdit(row)}
                            >
                              <i className="bi fs-6 bi-pencil"></i>
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}

                  {receipts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canEdit ? 7 : 6}
                        align="center"
                        sx={{ py: 4, color: "text.secondary" }}
                      >
                        Nothing has been written in this book yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {!book && !error && !loading && searched === "" && (
          <Typography variant="body2" color="text.secondary">
            Enter the number printed on the book's cover.
          </Typography>
        )}
      </Box>

      {editModal && (
        <EditSevaModal
          modal={editModal}
          setModal={setEditModal}
          sevakData={selectedSeva}
          refreshData={() => search(searched)}
        />
      )}

      <ToastContainer
        position="top-center"
        autoClose={5000}
        closeOnClick
        pauseOnHover
        theme="colored"
      />
    </>
  );
}

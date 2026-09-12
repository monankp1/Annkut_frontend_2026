// src/pages/ReceiptBooks.jsx
import React from "react";
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import Header from "../components/Header";
import api, { num, errorText } from "../api/annkut";
import {
  getSevak,
  hasMandalScope,
  canAssignBook,
  canManageBooks,
} from "../api/session";

import MandalGrid from "../components/receipt-books/MandalGrid";
import BookTable from "../components/receipt-books/BookTable";

import AssignBookModal from "../components/receipt-books/AssignBookModal";
import DeassignBookModal from "../components/receipt-books/DeassignBookModal";
import AddBookModal from "../components/receipt-books/AddBookModal";
import EditBookModal from "../components/receipt-books/EditBookModal";
import TransferBookModal from "../components/receipt-books/TransferBookModal";

export default function ReceiptBooks() {
  const me = getSevak();
  const scoped = hasMandalScope(me);
  const ownMandal = me?.mandal || null;

  // Stock control is the admin's: books enter a mandal and come back from a
  // parivar only on his say-so. A sanchalak does one thing — hand a book his
  // mandal already holds to one of its families.
  const mayAssign = canAssignBook(me);
  const mayManage = canManageBooks(me);

  // Everything is addressed by mandal_id: a mandal code like "NK" is unique
  // only inside its xetra, so the name alone is never enough.
  const [mandals, setMandals] = React.useState([]);
  const [books, setBooks] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Someone holding several mandals picks one first; everyone else goes
  // straight to their own.
  const multiMandal = scoped;
  const [mode, setMode] = React.useState(multiMandal ? "mandals" : "books");
  const [selectedMandal, setSelectedMandal] = React.useState(
    multiMandal ? null : ownMandal
  );

  const [qBooks, setQBooks] = React.useState("");
  const [qMandal, setQMandal] = React.useState("");

  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignBook, setAssignBook] = React.useState(null);

  const [deassignOpen, setDeassignOpen] = React.useState(false);
  const [deassignBook, setDeassignBook] = React.useState(null);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingBook, setEditingBook] = React.useState(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingBook, setDeletingBook] = React.useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submittingBook, setSubmittingBook] = React.useState(null);
  const [submitBusy, setSubmitBusy] = React.useState(false);

  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferBook, setTransferBook] = React.useState(null);

  // The office pool: stock with no family holding it and pages still left,
  // across every mandal in scope.
  const [pool, setPool] = React.useState([]);

  const [addOpen, setAddOpen] = React.useState(false);

  const activeMandal = selectedMandal;

  // ---------- fetchers ----------

  const fetchMandals = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.mandals({});
      const arr = res?.mandal_array;
      setMandals(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error("Fetch mandals error:", e);
      setMandals([]);
      setError(errorText(e, "Failed to load mandals."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBooks = React.useCallback(async (mandalId) => {
    setError("");
    setLoading(true);
    try {
      // With no mandal_id the server falls back to the caller's own mandal,
      // and answers 400 for someone attached to none.
      const rows = await api.books(mandalId || undefined);
      setBooks(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("Fetch books error:", e);
      setError(errorText(e, "Failed to load books."));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (multiMandal) fetchMandals();
    else fetchBooks(ownMandal?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- derived ----------

  const filteredMandals = React.useMemo(() => {
    const needle = qMandal.trim().toLowerCase();
    if (!needle) return mandals;
    return (mandals || []).filter((m) =>
      JSON.stringify(m || {})
        .toLowerCase()
        .includes(needle)
    );
  }, [mandals, qMandal]);

  const filteredBooks = React.useMemo(() => {
    const needle = qBooks.trim().toLowerCase();
    if (!needle) return books;
    return (books || []).filter((b) =>
      JSON.stringify(b || {})
        .toLowerCase()
        .includes(needle)
    );
  }, [books, qBooks]);

  // ---------- handlers ----------

  const handleCardClick = async (m) => {
    const picked = { id: num(m?.id), name: m?.name || "" };
    setSelectedMandal(picked);
    setQBooks("");
    setMode("books");
    await fetchBooks(picked.id);
  };

  const handleBackToMandals = () => {
    setSelectedMandal(null);
    setQBooks("");
    setBooks([]);
    setMode("mandals");
  };

  const refresh = () => {
    if (mode === "pool") fetchPool();
    else if (mode === "mandals" && multiMandal) fetchMandals();
    else fetchBooks(activeMandal?.id);
  };

  const openEditModal = (row) => {
    setEditingBook(row);
    setEditOpen(true);
  };
  const closeEditModal = () => {
    setEditOpen(false);
    setEditingBook(null);
  };

  const openDeleteConfirm = (row) => {
    setDeletingBook(row);
    setDeleteOpen(true);
  };
  const closeDeleteConfirm = () => {
    setDeleteOpen(false);
    setDeletingBook(null);
  };

  const doDeleteBook = async () => {
    if (!deletingBook?.id) return;
    try {
      setDeleteSubmitting(true);
      const res = await api.deleteBook(num(deletingBook.id));
      toast.success(res?.message || "Receipt book deleted.");
      closeDeleteConfirm();
      await fetchBooks(activeMandal?.id);
    } catch (e) {
      // 409 when the book is issued or already holds receipts.
      toast.error(errorText(e, "Failed to delete book."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openAssignModal = (row) => {
    if (!activeMandal?.id) {
      toast.error("No mandal selected.");
      return;
    }
    setAssignBook(row);
    setAssignOpen(true);
  };
  const closeAssignModal = () => {
    setAssignOpen(false);
    setAssignBook(null);
  };

  const openDeassignModal = (row) => {
    setDeassignBook(row);
    setDeassignOpen(true);
  };
  const closeDeassignModal = () => {
    setDeassignOpen(false);
    setDeassignBook(null);
  };

  const openTransferModal = (row) => {
    setTransferBook(row);
    setTransferOpen(true);
  };
  const closeTransferModal = () => {
    setTransferOpen(false);
    setTransferBook(null);
  };

  const fetchPool = React.useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const rows = await api.bookPool();
      setPool(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("Pool error:", e);
      setError(errorText(e, "Failed to load the office pool."));
      setPool([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const openPool = async () => {
    setMode("pool");
    await fetchPool();
  };

  const openAddModal = () => {
    if (!activeMandal?.id) {
      toast.error("Select a mandal first.");
      return;
    }
    setAddOpen(true);
  };

  // Submitting is one-way: there is no endpoint that un-submits a book, so it
  // is confirmed as plainly as the delete.
  const openSubmitConfirm = (row) => {
    setSubmittingBook(row);
    setSubmitOpen(true);
  };
  const closeSubmitConfirm = () => {
    setSubmitOpen(false);
    setSubmittingBook(null);
  };

  const doSubmitBook = async () => {
    if (!submittingBook?.id) return;

    try {
      setSubmitBusy(true);
      setError("");
      const res = await api.submitBook(num(submittingBook.id));
      // SUBMITTED and CLOSED end very differently for the book, so the
      // server's own wording is what the user sees.
      const closed = String(res?.status || "").toUpperCase() === "CLOSED";
      const msg = res?.message || "Receipt book handed in.";
      if (closed) toast.warning(msg);
      else toast.success(msg);
      closeSubmitConfirm();
      await fetchBooks(activeMandal?.id);
    } catch (e) {
      console.error("Submit error:", e);
      toast.error(errorText(e, "Failed to submit book."));
    } finally {
      setSubmitBusy(false);
    }
  };

  // A book is held by a parivar, not by one person: it stays in the house and
  // whoever is around writes in it.
  const ownerChip = (row) => {
    const status = String(row?.status || "").toUpperCase();

    if (status === "CLOSED") {
      return <Chip size="small" label="Closed" variant="outlined" />;
    }

    if (status === "SUBMITTED") {
      return (
        <Chip
          size="small"
          color="info"
          variant="outlined"
          label={`With office · ${num(row?.remaining)} left`}
        />
      );
    }

    if (row?.parivar_id) {
      return (
        <Chip
          size="small"
          color="primary"
          label={`Parivar: ${row.parivar_code || row.parivar_id}`}
        />
      );
    }

    return <Chip size="small" label="Available" variant="outlined" />;
  };

  // ---------- render ----------

  return (
    <>
      <Header />

      <Box p={2}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
        >
          <Typography variant="h5">Receipt Books</Typography>

          <Box display="flex" alignItems="center" gap={1}>
            {mode === "books" && activeMandal?.id && mayManage && (
              <Button variant="contained" onClick={openAddModal}>
                Add Book
              </Button>
            )}

            {/* Stock that came back part-used is worth redistributing, and
                only the office can move it. */}
            {mayManage && mode !== "pool" && (
              <Button variant="outlined" onClick={openPool}>
                Office pool
              </Button>
            )}

            <Tooltip title="Refresh">
              <IconButton onClick={refresh} disabled={loading}>
                <i className="bi bi-arrow-clockwise"></i>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {!scoped && !ownMandal && (
          <Box mb={2} color="text.secondary">
            Your account is not attached to a mandal, so there are no books to
            manage here.
          </Box>
        )}

        {mode === "pool" && (
          <>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  setMode(multiMandal ? "mandals" : "books");
                  setPool([]);
                }}
                startIcon={<i className="bi bi-arrow-left"></i>}
              >
                Back
              </Button>
              <Typography variant="body2" color="text.secondary">
                Books no family is holding, with receipts still left. Closed
                books never appear here.
              </Typography>
            </Box>

            {error && (
              <Box mb={1} color="error.main">
                {error}
              </Box>
            )}

            <TableContainer component={Paper} sx={{ maxHeight: 650 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Book</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>Left</TableCell>
                    <TableCell>Next</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pool.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.book_no}</TableCell>
                      <TableCell>{row.mandal_name}</TableCell>
                      <TableCell>{num(row.remaining)}</TableCell>
                      <TableCell>{num(row.next_receipt_no)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            String(row.status).toUpperCase() === "SUBMITTED"
                              ? "Came back part-used"
                              : "Never issued"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => openTransferModal(row)}
                        >
                          Send to…
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {pool.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        align="center"
                        sx={{ py: 4, color: "text.secondary" }}
                      >
                        {loading
                          ? "Loading the pool…"
                          : "Nothing waiting to be redistributed"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {multiMandal && mode === "mandals" && (
          <>
            <Box display="flex" gap={1} mb={2}>
              <TextField
                size="small"
                placeholder="Search mandals…"
                value={qMandal}
                onChange={(e) => setQMandal(e.target.value)}
                sx={{ width: 360 }}
              />
            </Box>

            <MandalGrid
              mandals={filteredMandals}
              loading={loading}
              onClickMandal={handleCardClick}
            />
          </>
        )}

        {mode === "books" && (
          <>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Box display="flex" alignItems="center" gap={1}>
                {multiMandal && (
                  <Button
                    variant="outlined"
                    onClick={handleBackToMandals}
                    startIcon={<i className="bi bi-arrow-left"></i>}
                  >
                    Back to mandals
                  </Button>
                )}
                {activeMandal?.name && (
                  <Chip
                    variant="outlined"
                    label={`Mandal: ${activeMandal.name}`}
                  />
                )}
              </Box>

              <TextField
                size="small"
                placeholder="Search books by number, sevak…"
                value={qBooks}
                onChange={(e) => setQBooks(e.target.value)}
                sx={{ width: 360 }}
              />
            </Box>

            {error && (
              <Box mb={1} color="error.main">
                {error}
              </Box>
            )}

            <BookTable
              rows={filteredBooks}
              loading={loading}
              mayAssign={mayAssign}
              mayManage={mayManage}
              ownerChip={ownerChip}
              onAssign={openAssignModal}
              onDeassign={openDeassignModal}
              onSubmitBook={openSubmitConfirm}
              onTransfer={openTransferModal}
              onEdit={openEditModal}
              onDelete={openDeleteConfirm}
            />
          </>
        )}
      </Box>

      <AssignBookModal
        open={assignOpen}
        onClose={closeAssignModal}
        mandal={activeMandal}
        book={assignBook}
        onAssigned={() => fetchBooks(activeMandal?.id)}
      />

      <DeassignBookModal
        open={deassignOpen}
        onClose={closeDeassignModal}
        book={deassignBook}
        onDeassigned={() => fetchBooks(activeMandal?.id)}
      />

      <AddBookModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mandal={activeMandal}
        onAdded={() => fetchBooks(activeMandal?.id)}
      />

      <TransferBookModal
        open={transferOpen}
        onClose={closeTransferModal}
        book={transferBook}
        onTransferred={() =>
          mode === "pool" ? fetchPool() : fetchBooks(activeMandal?.id)
        }
      />

      <EditBookModal
        open={editOpen}
        onClose={closeEditModal}
        book={editingBook}
        onSaved={() => fetchBooks(activeMandal?.id)}
      />

      <Dialog
        open={submitOpen}
        onClose={closeSubmitConfirm}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Submit book {submittingBook?.book_no}?</DialogTitle>
        <DialogContent>
          {/* Where the book ends up depends entirely on whether any page is
              left, so say which of the two will happen before they commit. */}
          {num(submittingBook?.remaining) > 0 ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                {num(submittingBook?.remaining)} receipts still left, so the
                book goes back to the office and can be sent to any mandal.
              </Alert>
              <Typography variant="body2">
                It leaves
                {submittingBook?.parivar_code
                  ? ` parivar ${submittingBook.parivar_code}`
                  : " this mandal"}{" "}
                and stops accepting seva here. The next mandal picks it up at
                receipt <strong>{num(submittingBook?.next_receipt_no)}</strong>.
              </Typography>
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This cannot be undone.
              </Alert>
              <Typography variant="body2">
                Every receipt has been used, so book{" "}
                <strong>{submittingBook?.book_no}</strong> will be closed
                permanently. It can never be issued again, to this mandal or
                any other.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={closeSubmitConfirm}
            color="inherit"
            disabled={submitBusy}
          >
            Cancel
          </Button>
          <Button
            onClick={doSubmitBook}
            color="success"
            variant="contained"
            disabled={submitBusy}
          >
            {submitBusy ? "Submitting..." : "Submit book"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={closeDeleteConfirm} fullWidth maxWidth="xs">
        <DialogTitle>Delete Book {deletingBook?.book_no}</DialogTitle>
        <DialogContent>
          This removes the receipt book record. A book that is issued, or that
          already holds receipts, cannot be deleted.
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteConfirm} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={doDeleteBook}
            color="error"
            variant="contained"
            disabled={deleteSubmitting}
          >
            {deleteSubmitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

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

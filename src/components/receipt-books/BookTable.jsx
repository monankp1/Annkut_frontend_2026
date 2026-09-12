// src/components/receipt-books/BookTable.jsx
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tooltip,
  Typography,
} from "@mui/material";
import { num } from "../../api/annkut";

// Every row arrives with start_no/end_no from the record and last_used_no,
// next_receipt_no and remaining computed by the server, so nothing here has to
// guess a range or a capacity.
const BookTable = ({
  rows = [],
  loading = false,
  // A sanchalak runs the whole circulation cycle inside his mandal — give a
  // book out, take it back, give it to the next family. Only the admin
  // changes what stock the mandal holds.
  mayAssign = false,
  mayManage = false,
  ownerChip,
  onAssign,
  onDeassign,
  onSubmitBook,
  onTransfer,
  onEdit,
  onDelete,
}) => {
  const showActions = mayAssign || mayManage;

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 650 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Book No</TableCell>
            <TableCell>Range</TableCell>
            <TableCell>Used</TableCell>
            <TableCell>Left</TableCell>
            <TableCell>Issued On</TableCell>
            <TableCell>Held By</TableCell>
            {showActions && <TableCell>Actions</TableCell>}
          </TableRow>
        </TableHead>

        <TableBody>
          {(rows || []).map((row) => {
            const start = num(row?.start_no);
            const end = num(row?.end_no);
            const lastUsed = num(row?.last_used_no);
            const remaining = num(row?.remaining);

            const status = String(row?.status || "").toUpperCase();

            // CLOSED is a hard lock: the book is full, so assign, transfer and
            // submit all 409 for everyone, administrators included.
            const isClosed = status === "CLOSED";
            // SUBMITTED only means it went back to the office. With pages left
            // it is still perfectly usable — by this mandal or another.
            const isSubmitted = status === "SUBMITTED";
            // Held by a family, not a person.
            const assigned = Boolean(row?.parivar_id);
            const exhausted = remaining <= 0;

            const canAssign = !assigned && !isClosed && !exhausted;

            const assignBlockedReason = isClosed
              ? "Fully used and closed"
              : assigned
              ? "Already issued — take it back first"
              : exhausted
              ? "No receipts left — submit instead"
              : "";

            // Moving a book needs it free of a family and still writable.
            const canTransfer = !assigned && !isClosed && !exhausted;

            // Once a book has gone back to the office it leaves the mandal's
            // hands: only the administrator places it again, anywhere in the
            // organisation. A sanchalak can still see it, but does nothing
            // with it.
            const mayPlace = isSubmitted ? mayManage : mayAssign;

            // Nothing on offer, but for a reason worth naming.
            const readOnlyNote = isClosed
              ? "Closed"
              : isSubmitted && !mayManage
              ? "With office"
              : null;

            return (
              <TableRow
                key={row?.id}
                hover
                sx={isClosed ? { opacity: 0.55 } : undefined}
              >
                <TableCell>{row?.book_no ?? "-"}</TableCell>
                <TableCell>{`${start} - ${end}`}</TableCell>
                <TableCell>{lastUsed || "—"}</TableCell>
                <TableCell>{remaining}</TableCell>
                <TableCell>
                  {row?.issued_on
                    ? new Date(row.issued_on).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>{ownerChip(row)}</TableCell>

                {showActions && (
                  <TableCell>
                    {/* A closed book has no blank page left, and one with the
                        office is out of the mandal's hands — either way the
                        row says why rather than sitting empty. */}
                    {readOnlyNote && (
                      <Typography variant="body2" color="text.secondary">
                        {readOnlyNote}
                      </Typography>
                    )}

                    {/* Taking a book back from a family stays with the
                        sanchalak; placing one that is with the office does
                        not. */}
                    {!isClosed &&
                      assigned &&
                      mayAssign && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => onDeassign?.(row)}
                          disabled={loading}
                          sx={{ mr: 1 }}
                        >
                          Take back
                        </Button>
                      )}

                    {!isClosed &&
                      !assigned &&
                      mayPlace &&
                      (canAssign ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => onAssign?.(row)}
                          disabled={loading}
                          sx={{ mr: 1 }}
                        >
                          Assign
                        </Button>
                      ) : (
                        <Tooltip title={assignBlockedReason}>
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              disabled
                              sx={{ mr: 1 }}
                            >
                              Assign
                            </Button>
                          </span>
                        </Tooltip>
                      ))}

                    {/* Handing the book back to the office is the admin's
                        call. Submitting one already there would be a no-op. */}
                    {!isClosed && mayManage && !isSubmitted && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => onSubmitBook?.(row)}
                        disabled={loading}
                        sx={{ mr: 1 }}
                      >
                        Submit
                      </Button>
                    )}

                    {/* Part-used stock can go to whichever mandal needs it. */}
                    {!isClosed && mayManage && canTransfer && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="info"
                        onClick={() => onTransfer?.(row)}
                        disabled={loading}
                        sx={{ mr: 1 }}
                      >
                        Send to…
                      </Button>
                    )}

                    {!isClosed && mayManage && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onEdit?.(row)}
                          sx={{ mr: 1 }}
                        >
                          Edit
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => onDelete?.(row)}
                          disabled={loading}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}

          {(rows?.length ?? 0) === 0 && (
            <TableRow>
              <TableCell
                colSpan={showActions ? 7 : 6}
                align="center"
                sx={{ py: 4, color: "text.secondary" }}
              >
                {loading ? "Loading books…" : "No books found"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default BookTable;

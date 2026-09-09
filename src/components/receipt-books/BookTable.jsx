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
} from "@mui/material";
import { num } from "../../api/annkut";

// Every row arrives with start_no/end_no from the record and last_used_no,
// next_receipt_no and remaining computed by the server, so nothing here has to
// guess a range or a capacity.
const BookTable = ({
  rows = [],
  loading = false,
  ownerChip,
  onAssign,
  onDeassign,
  onSubmitBook,
  onEdit,
  onDelete,
}) => {
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
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {(rows || []).map((row) => {
            const start = num(row?.start_no);
            const end = num(row?.end_no);
            const lastUsed = num(row?.last_used_no);
            const remaining = num(row?.remaining);

            const isSubmitted =
              String(row?.status || "").toUpperCase() === "SUBMITTED" ||
              Boolean(row?.submitted_at);
            // Held by a family, not a person.
            const assigned = Boolean(row?.parivar_id);
            const exhausted = remaining <= 0;

            const canAssign = !assigned && !isSubmitted && !exhausted;

            const assignBlockedReason = isSubmitted
              ? "Book already submitted"
              : assigned
              ? "Already issued — take it back first"
              : exhausted
              ? "No receipts left — submit instead"
              : "";

            return (
              <TableRow key={row?.id} hover>
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

                <TableCell>
                  {canAssign ? (
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
                  )}

                  {assigned && !isSubmitted && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => onDeassign?.(row)}
                      disabled={loading}
                      sx={{ mr: 1 }}
                    >
                      Deassign
                    </Button>
                  )}

                  {!isSubmitted && (
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
                </TableCell>
              </TableRow>
            );
          })}

          {(rows?.length ?? 0) === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
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

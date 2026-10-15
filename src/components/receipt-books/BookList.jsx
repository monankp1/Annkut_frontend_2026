// src/components/receipt-books/BookList.jsx
//
// A mandal's receipt books as cards — a seven-column table with up to six
// buttons a row does not fit a phone. Each card offers the one action that
// fits the book's state; the rest live in the ⋮ menu.
//
// Every row arrives with start_no/end_no from the record and last_used_no,
// next_receipt_no and remaining computed by the server, so nothing here has to
// guess a range or a capacity.
import React from "react";
import { IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { num } from "../../api/annkut";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "11 Oct 2026" — never 10/11/2026, which reads two ways. */
export const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d);
};

/**
 * Where a book is, in the four words the screen uses. A book is held by a
 * parivar, not a person: it stays in the house and whoever is around writes
 * in it.
 */
export function bookState(row) {
  const status = String(row?.status || "").toUpperCase();
  if (status === "CLOSED") return "closed";
  if (status === "SUBMITTED") return "office";
  if (row?.parivar_id) return "family";
  return "available";
}

export const STATE_LABELS = {
  available: "Available",
  family: "With family",
  office: "With office",
  closed: "Closed",
};

export const StatusPill = ({ row }) => {
  const state = bookState(row);
  const label =
    state === "family"
      ? `With ${row.parivar_code || "family"}`
      : STATE_LABELS[state];
  return <span className={`status-pill is-${state}`}>{label}</span>;
};

/** How much of the book has been written, as a thin bar. */
export const UsageBar = ({ row }) => {
  const total = num(row?.end_no) - num(row?.start_no) + 1;
  const used = Math.max(0, total - num(row?.remaining));
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <span className="usage-track" aria-hidden="true">
      <span className="usage-fill" style={{ width: `${pct}%` }} />
    </span>
  );
};

const BookCard = ({
  row,
  mayAssign,
  mayManage,
  onAssign,
  onDeassign,
  onSubmitBook,
  onTransfer,
  onEdit,
  onDelete,
}) => {
  const [anchor, setAnchor] = React.useState(null);

  const state = bookState(row);
  const remaining = num(row?.remaining);

  // CLOSED is a hard lock: the book is full, so assign, transfer and submit
  // all 409 for everyone, administrators included.
  const isClosed = state === "closed";
  // SUBMITTED only means it went back to the office. With pages left it is
  // still perfectly usable — by this mandal or another.
  const isSubmitted = state === "office";
  const assigned = state === "family";
  const exhausted = remaining <= 0;

  const canAssign = !assigned && !isClosed && !exhausted;
  // Moving a book needs it free of a family and still writable.
  const canTransfer = !assigned && !isClosed && !exhausted;

  // Once a book has gone back to the office it leaves the mandal's hands:
  // only the administrator places it again, anywhere in the organisation.
  const mayPlace = isSubmitted ? mayManage : mayAssign;

  // The one action that fits this book's state, or why there is none —
  // said in words, because a tooltip never shows on a phone.
  let primary = null;
  let note = null;

  if (isClosed) {
    note = "Closed · all receipts used";
  } else if (assigned) {
    // Taking a book back from a family stays with the sanchalak.
    if (mayAssign) primary = { label: "Take back", onClick: onDeassign };
  } else if (mayPlace) {
    if (canAssign) primary = { label: "Assign", onClick: onAssign };
    else if (exhausted) note = "No receipts left — submit it instead";
  } else if (isSubmitted) {
    note = "With the office";
  }

  const menuItems = [];
  if (mayManage && !isClosed) {
    // Submitting one already with the office would be a no-op.
    if (!isSubmitted) {
      menuItems.push({
        key: "submit",
        icon: "bi-box-arrow-in-down",
        label: "Submit to office",
        onClick: onSubmitBook,
      });
    }
    if (canTransfer) {
      menuItems.push({
        key: "transfer",
        icon: "bi-send-fill",
        label: "Send to another mandal",
        onClick: onTransfer,
      });
    }
    menuItems.push(
      { key: "edit", icon: "bi-pencil-fill", label: "Edit", onClick: onEdit },
      {
        key: "delete",
        icon: "bi-trash-fill",
        label: "Delete",
        danger: true,
        onClick: onDelete,
      },
    );
  }

  const start = num(row?.start_no);
  const end = num(row?.end_no);
  const issued = formatDate(row?.issued_on);

  return (
    <li className={`seva-card book-card${isClosed ? " is-closed" : ""}`}>
      <div className="seva-card-top">
        <span className="seva-card-name">Book {row?.book_no ?? "—"}</span>
        <StatusPill row={row} />
      </div>
      <div className="seva-card-meta">
        Receipts {start}–{end}
        {!isClosed && ` · next ${num(row?.next_receipt_no)}`} · {remaining} left
      </div>
      <UsageBar row={row} />
      {issued && <div className="seva-card-meta">Issued {issued}</div>}

      {(primary || note || menuItems.length > 0) && (
        <div className="book-card-bottom">
          {primary ? (
            <button
              type="button"
              className="outline-btn"
              onClick={() => primary.onClick?.(row)}
            >
              {primary.label}
            </button>
          ) : (
            <span className="card-note">{note}</span>
          )}

          {menuItems.length > 0 && (
            <>
              <IconButton
                className="seva-card-more"
                onClick={(e) => setAnchor(e.currentTarget)}
                aria-label={`More actions for book ${row?.book_no ?? ""}`}
                aria-haspopup="true"
              >
                <i className="bi bi-three-dots-vertical" aria-hidden="true" />
              </IconButton>
              <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ className: "app-menu" }}
              >
                {menuItems.map((item) => (
                  <MenuItem
                    key={item.key}
                    className={`menu-item${item.danger ? " is-danger" : ""}`}
                    onClick={() => {
                      setAnchor(null);
                      item.onClick?.(row);
                    }}
                  >
                    <ListItemIcon>
                      <i className={`bi ${item.icon}`} aria-hidden="true" />
                    </ListItemIcon>
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * A sanchalak runs the whole circulation cycle inside his mandal — give a
 * book out, take it back, give it to the next family. Only the admin changes
 * what stock the mandal holds.
 */
const BookList = ({ rows = [], ...handlers }) => (
  <ul className="seva-list">
    {rows.map((row) => (
      <BookCard key={row?.id} row={row} {...handlers} />
    ))}
  </ul>
);

export default BookList;

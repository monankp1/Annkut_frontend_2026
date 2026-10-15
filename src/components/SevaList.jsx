import React, { useState, useMemo } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from "@mui/material";
import EditSevaModal from "./EditSevaModal";

const sevaId = (item) => item?.id ?? item?.seva_id ?? null;

/**
 * The selected member's seva entries as cards — a seven-column table does not
 * fit a phone.
 *
 * `canManage` draws the ⋮ menu with Edit and Void. Only a karyakar may change
 * a recorded receipt — the server answers 403 for everyone else, family
 * included, so an ordinary sevak sees a read-only list of their own entries.
 */
const SevaList = ({
  data = [],
  loading = false,
  error = "",
  onRetry,
  emptyText = "No seva entries yet",
  canManage = false,
  handleDelete,
  refreshData,
}) => {
  const [menu, setMenu] = useState({ anchor: null, item: null });
  const [editItem, setEditItem] = useState(null);
  const [voidItem, setVoidItem] = useState(null);
  const [voiding, setVoiding] = useState(false);

  const list = Array.isArray(data) ? data : [];
  const currency = useMemo(() => new Intl.NumberFormat("en-IN"), []);
  const amountText = (item) =>
    item?.seva_amount != null
      ? `₹${currency.format(Number(item.seva_amount))}`
      : "—";

  const closeMenu = () => setMenu({ anchor: null, item: null });

  const confirmVoid = async () => {
    const id = sevaId(voidItem);
    if (!id || !handleDelete) return;
    setVoiding(true);
    try {
      await handleDelete(id);
    } finally {
      setVoiding(false);
      setVoidItem(null);
    }
  };

  if (error && list.length === 0) {
    return (
      <div className="list-state" role="alert">
        <i className="bi bi-wifi-off list-state-icon" aria-hidden="true" />
        <p className="list-state-title">Couldn't load seva entries</p>
        <p className="list-state-text">{error}</p>
        {onRetry && (
          <button type="button" className="outline-btn" onClick={onRetry}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
          </button>
        )}
      </div>
    );
  }

  if (loading && list.length === 0) {
    return (
      <div aria-busy="true" aria-label="Loading seva entries">
        {[0, 1, 2].map((i) => (
          <div key={i} className="seva-card is-skeleton" aria-hidden="true">
            <span className="skeleton-line sk-60" />
            <span className="skeleton-line sk-40" />
            <span className="skeleton-line sk-50" />
          </div>
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="list-state">
        <i className="bi bi-journal-plus list-state-icon" aria-hidden="true" />
        <p className="list-state-title">{emptyText}</p>
        <p className="list-state-text">
          Tap <strong>Add seva</strong> below to record a form.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="seva-list">
        {list.map((item, index) => (
          <li key={sevaId(item) ?? index} className="seva-card">
            <div className="seva-card-top">
              <span className="seva-card-name">
                {item?.sahyogi_name || "—"}
              </span>
              <span className="seva-card-amount">{amountText(item)}</span>
            </div>
            <div className="seva-card-meta">
              Book {item?.book_no || "—"} · Receipt {item?.receipt_no || "—"}
            </div>
            {(item?.sahyogi_number || canManage) && (
              <div className="seva-card-bottom">
                {item?.sahyogi_number ? (
                  <a
                    className="seva-card-phone"
                    href={`tel:${item.sahyogi_number}`}
                  >
                    <i className="bi bi-telephone" aria-hidden="true" />
                    {item.sahyogi_number}
                  </a>
                ) : (
                  <span />
                )}
                {canManage && (
                  <IconButton
                    className="seva-card-more"
                    aria-label={`Actions for receipt ${item?.receipt_no || ""}`}
                    onClick={(e) => setMenu({ anchor: e.currentTarget, item })}
                  >
                    <i
                      className="bi bi-three-dots-vertical"
                      aria-hidden="true"
                    />
                  </IconButton>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ className: "app-menu" }}
      >
        <MenuItem
          className="menu-item"
          onClick={() => {
            setEditItem(menu.item);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <i className="bi bi-pencil-fill" aria-hidden="true" />
          </ListItemIcon>
          Edit
        </MenuItem>
        {typeof handleDelete === "function" && (
          <MenuItem
            className="menu-item is-danger"
            onClick={() => {
              setVoidItem(menu.item);
              closeMenu();
            }}
          >
            <ListItemIcon>
              <i className="bi bi-x-circle-fill" aria-hidden="true" />
            </ListItemIcon>
            Void entry
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={Boolean(voidItem)}
        onClose={() => !voiding && setVoidItem(null)}
        PaperProps={{ className: "app-dialog" }}
      >
        <DialogTitle>Void this entry?</DialogTitle>
        <DialogContent>
          {voidItem && (
            <div className="void-summary">
              <div className="seva-card-top">
                <span className="seva-card-name">
                  {voidItem.sahyogi_name || "—"}
                </span>
                <span className="seva-card-amount">{amountText(voidItem)}</span>
              </div>
              <div className="seva-card-meta">
                Book {voidItem.book_no || "—"} · Receipt{" "}
                {voidItem.receipt_no || "—"}
              </div>
            </div>
          )}
          <p className="void-note">
            The receipt number stays used and cannot be issued again.
          </p>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setVoidItem(null)}
            disabled={voiding}
            className="dialog-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmVoid}
            disabled={voiding}
            variant="contained"
            disableElevation
            className="dialog-btn dialog-btn-danger"
            startIcon={
              voiding ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {voiding ? "Voiding…" : "Void entry"}
          </Button>
        </DialogActions>
      </Dialog>

      {editItem && (
        <EditSevaModal
          modal={Boolean(editItem)}
          setModal={(open) => !open && setEditItem(null)}
          sevakData={editItem}
          refreshData={refreshData}
        />
      )}
    </>
  );
};

export default SevaList;

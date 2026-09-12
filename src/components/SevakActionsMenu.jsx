// src/components/SevakActionsMenu.jsx
//
// The Actions cell on a sevak row: one set of three dots that opens the
// options this caller actually holds — Edit, Reset password, Deactivate, in
// that order. A Sanchalak sees only Edit, an admin sees all three, and the
// dots do not appear at all when nothing is available.
import React from "react";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { num } from "../api/annkut";

export default function SevakActionsMenu({
  sevak,
  isSelf = false,
  mayEdit = false,
  mayResetPassword = false,
  mayDeactivate = false,
  onEdit,
  onResetPassword,
  onDeactivate,
}) {
  const [anchor, setAnchor] = React.useState(null);

  const close = () => setAnchor(null);

  const choose = (handler) => () => {
    close();
    handler?.(sevak);
  };

  const items = [];

  if (mayEdit) {
    items.push({
      key: "edit",
      icon: "bi-pencil",
      label: "Edit",
      onClick: choose(onEdit),
    });
  }

  if (mayResetPassword) {
    // A sevak with no login account has no password to reset — the server
    // answers 404, so the row says why instead of letting the click fail.
    const hasLogin = Boolean(num(sevak?.has_login));
    items.push({
      key: "reset",
      icon: "bi-key",
      label: "Reset password",
      note: hasLogin ? null : "No login account",
      disabled: !hasLogin,
      onClick: choose(onResetPassword),
    });
  }

  // Nobody deactivates themselves — the server answers 422.
  if (mayDeactivate && !isSelf) {
    items.push({
      key: "deactivate",
      icon: "bi-person-x",
      label: "Deactivate",
      danger: true,
      onClick: choose(onDeactivate),
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`Actions for ${sevak?.full_name || "this sevak"}`}
        aria-haspopup="true"
      >
        <i className="bi bi-three-dots-vertical"></i>
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.key}
            onClick={item.onClick}
            disabled={item.disabled}
            sx={item.danger ? { color: "error.main" } : undefined}
          >
            <ListItemIcon sx={item.danger ? { color: "error.main" } : undefined}>
              <i className={`bi ${item.icon}`}></i>
            </ListItemIcon>
            <ListItemText primary={item.label} secondary={item.note} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

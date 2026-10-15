import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import api from "../api/annkut";
import {
  getSevak,
  hasMandalScope,
  canAssignBook,
  canManageBooks,
  postLabel,
  parivarCode,
} from "../api/session";

function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // May be absent for a moment on a cold reload, so nothing here may assume it.
  const sevak = getSevak();
  // Reading a mandal's sevaks needs scope. Handling its books needs a
  // permission on top — a Sant or Sah Nirdeshak has the scope but cannot issue
  // or take back anything, so the books screen would be inert for them.
  const scoped = hasMandalScope(sevak);
  const handlesBooks = canAssignBook(sevak) || canManageBooks(sevak);
  const post = postLabel(sevak);
  const sevakId = sevak?.sevak_id || null;
  // The family code, shown under the title. A sant belongs to no parivar, so
  // there is nothing to show.
  const parivar = parivarCode(sevak);

  const navItems = [
    { path: "/home", label: "Annkut Seva", icon: "bi-house-door", show: true },
    // Needs a mandal in scope; the server answers 403 for anyone else, so
    // there would be nothing to show.
    {
      path: "/annkut-sevak-list",
      label: "Annkut Sevak list",
      icon: "bi-people",
      show: scoped,
    },
    // Books need book.assign on top of scope — admin and sanchalak.
    {
      path: "/receipt-books",
      label: "Receipt books",
      icon: "bi-journal-bookmark",
      show: handlesBooks,
    },
    {
      path: "/book-lookup",
      label: "Find a book",
      icon: "bi-search",
      show: sevakId === "ADMIN26",
    },
  ].filter((item) => item.show);

  // The bar is titled after the page it sits on.
  const title =
    navItems.find((item) => item.path === pathname)?.label || "Annkut Seva";

  const go = (path) => {
    setIsOpen(false);
    if (path !== pathname) navigate(path);
  };

  const handleLogout = async () => {
    setConfirmLogout(false);
    await api.logout();
    navigate("/", { replace: true });
  };

  const initial = (sevak?.name || sevak?.sevak_id || "?").trim().charAt(0);

  return (
    <>
      <header className="top-bar">
        <button
          type="button"
          className="top-bar-menu"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
          aria-expanded={isOpen}
        >
          <i className="bi bi-list" aria-hidden="true" />
        </button>
        <div className="top-bar-text">
          <span className="top-bar-title">{title}</span>
          {parivar && (
            <span className="top-bar-subtitle">Parivar {parivar}</span>
          )}
        </div>
      </header>

      <Drawer
        anchor="left"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        PaperProps={{ className: "nav-drawer" }}
      >
        {sevak && (
          <div className="nav-profile">
            <span className="nav-avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="nav-profile-text">
              <div className="nav-profile-name">{sevak.name}</div>
              <div className="nav-profile-meta">
                {sevak.sevak_id}
                {post ? ` · ${post}` : ""}
              </div>
              {/* null for sants and some senior karyakars */}
              {sevak.mandal?.name && (
                <div className="nav-profile-meta">{sevak.mandal.name}</div>
              )}
            </div>
          </div>
        )}

        <nav className="nav-list">
          {navItems.map((item) => {
            const active = item.path === pathname;
            return (
              <button
                key={item.path}
                type="button"
                className={`nav-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => go(item.path)}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="nav-list nav-list-bottom">
          <button
            type="button"
            className="nav-item"
            onClick={() => go("/change-password")}
          >
            <i className="bi bi-key" aria-hidden="true" />
            <span>Change password</span>
          </button>
          <button
            type="button"
            className="nav-item is-danger"
            onClick={() => {
              setIsOpen(false);
              setConfirmLogout(true);
            }}
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </Drawer>

      <Dialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        PaperProps={{ className: "app-dialog" }}
      >
        <DialogTitle>Log out?</DialogTitle>
        <DialogContent>
          You'll need your Sevak ID and password to sign in again.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLogout(false)} className="dialog-btn">
            Cancel
          </Button>
          <Button
            onClick={handleLogout}
            variant="contained"
            disableElevation
            className="dialog-btn dialog-btn-danger"
          >
            Log out
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Header;

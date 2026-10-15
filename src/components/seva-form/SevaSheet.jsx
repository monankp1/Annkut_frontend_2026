import React, { forwardRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slide,
  useMediaQuery,
} from "@mui/material";

const SlideUp = forwardRef((props, ref) => (
  <Slide direction="up" ref={ref} {...props} />
));

/**
 * The shell the Add and Edit seva forms share: a full-screen sheet on a
 * phone, a centred dialog on anything wider, with a fixed title bar and a
 * fixed footer so Save never scrolls out of reach.
 *
 * A tap outside never closes it — on a phone that happens by accident while
 * scrolling. ✕ and the system back gesture (Escape) ask first when `dirty`.
 *
 * `locked` hides ✕ and ignores Escape, for a screen that must be closed on
 * purpose with its own button (sign-in details that are shown only once).
 */
export default function SevaSheet({
  open,
  title,
  dirty = false,
  busy = false,
  locked = false,
  discardTitle = "Discard this entry?",
  discardText = "What you've typed will be lost.",
  onClose,
  footer,
  children,
}) {
  const phone = useMediaQuery("(max-width:599.95px)", { noSsr: true });
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = () => {
    if (busy || locked) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        fullScreen={phone}
        TransitionComponent={phone ? SlideUp : undefined}
        onClose={(e, reason) => {
          if (reason === "backdropClick") return;
          requestClose();
        }}
        aria-labelledby="seva-sheet-title"
        PaperProps={{ className: `seva-sheet${phone ? " is-phone" : ""}` }}
      >
        <header className="seva-sheet-bar">
          {!locked && (
            <button
              type="button"
              className="app-bar-back"
              onClick={requestClose}
              disabled={busy}
              aria-label="Close"
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          )}
          <h2 id="seva-sheet-title" className="app-bar-title">
            {title}
          </h2>
        </header>

        <div className="seva-sheet-body">{children}</div>

        {footer && <div className="seva-sheet-footer">{footer}</div>}
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        PaperProps={{ className: "app-dialog" }}
      >
        <DialogTitle>{discardTitle}</DialogTitle>
        <DialogContent>{discardText}</DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDiscard(false)}
            className="dialog-btn"
          >
            Keep editing
          </Button>
          <Button
            onClick={() => {
              setConfirmDiscard(false);
              onClose();
            }}
            variant="contained"
            disableElevation
            className="dialog-btn dialog-btn-danger"
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

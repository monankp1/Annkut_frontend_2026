// src/components/ExportSevaksDialog.jsx
//
// Downloads the sevak list as CSV — one row per sevak — for a whole xetra,
// every xetra, or (inside a mandal) just that mandal. One sevak/get_sevak
// request does it: the server already filters by area, mandal and pravrutti,
// and returns rows ordered xetra → mandal → parivar → sevak.
import React from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { toast } from "react-toastify";
import api, { num, errorText } from "../api/annkut";
import { FormError } from "./AuthFields";
import { downloadCsv, slug, toCsv, today } from "../utils/csv";

const fmt = new Intl.NumberFormat("en-IN");

const COLUMNS = [
  { header: "Xetra", value: (r) => r.area_name },
  { header: "Mandal", value: (r) => r.mandal_name },
  { header: "Parivar ID", value: (r) => r.parivar_code },
  { header: "Sevak ID", value: (r) => r.sevak_code },
  { header: "Name", value: (r) => r.full_name },
  { header: "Mobile", value: (r) => r.mobile },
  // 19 sevaks have no pankh; left blank rather than guessed.
  { header: "Pankh", value: (r) => r.pankh_label },
  { header: "Target", value: (r) => num(r.target_forms) },
  { header: "Filled", value: (r) => num(r.filled_forms) },
  // Only a backend that sends the split has these; blank otherwise, never 0.
  {
    header: "₹500 forms",
    value: (r) => (r.forms_500 === undefined ? "" : num(r.forms_500)),
  },
  {
    header: "₹1,000+ forms",
    value: (r) =>
      r.forms_1000_plus === undefined ? "" : num(r.forms_1000_plus),
  },
  { header: "Amount collected (₹)", value: (r) => num(r.collected_amount) },
];

/**
 * mode "areas":  pick All or one xetra. `areas` = [{ id, name, sevaks }].
 * mode "mandal": export `mandal` = { id, name, sevaks }.
 *
 * Sevak counts come from what the page already loaded, which reflects the
 * page's own Yuva filter (`countsYuva`); they are shown only while the box
 * here matches it, so a number on screen never describes a different file.
 */
export default function ExportSevaksDialog({
  open,
  onClose,
  mode,
  areas = [],
  mandal = null,
  yuvaDefault = false,
  countsYuva = false,
}) {
  const [choice, setChoice] = React.useState("all");
  const [yuva, setYuva] = React.useState(yuvaDefault);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setChoice("all");
      setYuva(yuvaDefault);
      setError("");
      setBusy(false);
    }
  }, [open, yuvaDefault]);

  const showCounts = yuva === countsYuva;
  const total = areas.reduce((s, a) => s + num(a.sevaks), 0);
  const allLabel = areas.every((a) => /^bharuch/i.test(a.name || ""))
    ? "All Bharuch"
    : "All xetras";

  const countText = (n) => (showCounts ? `${fmt.format(n)} sevaks` : "");

  const download = async () => {
    const area = areas.find((a) => String(a.id) === String(choice));

    const filters = {
      ...(mode === "mandal"
        ? { mandal_id: mandal?.id }
        : area
          ? { area_id: area.id }
          : {}),
      ...(yuva ? { pravrutti: "YUVA" } : {}),
    };

    const label =
      mode === "mandal" ? mandal?.name : area ? area.name : allLabel;

    setBusy(true);
    setError("");
    try {
      const res = await api.sevaks(filters);
      const rows = Array.isArray(res?.sevak) ? res.sevak : [];
      if (rows.length === 0) {
        setError("There are no sevaks to export for this choice.");
        return;
      }
      const name = ["annkut-sevaks", slug(label), yuva ? "yuva" : "", today()]
        .filter(Boolean)
        .join("_");
      downloadCsv(`${name}.csv`, toCsv(rows, COLUMNS));
      toast.success(`Downloaded ${fmt.format(rows.length)} sevaks.`);
      onClose?.();
    } catch (e) {
      setError(errorText(e, "Could not export the sevak list."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose?.()}
      PaperProps={{ className: "app-dialog" }}
    >
      <DialogTitle>Export sevak list</DialogTitle>
      <DialogContent>
        <div className="auth-form">
          {mode === "mandal" ? (
            <div className="void-summary">
              <div className="seva-card-name">{mandal?.name || "Mandal"}</div>
              {showCounts && num(mandal?.sevaks) > 0 && (
                <div className="seva-card-meta">
                  {countText(num(mandal.sevaks))}
                </div>
              )}
            </div>
          ) : (
            <div className="option-cards mb-3" role="radiogroup">
              {[{ id: "all", name: allLabel, sevaks: total }, ...areas].map(
                (o) => (
                  <label
                    key={o.id}
                    className={`option-card${
                      String(choice) === String(o.id) ? " is-active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="export_area"
                      checked={String(choice) === String(o.id)}
                      onChange={() => setChoice(o.id)}
                    />
                    <span className="option-card-row">
                      <span className="option-card-title">{o.name}</span>
                      <span className="option-card-sub">
                        {countText(num(o.sevaks))}
                      </span>
                    </span>
                  </label>
                ),
              )}
            </div>
          )}

          <label className="check-row">
            <input
              type="checkbox"
              checked={yuva}
              onChange={(e) => setYuva(e.target.checked)}
            />
            <span>Yuva Pravrutti only</span>
          </label>

          <p className="dialog-subtitle mt-2 mb-0">
            One row per sevak, grouped by xetra → mandal → parivar: IDs, name,
            mobile, pankh, target, filled, ₹500 and ₹1,000+ forms, and amount
            collected.
          </p>

          <FormError>{error}</FormError>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} className="dialog-btn">
          Cancel
        </Button>
        <Button
          onClick={download}
          disabled={busy}
          variant="contained"
          disableElevation
          className="dialog-btn dialog-btn-primary"
          startIcon={
            busy ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <i className="bi bi-download" aria-hidden="true" />
            )
          }
        >
          {busy ? "Preparing…" : "Download"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

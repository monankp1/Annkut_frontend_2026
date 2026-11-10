// src/components/ExportSevaksDialog.jsx
//
// Downloads the sevak list as CSV — one row per sevak — for a whole xetra,
// every xetra, or (inside a mandal) just that mandal. One sevak/get_sevak
// request does it: the server already filters by area, mandal and pravrutti,
// and returns rows ordered xetra → mandal → parivar → sevak.
//
// With "Include sahyogi forms" on, each sevak's row is followed by every form
// they collected this year. Forms come from one seva/get_seva request for the
// whole year and are matched to sevaks by collector, so a sevak's form rows
// always equal their Filled count — even forms written in another mandal's
// book.
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
import { formatDate } from "./receipt-books/BookList";
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

// Who the row belongs to: repeated on every form row, so filtering or sorting
// in Excel never leaves a form without its sevak.
const IDENTITY = new Set(["Xetra", "Mandal", "Parivar ID", "Sevak ID", "Name"]);

const onForm = (pick) => (r) => (r.form ? pick(r.form) : "");

// Rows here are { sevak, form } — form is null on the sevak's own row.
const WITH_FORMS_COLUMNS = [
  { header: "Row", value: (r) => (r.form ? "Form" : "Sevak") },
  ...COLUMNS.map((c) => ({
    header: c.header,
    value: IDENTITY.has(c.header)
      ? (r) => c.value(r.sevak)
      : (r) => (r.form ? "" : c.value(r.sevak)),
  })),
  { header: "Book", value: onForm((f) => f.book_no) },
  { header: "Receipt", value: onForm((f) => num(f.receipt_no)) },
  { header: "Sahyogi name", value: onForm((f) => f.sahyogi_name) },
  { header: "Sahyogi mobile", value: onForm((f) => f.sahyogi_number) },
  { header: "Seva amount (₹)", value: onForm((f) => num(f.seva_amount)) },
  { header: "Date", value: onForm((f) => formatDate(f.collected_at)) },
];

/** Book then receipt, the order of the physical books. */
const byBookPage = (a, b) =>
  String(a.book_no ?? "").localeCompare(String(b.book_no ?? ""), undefined, {
    numeric: true,
  }) || num(a.receipt_no) - num(b.receipt_no);

/**
 * This year's recorded forms grouped by collector id. Same rule as the
 * server's Filled count: current year, status "recorded", not deleted.
 */
function formsByCollector(forms, year) {
  const map = new Map();
  for (const f of forms) {
    if (f.status && f.status !== "recorded") continue;
    if (f.year && num(f.year) !== year) continue;
    const key = String(f.collected_by_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  for (const list of map.values()) list.sort(byBookPage);
  return map;
}

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
  const [withForms, setWithForms] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setChoice("all");
      setYuva(yuvaDefault);
      setWithForms(false);
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

    const year = new Date().getFullYear();

    setBusy(true);
    setError("");
    try {
      const [res, formsRes] = await Promise.all([
        api.sevaks(filters),
        withForms ? api.sevaList({ year }) : null,
      ]);
      const sevaks = Array.isArray(res?.sevak) ? res.sevak : [];
      if (sevaks.length === 0) {
        setError("There are no sevaks to export for this choice.");
        return;
      }

      const name = [
        "annkut-sevaks",
        slug(label),
        yuva ? "yuva" : "",
        withForms ? "with-forms" : "",
        today(),
      ]
        .filter(Boolean)
        .join("_");

      if (!withForms) {
        downloadCsv(`${name}.csv`, toCsv(sevaks, COLUMNS));
        toast.success(`Downloaded ${fmt.format(sevaks.length)} sevaks.`);
        onClose?.();
        return;
      }

      const grouped = formsByCollector(
        Array.isArray(formsRes?.seva) ? formsRes.seva : [],
        year,
      );
      const rows = [];
      let formCount = 0;
      for (const sevak of sevaks) {
        rows.push({ sevak, form: null });
        for (const form of grouped.get(String(sevak.id)) || []) {
          rows.push({ sevak, form });
          formCount += 1;
        }
      }

      downloadCsv(`${name}.csv`, toCsv(rows, WITH_FORMS_COLUMNS));
      toast.success(
        `Downloaded ${fmt.format(sevaks.length)} sevaks and ${fmt.format(
          formCount,
        )} forms.`,
      );
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

          <label className={`switch-card${withForms ? " is-on" : ""}`}>
            <span className="switch-card-text">
              <span className="switch-card-title">Include sahyogi forms</span>
              <span className="switch-card-sub">
                Each sevak's forms listed under them
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch-input"
              checked={withForms}
              aria-checked={withForms}
              onChange={(e) => setWithForms(e.target.checked)}
            />
          </label>

          <p className="dialog-subtitle mt-2 mb-0">
            {withForms
              ? "A row per sevak, followed by their forms this year: book, receipt, sahyogi name and mobile, amount and date."
              : "One row per sevak, grouped by xetra → mandal → parivar: IDs, name, mobile, pankh, target, filled, ₹500 and ₹1,000+ forms, and amount collected."}
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

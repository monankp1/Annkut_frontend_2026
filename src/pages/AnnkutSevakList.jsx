// src/pages/AnnkutSevakList.jsx
//
// Two screens in one page: the mandal grid (grouped by xetra), and the sevaks
// of the mandal that was tapped. The chosen mandal lives in the URL
// (?mandal=12) so the phone's back gesture returns to the grid and a reload
// stays where it was.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import api, { num, errorText } from "../api/annkut";
import {
  getSevak,
  hasMandalScope,
  canEditSevak,
  canCreateSevak,
  canDeactivateSevak,
  canResetPassword,
  canFilterYuva,
  canExportSevaks,
} from "../api/session";
import ExportSevaksDialog from "../components/ExportSevaksDialog";
import ResetPasswordModal from "../components/ResetPasswordModal";
import SevakActionsMenu from "../components/SevakActionsMenu";
import Header from "../components/Header";
import AddAnnkutSevakModal from "../components/AddAnnkutSevakModal";
import EditSevakModal from "../components/EditSevakModal";

const fmt = new Intl.NumberFormat("en-IN");
const pct = (filled, target) =>
  target > 0
    ? Math.max(0, Math.min(100, Math.round((filled / target) * 100)))
    : 0;

/** Search only what is on screen — never ids, flags or field names. */
const matches = (needle, ...fields) =>
  fields.some((f) =>
    String(f ?? "")
      .toLowerCase()
      .includes(needle),
  );

const MiniBar = ({ filled, target }) => (
  <span className="mini-track" aria-hidden="true">
    <span className="mini-fill" style={{ width: `${pct(filled, target)}%` }} />
  </span>
);

const SkeletonCards = ({ label }) => (
  <div aria-busy="true" aria-label={label}>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="seva-card is-skeleton" aria-hidden="true">
        <span className="skeleton-line sk-60" />
        <span className="skeleton-line sk-40" />
        <span className="skeleton-line sk-50" />
      </div>
    ))}
  </div>
);

const ErrorState = ({ title, message, onRetry }) => (
  <div className="list-state" role="alert">
    <i className="bi bi-wifi-off list-state-icon" aria-hidden="true" />
    <p className="list-state-title">{title}</p>
    <p className="list-state-text">{message}</p>
    <button type="button" className="outline-btn" onClick={onRetry}>
      <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
    </button>
  </div>
);

export default function AnnkutSevakList() {
  // Identity comes from the token. This is only here to decide what to draw —
  // the server re-checks everything and answers 403 on its own.
  const me = getSevak();
  const scoped = hasMandalScope(me);
  const ownMandal = me?.mandal || null;

  // A sanchalak may correct a sevak's details inside his own mandal; adding
  // and deactivating stay with the admin.
  const mayEdit = canEditSevak(me);
  const mayCreate = canCreateSevak(me);
  const mayDeactivate = canDeactivateSevak(me);
  const mayResetPassword = canResetPassword(me);
  const mayFilterYuva = canFilterYuva(me);
  const mayExport = canExportSevaks(me);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Someone without scope only ever sees their own mandal.
  const selectedId = scoped
    ? num(searchParams.get("mandal")) || null
    : num(ownMandal?.id) || null;
  const mode = selectedId ? "sevaks" : "mandals";

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [sevaks, setSevaks] = useState([]);
  const [sevaksLoading, setSevaksLoading] = useState(false);
  const [sevaksError, setSevaksError] = useState("");

  // The Yuva Pravrutti switch. Sent to the totals and the sevak list alike, so
  // the summary and the list always describe the same population.
  const [yuvaOnly, setYuvaOnly] = useState(false);

  const [qMandal, setQMandal] = useState("");
  const [qSevak, setQSevak] = useState("");

  const [showAddAnnkutSevak, setShowAddAnnkutSevak] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [resetRow, setResetRow] = useState(null);
  const [deactivateRow, setDeactivateRow] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // ---------- fetchers ----------

  // Each fetch keeps its own loading flag and ignores replies that arrive
  // after a newer request — a shared flag let "No sevaks found" flash while
  // the list was still on its way.
  const summaryReq = useRef(0);
  const sevaksReq = useRef(0);

  /**
   * Headline totals and the mandal list in one call.
   *
   * get_seva_count applies the pravrutti filter to both its summary and its
   * mandal_array, while get_mandal_list takes no filter at all — so sourcing
   * the mandal rows from here is what stops yuva totals sitting above
   * whole-mandal numbers.
   */
  const fetchSummary = useCallback(async (mandalId, yuva) => {
    const id = ++summaryReq.current;
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await api.summary({
        ...(mandalId ? { mandal_id: mandalId } : {}),
        ...(yuva ? { pravrutti: "YUVA" } : {}),
      });
      if (id === summaryReq.current) setSummary(res || null);
    } catch (e) {
      console.error("Error fetching summary:", e);
      if (id !== summaryReq.current) return;
      setSummary(null);
      setSummaryError(errorText(e, "Failed to load totals."));
    } finally {
      if (id === summaryReq.current) setSummaryLoading(false);
    }
  }, []);

  const fetchSevaks = useCallback(async (mandalId, yuva) => {
    const id = ++sevaksReq.current;
    setSevaksLoading(true);
    setSevaksError("");
    try {
      // An unauthorised mandal_id is a 403, never a silently empty list.
      const res = await api.sevaks({
        ...(mandalId ? { mandal_id: mandalId } : {}),
        ...(yuva ? { pravrutti: "YUVA" } : {}),
      });
      if (id !== sevaksReq.current) return;
      setSevaks(Array.isArray(res?.sevak) ? res.sevak : []);
    } catch (e) {
      console.error("Error fetching sevaks:", e);
      if (id !== sevaksReq.current) return;
      setSevaks([]);
      setSevaksError(errorText(e, "Failed to load sevaks."));
    } finally {
      if (id === sevaksReq.current) setSevaksLoading(false);
    }
  }, []);

  /**
   * Everything on screen, with the filter currently on. Used after any edit,
   * so a change can never quietly drop the Yuva filter.
   */
  const reload = useCallback(() => {
    fetchSummary(selectedId, yuvaOnly);
    if (selectedId) fetchSevaks(selectedId, yuvaOnly);
  }, [fetchSummary, fetchSevaks, selectedId, yuvaOnly]);

  useEffect(() => {
    if (!selectedId) setSevaks([]);
    reload();
  }, [reload, selectedId]);

  // A new mandal starts with a clean search.
  useEffect(() => {
    setQSevak("");
  }, [selectedId]);

  // ---------- derived ----------

  // The server echoes back the pankh codes the filter resolved to, so the
  // screen labels itself from that rather than its own copy of the rule.
  const pankhFilterLabel = (summary?.pankh_filter || []).join(" + ");

  const mandals = useMemo(
    () => (Array.isArray(summary?.mandal_array) ? summary.mandal_array : []),
    [summary],
  );

  // Mandals arrive ordered by area then name; grouping keeps that order.
  const groupedByArea = useMemo(() => {
    const needle = qMandal.trim().toLowerCase();
    const map = new Map();
    for (const m of mandals) {
      if (
        needle &&
        !matches(needle, m?.name, m?.code, m?.area_code, m?.area_name)
      ) {
        continue;
      }
      const key = String(m?.area_name ?? "").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return Array.from(map.entries());
  }, [mandals, qMandal]);

  const visibleSevaks = useMemo(() => {
    const needle = qSevak.trim().toLowerCase();
    if (!needle) return sevaks;
    return sevaks.filter((s) =>
      matches(needle, s?.full_name, s?.sevak_code, s?.parivar_code, s?.mobile),
    );
  }, [sevaks, qSevak]);

  const sum = (rows, field) =>
    rows.reduce((acc, r) => acc + num(r?.[field]), 0);

  // mandal_array always lists every mandal in scope, even when one mandal was
  // asked for, so the open mandal's own row is in there.
  const selectedRow = selectedId
    ? mandals.find((m) => num(m?.id) === selectedId) || null
    : null;

  const selectedName =
    location.state?.mandalName ||
    selectedRow?.name ||
    sevaks[0]?.mandal_name ||
    (!scoped ? ownMandal?.name : "") ||
    "Mandal";

  // The xetras on offer in the export, in screen order, with sevak counts
  // from the mandal rows already loaded.
  const exportAreas = useMemo(() => {
    const map = new Map();
    for (const m of mandals) {
      if (!m?.area_id) continue;
      const key = String(m.area_id);
      if (!map.has(key)) {
        map.set(key, { id: num(m.area_id), name: m.area_name, sevaks: 0 });
      }
      map.get(key).sevaks += num(m?.sevaks);
    }
    return Array.from(map.values());
  }, [mandals]);

  // ---------- handlers ----------

  function openMandal(m) {
    setSearchParams(
      { mandal: String(num(m?.id)) },
      { state: { mandalName: m?.name || "", fromGrid: true } },
    );
  }

  // Back to the grid. When the grid is what brought us here, step back in
  // history so the phone's back gesture and this arrow agree.
  function backToMandals() {
    if (location.state?.fromGrid) navigate(-1);
    else setSearchParams({}, { replace: true });
  }

  async function confirmDeactivate() {
    const code = deactivateRow?.sevak_code;
    if (!code) return;
    setDeactivating(true);
    try {
      const res = await api.deactivateSevak(code);
      toast.success(res?.message || "Sevak deactivated.");
      reload();
    } catch (e) {
      console.error("Deactivate error:", e);
      toast.error(errorText(e, "Could not deactivate that sevak."));
    } finally {
      setDeactivating(false);
      setDeactivateRow(null);
    }
  }

  // Adding needs a mandal to add into, so it waits until one is chosen.
  // sevak.create is ADMIN only — a Sanchalak may edit a sevak but not add one.
  const addTargetMandal =
    selectedId && mayCreate ? { id: selectedId, name: selectedName } : null;

  // ---------- render pieces ----------

  // get_seva_count's total_target adds up every mandal in scope even when a
  // mandal_id is sent (list_mandals ignores that filter), while the form
  // counts do respect it. Inside a mandal, take the target from its own row —
  // which also carries the Yuva-only target when that filter is on.
  const target = selectedRow
    ? num(selectedRow.target_forms)
    : num(summary?.total_target);
  const filled = num(summary?.total_filled_form);
  const achieved = target > 0 && filled >= target;

  // While totals load, the previous screen's numbers are still in `summary`
  // (opening a mandal would briefly show the whole kshetra), so show the
  // card's shape instead of stale figures.
  const summaryCard = summaryLoading ? (
    <section
      className="progress-card is-skeleton"
      aria-busy="true"
      aria-label="Loading totals"
    >
      <div className="progress-card-head" aria-hidden="true">
        <span className="skeleton-line skeleton-lg sk-50" />
        <span className="skeleton-line skeleton-pct" />
      </div>
      <span className="skeleton-line skeleton-track" aria-hidden="true" />
      <div className="amount-tiles" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="amount-tile is-skeleton">
            <span className="skeleton-line skeleton-lg sk-40" />
            <span className="skeleton-line sk-60" />
          </div>
        ))}
      </div>
    </section>
  ) : (
    summary && (
      <section
        className={`progress-card${achieved ? " is-achieved" : ""}`}
        aria-label="Totals"
      >
        <div className="progress-card-head">
          <span className="progress-card-count">
            <strong>{fmt.format(filled)}</strong>
            {target > 0 ? ` of ${fmt.format(target)} forms` : " forms filled"}
          </span>
          {target > 0 && (
            <span className="progress-card-pct">{pct(filled, target)}%</span>
          )}
        </div>
        {target > 0 && (
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct(filled, target)}
            aria-label={yuvaOnly ? "Yuva target achieved" : "Target achieved"}
          >
            <div
              className="progress-fill"
              style={{ width: `${pct(filled, target)}%` }}
            />
          </div>
        )}
        {/* Prasad goes by amount: one box for ₹500, one box for everyone at
          ₹1,000 or more. "Other" can only be above ₹1,000 (the form refuses
          less), so it belongs with ₹1,000 — the two always add up to the
          forms total above. */}
        <div className="amount-tiles">
          <div className="amount-tile is-500">
            <span className="amount-tile-count">
              {fmt.format(num(summary?.seva_five_hundered))}
            </span>
            <span className="amount-tile-label">₹500 forms</span>
          </div>
          <div className="amount-tile is-1000">
            <span className="amount-tile-count">
              {fmt.format(
                num(summary?.seva_thousand) + num(summary?.seva_other),
              )}
            </span>
            <span className="amount-tile-label">₹1,000+ forms</span>
          </div>
        </div>
        {/* Under the filter the target comes from a different table:
          unfiltered it is the mandal's own target, filtered it is the sum of
          the matching sevaks' individual targets. The two answer different
          questions and will not add up, so say which one this is. */}
        {yuvaOnly && (
          <div className="progress-card-note">
            Yuva target: sum of individual sevak targets
            {pankhFilterLabel ? ` (${pankhFilterLabel})` : ""} — not comparable
            with the mandal target.
          </div>
        )}
      </section>
    )
  );

  const toolbar = (
    <div className="list-toolbar">
      <div className="list-toolbar-row">
        <div className="search-field">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            value={mode === "mandals" ? qMandal : qSevak}
            onChange={(e) =>
              mode === "mandals"
                ? setQMandal(e.target.value)
                : setQSevak(e.target.value)
            }
            placeholder={
              mode === "mandals"
                ? "Search mandals"
                : "Search name, ID, parivar, mobile"
            }
            aria-label={mode === "mandals" ? "Search mandals" : "Search sevaks"}
            enterKeyHint="search"
          />
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={reload}
          disabled={summaryLoading || sevaksLoading}
          aria-label="Refresh"
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true" />
        </button>
        {mayExport && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => setExportOpen(true)}
            aria-label={
              mode === "mandals"
                ? "Export sevak list"
                : `Export ${selectedName} sevaks`
            }
          >
            <i className="bi bi-download" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Only the people named in canFilterYuva get this switch. Prefer
          pravrutti over spelling out ["YK","YT"]: the grouping lives in the
          database, so if Yuva Pravrutti ever covers a different set of pankh
          the server follows on its own. */}
      {mayFilterYuva && (
        <div className="chip-row">
          <button
            type="button"
            className={`filter-chip${yuvaOnly ? " is-active" : ""}`}
            aria-pressed={yuvaOnly}
            onClick={() => setYuvaOnly((v) => !v)}
          >
            {yuvaOnly && <i className="bi bi-check-lg" aria-hidden="true" />}
            Yuva Pravrutti
          </button>
        </div>
      )}
    </div>
  );

  let content;

  if (!scoped && !ownMandal) {
    // Someone with no mandal in scope reaches this page only by URL.
    content = (
      <div className="list-state">
        <i className="bi bi-people list-state-icon" aria-hidden="true" />
        <p className="list-state-title">No sevak list to show</p>
        <p className="list-state-text">You do not manage any mandal.</p>
      </div>
    );
  } else if (mode === "mandals") {
    let mandalList;
    if (summaryError) {
      mandalList = (
        <ErrorState
          title="Couldn't load mandals"
          message={summaryError}
          onRetry={reload}
        />
      );
    } else if (summaryLoading && mandals.length === 0) {
      mandalList = <SkeletonCards label="Loading mandals" />;
    } else if (groupedByArea.length === 0) {
      mandalList = (
        <div className="list-state">
          <i className="bi bi-search list-state-icon" aria-hidden="true" />
          <p className="list-state-title">
            {qMandal.trim()
              ? `No mandals match “${qMandal.trim()}”`
              : "No mandals found"}
          </p>
        </div>
      );
    } else {
      mandalList = groupedByArea.map(([area, rows]) => (
        <section key={area || "no-area"} className="area-group">
          <h2 className="area-heading">
            <span>{area || "(No Xetra)"}</span>
            <span className="area-heading-count">
              {fmt.format(sum(rows, "filled_forms"))} /{" "}
              {fmt.format(sum(rows, "target_forms"))}
            </span>
          </h2>
          <ul className="seva-list">
            {rows.map((m) => {
              const t = num(m?.target_forms);
              const f = num(m?.filled_forms);
              return (
                <li key={m?.id}>
                  <button
                    type="button"
                    className="mandal-row"
                    onClick={() => openMandal(m)}
                  >
                    <span className="mandal-row-main">
                      <span className="mandal-row-name">
                        {m?.name || "Mandal"}
                      </span>
                      <span className="mandal-row-progress">
                        <MiniBar filled={f} target={t} />
                        <span>
                          {fmt.format(f)}/{fmt.format(t)}
                          {t > 0 ? ` · ${pct(f, t)}%` : ""}
                        </span>
                      </span>
                      <span className="mandal-row-meta">
                        {num(m?.sevaks)} sevaks · {num(m?.parivars)} parivars
                      </span>
                    </span>
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ));
    }

    content = (
      <>
        {summaryCard}
        {mandalList}
      </>
    );
  } else {
    let sevakList;
    if (sevaksError) {
      sevakList = (
        <ErrorState
          title="Couldn't load sevaks"
          message={sevaksError}
          onRetry={reload}
        />
      );
    } else if (sevaksLoading && sevaks.length === 0) {
      sevakList = <SkeletonCards label="Loading sevaks" />;
    } else if (visibleSevaks.length === 0) {
      sevakList = (
        <div className="list-state">
          <i className="bi bi-search list-state-icon" aria-hidden="true" />
          <p className="list-state-title">
            {qSevak.trim()
              ? `No sevaks match “${qSevak.trim()}”`
              : "No sevaks found"}
          </p>
        </div>
      );
    } else {
      sevakList = (
        <ul className="seva-list">
          {visibleSevaks.map((row) => {
            const t = num(row?.target_forms);
            const f = num(row?.filled_forms);
            // 19 sevaks have no pankh; never default it to a guess.
            const meta = [row?.sevak_code, row?.parivar_code, row?.pankh_label]
              .filter(Boolean)
              .join(" · ");
            // Per-prasad-box split. Only sent by a backend that has it, and
            // not worth a line for someone with no forms yet.
            const hasSplit = f > 0 && row?.forms_500 !== undefined;
            const f500 = num(row?.forms_500);
            const f1000 = num(row?.forms_1000_plus);
            return (
              <li key={row?.id} className="seva-card">
                <div className="seva-card-top">
                  <span className="seva-card-name">
                    {row?.full_name || "—"}
                  </span>
                  <span className="sevak-card-actions">
                    <SevakActionsMenu
                      sevak={row}
                      isSelf={row?.sevak_code === me?.sevak_id}
                      mayEdit={mayEdit}
                      mayResetPassword={mayResetPassword}
                      mayDeactivate={mayDeactivate}
                      onEdit={setEditRow}
                      onResetPassword={setResetRow}
                      onDeactivate={setDeactivateRow}
                    />
                  </span>
                </div>
                <div className="seva-card-meta">{meta}</div>
                <div className="sevak-card-progress mt-1">
                  <MiniBar filled={f} target={t} />
                  <span>
                    {f}/{t} forms
                  </span>
                </div>
                {(hasSplit || row?.mobile) && (
                  <div className="sevak-card-bottom">
                    {hasSplit ? (
                      <span className="split-pills">
                        <span
                          className={`split-pill is-500${f500 ? "" : " is-zero"}`}
                          aria-label={`₹500 forms: ${f500}`}
                        >
                          ₹500 <strong>{f500}</strong>
                        </span>
                        <span
                          className={`split-pill is-1000${
                            f1000 ? "" : " is-zero"
                          }`}
                          aria-label={`₹1,000 and above forms: ${f1000}`}
                        >
                          ₹1,000+ <strong>{f1000}</strong>
                        </span>
                      </span>
                    ) : (
                      <span />
                    )}
                    {row?.mobile && (
                      <a className="seva-card-phone" href={`tel:${row.mobile}`}>
                        <i className="bi bi-telephone" aria-hidden="true" />
                        {row.mobile}
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      );
    }

    content = (
      <>
        {summaryCard}
        <h2 className="section-title">
          Sevaks
          {!sevaksLoading && !sevaksError && ` (${visibleSevaks.length})`}
        </h2>
        {sevakList}
      </>
    );
  }

  return (
    <div className={`list-page${addTargetMandal ? " has-bottom-action" : ""}`}>
      <Header />

      {mode === "sevaks" && (
        <div className="sub-bar">
          {scoped && (
            <button
              type="button"
              className="app-bar-back"
              onClick={backToMandals}
              aria-label="Back to mandals"
            >
              <i className="bi bi-arrow-left" aria-hidden="true" />
            </button>
          )}
          <h1 className="sub-bar-title">{selectedName}</h1>
        </div>
      )}

      {(scoped || ownMandal) && toolbar}

      <main className="list-body">{content}</main>

      {addTargetMandal && (
        <div className="bottom-action">
          <button
            type="button"
            className="brand-btn"
            onClick={() => setShowAddAnnkutSevak(true)}
          >
            <i className="bi bi-person-plus" aria-hidden="true" />
            <span>Add sevak</span>
          </button>
        </div>
      )}

      <Dialog
        open={Boolean(deactivateRow)}
        onClose={() => !deactivating && setDeactivateRow(null)}
        PaperProps={{ className: "app-dialog" }}
      >
        <DialogTitle>Deactivate {deactivateRow?.full_name}?</DialogTitle>
        <DialogContent>
          They will not be able to sign in, and will be removed from the mandal
          list. Seva already recorded is kept.
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeactivateRow(null)}
            disabled={deactivating}
            className="dialog-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeactivate}
            disabled={deactivating}
            variant="contained"
            disableElevation
            className="dialog-btn dialog-btn-danger"
            startIcon={
              deactivating ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {deactivating ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogActions>
      </Dialog>

      {showAddAnnkutSevak && addTargetMandal && (
        <AddAnnkutSevakModal
          modal={showAddAnnkutSevak}
          setModal={setShowAddAnnkutSevak}
          mandal={addTargetMandal}
          refreshData={reload}
        />
      )}

      {/* No refresh on close: a reset changes nothing the list shows. */}
      {resetRow && (
        <ResetPasswordModal
          open={Boolean(resetRow)}
          onClose={() => setResetRow(null)}
          sevak={resetRow}
        />
      )}

      {editRow && (
        <EditSevakModal
          modal={Boolean(editRow)}
          setModal={(open) => !open && setEditRow(null)}
          sevakData={editRow}
          refreshData={reload}
        />
      )}

      {mayExport && (
        <ExportSevaksDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          mode={mode === "sevaks" ? "mandal" : "areas"}
          areas={exportAreas}
          mandal={
            selectedId
              ? { id: selectedId, name: selectedName, sevaks: sevaks.length }
              : null
          }
          yuvaDefault={yuvaOnly}
          countsYuva={yuvaOnly}
        />
      )}

      <ToastContainer
        position="top-center"
        autoClose={5000}
        closeOnClick
        pauseOnHover
        theme="colored"
      />
    </div>
  );
}

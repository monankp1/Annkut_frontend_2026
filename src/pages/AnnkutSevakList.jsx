// src/pages/AnnkutSevakList.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { num, errorText } from "../api/annkut";
import {
  getSevak,
  hasMandalScope,
  canEditSevak,
  canCreateSevak,
  canDeactivateSevak,
  canResetPassword,
} from "../api/session";
import ResetPasswordModal from "../components/ResetPasswordModal";
import SevakActionsMenu from "../components/SevakActionsMenu";
import Header from "../components/Header";
import AddAnnkutSevakModal from "../components/AddAnnkutSevakModal";
import EditSevakModal from "../components/EditSevakModal";
import { toast, ToastContainer } from "react-toastify";

import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableContainer,
  TableRow,
  TableCell,
  IconButton,
  TextField,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip,
  Typography,
} from "@mui/material";

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
  const showActions = mayEdit || mayResetPassword || mayDeactivate;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState(null);

  const [mandals, setMandals] = useState([]);
  const [qMandal, setQMandal] = useState("");

  const [sevaks, setSevaks] = useState([]);
  const [qSevak, setQSevak] = useState("");

  // "mandals" | "sevaks"
  const [mode, setMode] = useState(scoped ? "mandals" : "sevaks");

  // The mandal being looked at: { id, name }. Every write needs the id.
  const [selectedMandal, setSelectedMandal] = useState(
    scoped ? null : ownMandal
  );

  const [showAddAnnkutSevak, setShowAddAnnkutSevak] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedSevakRow, setSelectedSevakRow] = useState(null);

  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [itemToDeactivate, setItemToDeactivate] = useState(null);

  const [resetModal, setResetModal] = useState(false);
  const [sevakToReset, setSevakToReset] = useState(null);

  // ---------- fetchers ----------

  const fetchSummary = useCallback(async (mandalId) => {
    try {
      const res = await api.summary(mandalId ? { mandal_id: mandalId } : {});
      setSummary(res || null);
    } catch (e) {
      console.error("Error fetching summary:", e);
    }
  }, []);

  const fetchMandals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.mandals({});
      const arr = res?.mandal_array;
      setMandals(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error("Failed to fetch mandals:", e);
      setMandals([]);
      setError(errorText(e, "Failed to load mandals."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSevaks = useCallback(async (mandalId) => {
    setError("");
    setLoading(true);
    try {
      // An unauthorised mandal_id is a 403, never a silently empty list.
      const res = await api.sevaks(mandalId ? { mandal_id: mandalId } : {});
      const rows = res?.sevak;
      setSevaks(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("Error fetching sevaks:", e);
      setSevaks([]);
      setError(errorText(e, "Failed to load sevaks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    if (scoped) fetchMandals();
    else if (ownMandal?.id) fetchSevaks(ownMandal.id);
    // Runs once; everything after this is an explicit user action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- derived ----------

  const filteredMandals = useMemo(() => {
    const needle = qMandal.trim().toLowerCase();
    if (!needle) return mandals;
    return (mandals || []).filter((m) =>
      JSON.stringify(m || {})
        .toLowerCase()
        .includes(needle)
    );
  }, [mandals, qMandal]);

  const filteredSevaks = useMemo(() => {
    const needle = qSevak.trim().toLowerCase();
    if (!needle) return sevaks;
    return (sevaks || []).filter((s) =>
      JSON.stringify(s || {})
        .toLowerCase()
        .includes(needle)
    );
  }, [sevaks, qSevak]);

  const sum = (rows, field) =>
    rows.reduce((acc, r) => acc + num(r?.[field]), 0);

  // Mandals arrive ordered by area then name; grouping keeps that order.
  const groupedByArea = useMemo(() => {
    const arr = Array.isArray(filteredMandals) ? filteredMandals : [];
    const map = new Map();

    for (const item of arr) {
      const key = String(item?.area_name ?? "").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }

    return Array.from(map.entries());
  }, [filteredMandals]);

  // ---------- handlers ----------

  async function handleRefresh() {
    await fetchSummary(selectedMandal?.id);
    if (mode === "mandals" && scoped) await fetchMandals();
    else await fetchSevaks(selectedMandal?.id);
  }

  async function handleMandalCardClick(m) {
    const picked = { id: num(m?.id), name: m?.name || "" };
    setSelectedMandal(picked);
    setQSevak("");
    setMode("sevaks");
    await Promise.all([fetchSevaks(picked.id), fetchSummary(picked.id)]);
  }

  function handleBackToMandals() {
    setSelectedMandal(null);
    setQSevak("");
    setSevaks([]);
    setMode("mandals");
    fetchSummary();
  }

  function handleEdit(row) {
    setSelectedSevakRow(row);
    setEditModal(true);
  }

  function handleResetPassword(row) {
    setSevakToReset(row);
    setResetModal(true);
  }

  function handleDeactivatePrompt(row) {
    setItemToDeactivate(row);
    setOpenConfirmDialog(true);
  }

  async function handleConfirmDeactivate() {
    const code = itemToDeactivate?.sevak_code;
    if (!code) return;

    try {
      const res = await api.deactivateSevak(code);
      toast.success(res?.message || "Sevak deactivated.");
      await fetchSevaks(selectedMandal?.id);
    } catch (e) {
      console.error("Deactivate error:", e);
      toast.error(errorText(e, "Could not deactivate that sevak."));
    } finally {
      setOpenConfirmDialog(false);
      setItemToDeactivate(null);
    }
  }

  // Adding needs a mandal to add into, so it waits until one is chosen.
  const addTargetMandal = selectedMandal?.id ? selectedMandal : null;

  // ---------- render ----------

  return (
    <>
      <Header />

      <Box p={2}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
        >
          <Typography variant="h5">
            {mode === "mandals" ? "Mandals" : "Annkut Sevaks"}
          </Typography>

          <Box display="flex" alignItems="center" gap={1}>
            {addTargetMandal && mayCreate && (
              <Button
                variant="outlined"
                onClick={() => setShowAddAnnkutSevak(true)}
                startIcon={<i className="bi bi-person-plus"></i>}
              >
                Add Annkut Sevak
              </Button>
            )}

            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={loading}>
                <i className="bi bi-arrow-clockwise"></i>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Target
              </Typography>
              <Typography variant="h6">
                {num(summary?.total_target)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Filled Forms
              </Typography>
              <Typography variant="h6">
                {num(summary?.total_filled_form)}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                ₹500 Seva
              </Typography>
              <Typography variant="h6">
                {num(summary?.seva_five_hundered)}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                ₹1000
              </Typography>
              <Typography variant="h6">{num(summary?.seva_thousand)}</Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Other
              </Typography>
              <Typography variant="h6">{num(summary?.seva_other)}</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Someone with no mandal in scope reaches this page only by URL. */}
        {!scoped && !ownMandal && (
          <Paper sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            You do not manage any mandal, so there is no sevak list to show.
          </Paper>
        )}

        {/* Mandal grid */}
        {scoped && mode === "mandals" && (
          <>
            <Box display="flex" gap={1} mb={2}>
              <TextField
                size="small"
                placeholder="Search mandals…"
                value={qMandal}
                onChange={(e) => setQMandal(e.target.value)}
                sx={{ width: 360 }}
              />
            </Box>

            {groupedByArea.length === 0 && (
              <Paper
                sx={{ p: 2, textAlign: "center", color: "text.secondary" }}
              >
                {loading ? "Loading mandals…" : "No mandals found"}
              </Paper>
            )}

            {groupedByArea.map(([area, rows]) => (
              <Box key={area || "no-area"} mb={3}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, mb: 1, textAlign: "center" }}
                >
                  {area || "(No Xetra)"}
                </Typography>

                <Grid container spacing={2}>
                  {rows.map((m) => {
                    const name = m?.name || "Mandal";
                    const target = num(m?.target_forms);
                    const filled = num(m?.filled_forms);
                    return (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={m?.id}>
                        <Card
                          variant="outlined"
                          onClick={() => handleMandalCardClick(m)}
                          sx={{
                            cursor: "pointer",
                            borderColor: "divider",
                            transition: "box-shadow 120ms ease",
                            "&:hover": { boxShadow: 3 },
                          }}
                        >
                          <CardContent>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700 }}
                            >
                              {name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {m?.area_code || "—"}
                            </Typography>

                            <Box
                              mt={1}
                              display="flex"
                              gap={0.5}
                              flexWrap="wrap"
                            >
                              <Chip size="small" label={`Target: ${target}`} />
                              <Chip size="small" label={`Filled: ${filled}`} />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`${num(m?.sevaks)} sevaks · ${num(
                                  m?.parivars
                                )} parivars`}
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>

                <Box mt={1}>
                  <Paper
                    sx={{
                      p: 1.5,
                      display: "flex",
                      gap: 3,
                      justifyContent: "center",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                      Subtotal Filled: {sum(rows, "filled_forms")}
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                      Subtotal Target: {sum(rows, "target_forms")}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            ))}
          </>
        )}

        {/* Sevak table */}
        {mode === "sevaks" && (scoped || ownMandal) && (
          <>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Box display="flex" alignItems="center" gap={1}>
                {scoped && (
                  <Button
                    variant="outlined"
                    onClick={handleBackToMandals}
                    startIcon={<i className="bi bi-arrow-left"></i>}
                  >
                    Back to mandals
                  </Button>
                )}
                {selectedMandal?.name && (
                  <Chip
                    variant="outlined"
                    label={`Mandal: ${selectedMandal.name}`}
                  />
                )}
              </Box>

              <TextField
                size="small"
                placeholder="Search sevaks by name, id, mobile…"
                value={qSevak}
                onChange={(e) => setQSevak(e.target.value)}
                sx={{ width: 360 }}
              />
            </Box>

            {error && (
              <Box mb={1} color="error.main">
                {error}
              </Box>
            )}

            <TableContainer component={Paper} sx={{ maxHeight: 650 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Sevak Id</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Parivar</TableCell>
                    <TableCell>Pankh</TableCell>
                    <TableCell>Mandal</TableCell>
                    <TableCell>Form Filled</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Mobile</TableCell>
                    {showActions && <TableCell>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(filteredSevaks || []).map((row) => (
                    <TableRow key={row?.id} hover>
                      <TableCell>{row?.sevak_code ?? "-"}</TableCell>
                      <TableCell>{row?.full_name ?? "-"}</TableCell>
                      <TableCell>{row?.parivar_code ?? "-"}</TableCell>
                      {/* 19 sevaks have no pankh; never default it to a guess */}
                      <TableCell>{row?.pankh_label ?? "—"}</TableCell>
                      <TableCell>{row?.mandal_name ?? "-"}</TableCell>
                      <TableCell>{num(row?.filled_forms)}</TableCell>
                      <TableCell>{num(row?.target_forms)}</TableCell>
                      <TableCell>{row?.mobile ?? "-"}</TableCell>
                      {showActions && (
                        <TableCell>
                          <SevakActionsMenu
                            sevak={row}
                            isSelf={row?.sevak_code === me?.sevak_id}
                            mayEdit={mayEdit}
                            mayResetPassword={mayResetPassword}
                            mayDeactivate={mayDeactivate}
                            onEdit={handleEdit}
                            onResetPassword={handleResetPassword}
                            onDeactivate={handleDeactivatePrompt}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}

                  {filteredSevaks?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={showActions ? 9 : 8}
                        align="center"
                        sx={{ py: 4, color: "text.secondary" }}
                      >
                        {loading ? "Loading sevaks…" : "No sevaks found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>

      {/* Deactivation confirmation */}
      <Dialog
        open={openConfirmDialog}
        onClose={() => setOpenConfirmDialog(false)}
      >
        <DialogTitle>Deactivate {itemToDeactivate?.full_name}</DialogTitle>
        <DialogContent>
          <p>
            They will not be able to sign in, and will be removed from the
            mandal list. Seva already recorded is kept.
          </p>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setOpenConfirmDialog(false)}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmDeactivate}
            color="error"
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {showAddAnnkutSevak && addTargetMandal && (
        <AddAnnkutSevakModal
          modal={showAddAnnkutSevak}
          setModal={setShowAddAnnkutSevak}
          mandal={addTargetMandal}
          refreshData={() => fetchSevaks(addTargetMandal.id)}
        />
      )}

      {/* No refresh on close: a reset changes nothing the table shows. */}
      {resetModal && (
        <ResetPasswordModal
          open={resetModal}
          onClose={() => {
            setResetModal(false);
            setSevakToReset(null);
          }}
          sevak={sevakToReset}
        />
      )}

      {editModal && (
        <EditSevakModal
          modal={editModal}
          setModal={setEditModal}
          sevakData={selectedSevakRow}
          refreshData={() => fetchSevaks(selectedMandal?.id)}
        />
      )}

      <ToastContainer
        position="top-center"
        autoClose={5000}
        closeOnClick
        pauseOnHover
        theme="colored"
      />
    </>
  );
}

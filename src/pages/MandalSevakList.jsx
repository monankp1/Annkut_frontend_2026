import React, { useCallback, useEffect, useState } from "react";
import Header from "../components/Header";
import { Table } from "reactstrap";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import ProgressBar from "react-bootstrap/ProgressBar";
import { toast, ToastContainer } from "react-toastify";
import api, { num, errorText } from "../api/annkut";
import {
  getSevak,
  canEditSevak,
  canDeactivateSevak,
  canResetPassword,
} from "../api/session";
import EditSevakModal from "../components/EditSevakModal";
import ResetPasswordModal from "../components/ResetPasswordModal";
import SevakActionsMenu from "../components/SevakActionsMenu";

// One mandal's sevaks, opened with the mandal row in router state:
//
//   navigate("/mandal-sevak-list", { state: { mandal } })
//
// The 2025 version keyed off `mandalDetails.sanchalak`, a field the new API no
// longer returns; a mandal is identified by its id now.
const MandalSevakList = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const mandal = location.state?.mandal || null;
  const mandalId = num(mandal?.id);

  const me = getSevak();
  const mayEdit = canEditSevak(me);
  const mayDeactivate = canDeactivateSevak(me);
  const mayResetPassword = canResetPassword(me);
  const showActions = mayEdit || mayResetPassword || mayDeactivate;

  const [sevaks, setSevaks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editModal, setEditModal] = useState(false);
  const [selectedSevak, setSelectedSevak] = useState(null);

  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [itemToDeactivate, setItemToDeactivate] = useState(null);

  const [resetModal, setResetModal] = useState(false);
  const [sevakToReset, setSevakToReset] = useState(null);

  const fetchSevakList = useCallback(async () => {
    if (!mandalId) return;
    setLoading(true);
    try {
      const res = await api.sevaks({ mandal_id: mandalId });
      setSevaks(Array.isArray(res?.sevak) ? res.sevak : []);
    } catch (error) {
      console.error("Error fetching sevak list:", error);
      toast.error(errorText(error, "Could not load the sevak list."));
    } finally {
      setLoading(false);
    }
  }, [mandalId]);

  useEffect(() => {
    fetchSevakList();
  }, [fetchSevakList]);

  const handleDeactivate = (item) => {
    setItemToDeactivate(item);
    setOpenConfirmDialog(true);
  };

  const handleDeactivateConfirm = async () => {
    const code = itemToDeactivate?.sevak_code;
    if (!code) return;

    try {
      const res = await api.deactivateSevak(code);
      toast.success(res?.message || "Sevak deactivated.");
      await fetchSevakList();
    } catch (error) {
      console.error("Error deactivating sevak:", error);
      toast.error(errorText(error, "Could not deactivate that sevak."));
    } finally {
      setOpenConfirmDialog(false);
      setItemToDeactivate(null);
    }
  };

  const handleEdit = (item) => {
    setSelectedSevak(item);
    setEditModal(true);
  };

  // Reached directly, with nothing to show for.
  if (!mandal) {
    return <Navigate to="/annkut-sevak-list" replace />;
  }

  const target = num(mandal?.target_forms);
  const filled = num(mandal?.filled_forms);
  const progress = target > 0 ? (filled / target) * 100 : 0;

  return (
    <>
      <div>
        <Header />

        <div
          style={{
            display: "flex",
            textAlign: "left",
            fontFamily: "system-ui",
            justifyContent: "space-around",
          }}
        >
          <div style={{ width: "100%", padding: "10px", fontWeight: 600 }}>
            <h6 style={{ fontWeight: 600 }}>
              {mandal?.name} — Achieved Target
            </h6>
            <ProgressBar
              className="custom-progress-bar"
              now={Math.max(0, Math.min(100, Math.round(progress)))}
              label={`${Math.round(progress)}%`}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            textAlign: "left",
            fontFamily: "system-ui",
            margin: "0 12px",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h6>Target : {target}</h6>
            <h6>Filled : {filled}</h6>
          </div>

          <div
            style={{
              textAlign: "end",
              marginRight: "10px",
              marginLeft: "40px",
              fontSize: "xx-large",
              cursor: "pointer",
            }}
            onClick={() => navigate(-1)}
            title="Back"
          >
            <i className="bi bi-arrow-left-square"></i>
          </div>
        </div>

        <div>
          <Table striped bordered responsive>
            <thead>
              <tr>
                <th>Sevak Id</th>
                <th>Name</th>
                <th>Pankh</th>
                <th>Form Filled</th>
                <th>Target</th>
                <th>Mobile</th>
                {showActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sevaks.map((item) => (
                <tr key={item?.id}>
                  <th scope="row">{item?.sevak_code}</th>
                  <td>{item?.full_name}</td>
                  <td>{item?.pankh_label ?? "—"}</td>
                  <td>{num(item?.filled_forms)}</td>
                  <td>{num(item?.target_forms)}</td>
                  <td>{item?.mobile ?? "-"}</td>
                  {showActions && (
                    <td>
                      <SevakActionsMenu
                        sevak={item}
                        isSelf={item?.sevak_code === me?.sevak_id}
                        mayEdit={mayEdit}
                        mayResetPassword={mayResetPassword}
                        mayDeactivate={mayDeactivate}
                        onEdit={handleEdit}
                        onResetPassword={(row) => {
                          setSevakToReset(row);
                          setResetModal(true);
                        }}
                        onDeactivate={handleDeactivate}
                      />
                    </td>
                  )}
                </tr>
              ))}

              {sevaks.length === 0 && (
                <tr>
                  <td
                    colSpan={showActions ? 7 : 6}
                    style={{ textAlign: "center", padding: 24 }}
                  >
                    {loading ? "Loading…" : "No sevaks found"}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

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
            onClick={handleDeactivateConfirm}
            color="error"
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

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
          sevakData={selectedSevak}
          refreshData={fetchSevakList}
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
};

export default MandalSevakList;

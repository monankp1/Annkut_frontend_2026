import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import ListingTable from "../components/ListingTable";
import AddSevaModal from "../components/AddSevaModal";
import api, { num, errorText } from "../api/annkut";
import {
  getSevak,
  setSevak,
  parivarMembers,
  canManageSeva,
} from "../api/session";
import { Button } from "reactstrap";
import { toast, ToastContainer } from "react-toastify";
import { ProgressBar } from "react-bootstrap";
import { Alert, Box, Chip } from "@mui/material";

// The household's screen, not just one person's.
//
// One tab per family member, the signed-in sevak first. The selected tab
// decides both whose entries are listed and who a new seva is credited to, so
// whoever is holding the phone can enter forms for everyone — and each of them
// sees those entries under their own name when they sign in.
const Home = () => {
  const me = getSevak();
  const canManage = canManageSeva(me);

  // Members ride along on the login response, so the tabs need no request.
  const [members, setMembers] = useState(() => parivarMembers(me));
  const [selectedCode, setSelectedCode] = useState(() => {
    const list = parivarMembers(me);
    const self = list.find((m) => m.is_self) || list[0];
    return self?.sevak_code || me?.sevak_id || "";
  });

  const [showAddSeva, setShowAddSeva] = useState(false);
  const [sevaList, setSevaList] = useState([]);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => members.find((m) => m.sevak_code === selectedCode) || null,
    [members, selectedCode]
  );

  // A sant has no parivar and so no tabs — they just see their own entries.
  const onOwnTab = !selected || selected.is_self;

  const fetchSeva = useCallback(async (code) => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await api.sevaFor(code);
      setSevaList(Array.isArray(res?.seva) ? res.seva : []);
    } catch (error) {
      console.error("Error fetching seva:", error);
      setSevaList([]);
      toast.error(errorText(error, "Could not load the seva list."));
    } finally {
      setLoading(false);
    }
  }, []);

  /** Pulls fresh per-member counters and keeps the stored profile in step. */
  const refreshFamily = useCallback(async () => {
    try {
      const res = await api.family();
      const rows = Array.isArray(res?.members) ? res.members : [];
      if (!rows.length) return;

      setMembers(rows);

      const stored = getSevak();
      if (stored?.parivar) {
        setSevak({
          ...stored,
          parivar: { ...stored.parivar, members: rows },
        });
      }
    } catch (error) {
      console.error("Error refreshing family:", error);
    }
  }, []);

  useEffect(() => {
    fetchSeva(selectedCode);
  }, [fetchSeva, selectedCode]);

  useEffect(() => {
    refreshFamily();
  }, [refreshFamily]);

  const handleDelete = async (id) => {
    try {
      const res = await api.deleteSeva(id);
      toast.success(res?.message || "Seva entry voided.");
      await Promise.all([fetchSeva(selectedCode), refreshFamily()]);
    } catch (error) {
      toast.error(errorText(error, "Unable to void that entry."));
    }
  };

  const handleAdded = async () => {
    await Promise.all([fetchSeva(selectedCode), refreshFamily()]);
  };

  const target = num(selected?.target_forms);
  const filled = selected ? num(selected.filled_forms) : sevaList.length;
  const progress = target > 0 ? (filled / target) * 100 : 0;
  const progressClamped = Math.max(0, Math.min(100, Math.round(progress)));

  return (
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
          <h6 style={{ fontWeight: 600 }}>Achieved Target</h6>
          <ProgressBar
            now={progressClamped}
            label={`${progressClamped}%`}
            className="custom-progress-bar"
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
          <h6>Filled form : {filled}</h6>
        </div>
      </div>

      {/* Family tabs — one per member, however many the family has. */}
      {members.length > 1 && (
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            m: "12px",
          }}
        >
          {members.map((m) => {
            const active = m.sevak_code === selectedCode;
            return (
              <Button
                key={m.sevak_code}
                color={active ? "primary" : "secondary"}
                outline={!active}
                onClick={() => setSelectedCode(m.sevak_code)}
                style={{
                  textAlign: "left",
                  lineHeight: 1.25,
                  padding: "10px 14px",
                  minWidth: 150,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {m.first_name || m.full_name}
                  {m.is_self ? " (You)" : ""}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {m.sevak_code} · {num(m.filled_forms)}/{num(m.target_forms)}
                </div>
              </Button>
            );
          })}
        </Box>
      )}

      {target === 0 && (
        <div style={{ margin: "8px 12px" }}>
          <Alert severity="info">
            {onOwnTab
              ? "તમારું અન્નકુટ ફોર્મ લક્ષ્ય હજુ સેટ થયું નથી. તમે સેવા ઉમેરી શકો છો — લક્ષ્ય માટે તમારા સંચાલકનો સંપર્ક કરો."
              : `${selected?.full_name} નું લક્ષ્ય હજુ સેટ થયું નથી.`}
          </Alert>
        </div>
      )}

      <div style={{ margin: "0 12px" }}>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1}>
          <Button color="primary" outline onClick={() => setShowAddSeva(true)}>
            Add Seva
          </Button>

          {/* Adding while another member's tab is open credits it to them, so
              say whose name it will go under. */}
          {!onOwnTab && selected && (
            <Chip
              size="small"
              color="warning"
              label={`Adding for ${selected.full_name}`}
            />
          )}
        </Box>

        <ListingTable
          data={sevaList}
          loading={loading}
          canManage={canManage}
          handleDelete={handleDelete}
          refreshData={handleAdded}
        />
      </div>

      {showAddSeva && (
        <AddSevaModal
          modal={showAddSeva}
          setModal={setShowAddSeva}
          onBehalfOf={selected}
          onAdded={handleAdded}
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
};

export default Home;

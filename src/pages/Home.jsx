import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import SevaList from "../components/SevaList";
import AddSevaModal from "../components/AddSevaModal";
import api, { num, errorText } from "../api/annkut";
import {
  getSevak,
  setSevak,
  parivarMembers,
  canManageSeva,
} from "../api/session";
import { toast, ToastContainer } from "react-toastify";

// The household's screen, not just one person's.
//
// One tab per family member, the signed-in sevak first. The selected tab
// decides both whose entries are listed and who a new seva is credited to, so
// whoever is holding the phone can enter forms for everyone — and each of them
// sees those entries under their own name when they sign in.
//
// Order on screen follows that: member tabs, then that member's progress,
// then their entries, with Add seva pinned to the bottom.
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
  const [loadError, setLoadError] = useState("");

  const selected = useMemo(
    () => members.find((m) => m.sevak_code === selectedCode) || null,
    [members, selectedCode]
  );

  // A sant has no parivar and so no tabs — they just see their own entries.
  const onOwnTab = !selected || selected.is_self;
  const selectedName = selected?.first_name || selected?.full_name || "";

  const fetchSeva = useCallback(async (code) => {
    if (!code) return;
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.sevaFor(code);
      setSevaList(Array.isArray(res?.seva) ? res.seva : []);
    } catch (error) {
      console.error("Error fetching seva:", error);
      setSevaList([]);
      // Shown in place of the list with a Retry button, not as a toast that
      // is gone while the list stays blank.
      setLoadError(errorText(error, "Could not load the seva list."));
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
  const remaining = Math.max(0, target - filled);
  const achieved = target > 0 && filled >= target;

  // Summed from the entries already on screen; no extra request.
  const collected = useMemo(
    () => sevaList.reduce((sum, s) => sum + num(s?.seva_amount), 0),
    [sevaList]
  );
  const currency = useMemo(() => new Intl.NumberFormat("en-IN"), []);

  return (
    <div className="home-page">
      <Header />

      {/* Family tabs — one per member, however many the family has. */}
      {members.length > 1 && (
        <div className="member-tabs" role="tablist" aria-label="Family members">
          {members.map((m) => {
            const active = m.sevak_code === selectedCode;
            const name = m.first_name || m.full_name || m.sevak_code;
            return (
              <button
                key={m.sevak_code}
                type="button"
                role="tab"
                aria-selected={active}
                className={`member-pill${active ? " is-active" : ""}`}
                onClick={() => setSelectedCode(m.sevak_code)}
              >
                <span className="member-avatar" aria-hidden="true">
                  {name.trim().charAt(0)}
                </span>
                <span className="member-pill-text">
                  <span className="member-pill-name">
                    {name}
                    {m.is_self ? " · You" : ""}
                  </span>
                  <span className="member-pill-count">
                    {num(m.filled_forms)}/{num(m.target_forms)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <main className="home-body">
        <section
          className={`progress-card${achieved ? " is-achieved" : ""}`}
          aria-label="Progress"
        >
          {target > 0 ? (
            <>
              <div className="progress-card-head">
                <span className="progress-card-count">
                  <strong>{filled}</strong> of {target} forms
                </span>
                <span className="progress-card-pct">{progressClamped}%</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressClamped}
                aria-label="Target achieved"
              >
                <div
                  className="progress-fill"
                  style={{ width: `${progressClamped}%` }}
                />
              </div>
              <div className="progress-card-foot">
                {achieved ? "Target achieved 🎉" : `${remaining} to go`}
                {collected > 0 && ` · ₹${currency.format(collected)} collected`}
              </div>
            </>
          ) : (
            <>
              <div className="progress-card-head">
                <span className="progress-card-count">
                  <strong>{filled}</strong> {filled === 1 ? "form" : "forms"}{" "}
                  filled
                </span>
              </div>
              {collected > 0 && (
                <div className="progress-card-foot">
                  ₹{currency.format(collected)} collected
                </div>
              )}
              <div className="notice-box mt-3 mb-0">
                <i className="bi bi-info-circle-fill" aria-hidden="true" />
                <span>
                  {onOwnTab
                    ? "તમારું અન્નકુટ ફોર્મ લક્ષ્ય હજુ સેટ થયું નથી. તમે સેવા ઉમેરી શકો છો — લક્ષ્ય માટે તમારા સંચાલકનો સંપર્ક કરો."
                    : `${selected?.full_name} નું લક્ષ્ય હજુ સેટ થયું નથી.`}
                </span>
              </div>
            </>
          )}
        </section>

        <h2 className="section-title">
          Seva entries
          {!loading && !loadError && ` (${sevaList.length})`}
        </h2>

        <SevaList
          data={sevaList}
          loading={loading}
          error={loadError}
          onRetry={() => fetchSeva(selectedCode)}
          emptyText={
            onOwnTab
              ? "No seva entries yet"
              : `No seva entries for ${selectedName} yet`
          }
          canManage={canManage}
          handleDelete={handleDelete}
          refreshData={handleAdded}
        />
      </main>

      {/* Pinned so the main action is always in thumb reach. Adding while
          another member's tab is open credits it to them, so the label says
          whose name it will go under. */}
      <div className="bottom-action">
        <button
          type="button"
          className="brand-btn"
          onClick={() => setShowAddSeva(true)}
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
          <span>
            {onOwnTab ? "Add seva" : `Add seva for ${selectedName}`}
          </span>
        </button>
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

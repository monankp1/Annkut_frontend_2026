import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api, { num, errorText } from "../api/annkut";
import { cleanPhone, isCompletePhone, PHONE_ERROR } from "../utils/phone";
import { FieldHint, FormError } from "./AuthFields";
import SevaSheet from "./seva-form/SevaSheet";
import {
  Field,
  SaveButton,
  advanceOnEnter,
  focusFirstError,
} from "./seva-form/SevaFields";
import {
  NameAndMobileFields,
  PankhPicker,
  SEVAK_FIELD_ORDER,
  TargetStepper,
} from "./sevak-form/SevakFields";
import SignInCard from "./sevak-form/SignInCard";

// A Parivar is a family and a Sevak is one person in it, so adding someone
// means saying which family they join — one of the mandal's existing ones, or
// a new one the server allocates.
//
// Adding a sevak also creates their login, and the 201 carries the details.
// The person doing the adding is usually sitting next to the person being
// added, so the sheet ends on a card they can read out rather than a toast
// that slides away mid-sentence — and only Done closes it.

const EMPTY = {
  parivar_mode: "existing",
  parivar_code: "",
  sevak_code: "",
  surname: "",
  first_name: "",
  middle_name: "",
  mobile: "",
  pankh: "S",
  target_forms: "0",
};

function AddAnnkutSevakModal({ modal, setModal, mandal, refreshData }) {
  const [loader, setLoader] = useState(false);
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  // Set once the sevak is created; swaps the form for the sign-in details.
  const [result, setResult] = useState(null);

  const [parivars, setParivars] = useState([]);
  const [nextParivarCode, setNextParivarCode] = useState("");
  const [parivarsLoading, setParivarsLoading] = useState(true);
  const [parivarsError, setParivarsError] = useState("");
  const [parivarQuery, setParivarQuery] = useState("");

  const close = () => setModal(false);

  const request = useRef(0);

  // The families already in this mandal, plus a preview of the code a new one
  // would get.
  const loadParivars = useCallback(async () => {
    if (!mandal?.id) return;
    const id = ++request.current;
    setParivarsLoading(true);
    setParivarsError("");
    try {
      const res = await api.parivars(mandal.id);
      if (id !== request.current) return;
      const rows = Array.isArray(res?.parivar) ? res.parivar : [];
      setParivars(rows);
      setNextParivarCode(res?.next_parivar_code || "");
      // A mandal with no families yet can only start one.
      if (rows.length === 0) {
        setFormData((p) => ({ ...p, parivar_mode: "new" }));
      }
    } catch (e) {
      if (id !== request.current) return;
      setParivars([]);
      setParivarsError(errorText(e, "Unable to load families."));
    } finally {
      if (id === request.current) setParivarsLoading(false);
    }
  }, [mandal?.id]);

  useEffect(() => {
    if (!modal) return undefined;
    setResult(null);
    setFormData(EMPTY);
    setErrors({});
    setServerError("");
    setParivarQuery("");
    loadParivars();
    return () => {
      request.current += 1;
    };
  }, [modal, loadParivars]);

  const visibleParivars = useMemo(() => {
    const needle = parivarQuery.trim().toLowerCase();
    if (!needle) return parivars;
    return parivars.filter((p) =>
      String(p?.code ?? "")
        .toLowerCase()
        .includes(needle),
    );
  }, [parivars, parivarQuery]);

  const clearError = (name) => {
    setErrors((p) => {
      if (!p[name]) return p;
      const { [name]: _gone, ...rest } = p;
      return rest;
    });
    if (serverError) setServerError("");
  };

  const setField = (name, value) => {
    setFormData((p) => ({ ...p, [name]: value }));
    clearError(name);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "mobile") return setField("mobile", cleanPhone(value));
    if (name === "sevak_code") return setField(name, value.toUpperCase());
    setField(name, value);
  };

  const validate = () => {
    const errs = {};
    if (formData.parivar_mode === "existing" && !formData.parivar_code) {
      errs.parivar_code = "Pick the family this sevak belongs to.";
    }
    if (!formData.sevak_code.trim()) errs.sevak_code = "Sevak ID is required.";
    if (!formData.first_name.trim())
      errs.first_name = "First name is required.";
    if (formData.mobile && !isCompletePhone(formData.mobile)) {
      errs.mobile = PHONE_ERROR;
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mandal?.id) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstError(found, SEVAK_FIELD_ORDER);
      return;
    }

    setLoader(true);
    setServerError("");

    const payload = {
      mandal_id: mandal.id,
      sevak_code: formData.sevak_code.trim(),
      surname: formData.surname.trim(),
      first_name: formData.first_name.trim(),
      middle_name: formData.middle_name.trim(),
      mobile: formData.mobile,
      pankh: formData.pankh,
      target_forms: Number(formData.target_forms || 0),
    };

    try {
      const res =
        formData.parivar_mode === "new"
          ? await api.addSevakInNewParivar(payload)
          : await api.addSevak({
              ...payload,
              parivar_code: formData.parivar_code,
            });

      // Hold the sheet open on the sign-in card: under load the allocated
      // parivar code can differ from the preview, so it needs reading too.
      setResult(res);
      if (typeof refreshData === "function") refreshData();
    } catch (error) {
      // 409 when that sevak code is already taken.
      setServerError(errorText(error, "Failed to add sevak."));
    } finally {
      setLoader(false);
    }
  };

  const addAnother = () => {
    setResult(null);
    setFormData(EMPTY);
    setErrors({});
    setParivarQuery("");
    // The family list just gained a member (or a whole family).
    loadParivars();
  };

  const dirty = Boolean(
    formData.parivar_code ||
    formData.sevak_code ||
    formData.surname ||
    formData.first_name ||
    formData.middle_name ||
    formData.mobile,
  );

  const isNew = formData.parivar_mode === "new";
  const noFamiliesYet =
    !parivarsLoading && !parivarsError && parivars.length === 0;

  // One sheet throughout: the form turns into the sign-in card in place.
  return (
    <SevaSheet
      open={modal}
      title={result ? "Sevak added" : "Add sevak"}
      locked={Boolean(result)}
      dirty={!result && dirty}
      busy={loader}
      discardTitle="Discard this sevak?"
      onClose={close}
      footer={
        result ? (
          <div className="sheet-footer-row">
            <button type="button" className="outline-btn" onClick={addAnother}>
              <i className="bi bi-person-plus" aria-hidden="true" /> Add another
            </button>
            <button type="button" className="brand-btn" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <>
            <FormError>{serverError}</FormError>
            <SaveButton busy={loader} form="sevak-form">
              Add sevak
            </SaveButton>
          </>
        )
      }
    >
      {result ? (
        result.login ? (
          <SignInCard
            title={`${result.sevak_code} added to parivar ${result.parivar_code}`}
            sevakId={result.login.sevak_id}
            password={result.login.default_password}
            note={
              result.login.must_change_password
                ? "They'll choose their own password on first sign-in."
                : null
            }
          />
        ) : (
          <div className="signin-card">
            <div className="signin-title">
              <i className="bi bi-check-circle-fill" aria-hidden="true" />
              <span>
                {result.sevak_code} added to parivar {result.parivar_code}
              </span>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="receipt-info mt-0 mb-3">
            <i className="bi bi-geo-alt" aria-hidden="true" />
            <span>
              Mandal <strong>{mandal?.name || "—"}</strong>
            </span>
          </div>

          <form
            id="sevak-form"
            className="auth-form"
            onSubmit={handleSubmit}
            onKeyDown={advanceOnEnter}
            noValidate
          >
            <div className="auth-field">
              <span className="field-label" id="parivar_label">
                Parivar
              </span>
              <div
                className="choice-row"
                role="radiogroup"
                aria-labelledby="parivar_label"
              >
                {[
                  { mode: "existing", label: "Existing" },
                  { mode: "new", label: "New parivar" },
                ].map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    role="radio"
                    aria-checked={formData.parivar_mode === o.mode}
                    className={`choice-btn${
                      formData.parivar_mode === o.mode ? " is-active" : ""
                    }`}
                    onClick={() => setField("parivar_mode", o.mode)}
                    disabled={o.mode === "existing" && noFamiliesYet}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {isNew ? (
                // The code shown is only a preview — the server allocates the
                // real one when this saves.
                <FieldHint>
                  A new family will be started for this sevak
                  {nextParivarCode ? ` (likely ${nextParivarCode})` : ""}.
                </FieldHint>
              ) : parivarsLoading && parivars.length === 0 ? (
                <div aria-busy="true" aria-label="Loading families">
                  <span className="skeleton-line skeleton-input mt-2" />
                  <span className="skeleton-line skeleton-input mt-2" />
                </div>
              ) : parivarsError ? (
                <div className="list-state mt-2" role="alert">
                  <p className="list-state-title">Couldn't load families</p>
                  <p className="list-state-text">{parivarsError}</p>
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={loadParivars}
                  >
                    <i className="bi bi-arrow-clockwise" aria-hidden="true" />{" "}
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="search-field mt-2">
                    <i className="bi bi-search" aria-hidden="true" />
                    <input
                      type="search"
                      value={parivarQuery}
                      onChange={(e) => setParivarQuery(e.target.value)}
                      placeholder="Search parivar code"
                      aria-label="Search parivar code"
                      autoComplete="off"
                      enterKeyHint="search"
                    />
                  </div>
                  <div
                    id="parivar_code"
                    tabIndex={-1}
                    className={`pick-list${
                      errors.parivar_code ? " is-invalid" : ""
                    }`}
                    role="radiogroup"
                    aria-label="Parivar"
                  >
                    {visibleParivars.length === 0 ? (
                      <p className="pick-empty">No parivar matches.</p>
                    ) : (
                      visibleParivars.map((p) => {
                        const active = formData.parivar_code === p.code;
                        const members = num(p.members);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`pick-item${active ? " is-active" : ""}`}
                            onClick={() => setField("parivar_code", p.code)}
                          >
                            <span>
                              <strong>{p.code}</strong> · {members} member
                              {members === 1 ? "" : "s"}
                            </span>
                            {active && (
                              <i
                                className="bi bi-check-lg"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {errors.parivar_code && (
                    <FieldHint status="error">{errors.parivar_code}</FieldHint>
                  )}
                </>
              )}
            </div>

            <Field
              id="sevak_code"
              label="Sevak ID"
              placeholder="e.g. ASNK003"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={formData.sevak_code}
              onChange={handleChange}
              error={errors.sevak_code}
              hint="Unique across the whole organisation."
            />

            <NameAndMobileFields
              form={formData}
              errors={errors}
              onChange={handleChange}
            />

            <PankhPicker
              value={formData.pankh}
              onChange={(code) => setField("pankh", code)}
            />

            <TargetStepper
              value={formData.target_forms}
              onChange={(v) => setField("target_forms", v)}
              error={errors.target_forms}
            />
          </form>
        </>
      )}
    </SevaSheet>
  );
}

export default AddAnnkutSevakModal;

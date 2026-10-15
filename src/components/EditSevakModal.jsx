// src/components/EditSevakModal.jsx
//
// Shares its fields and sheet with AddAnnkutSevakModal. Success is toasted
// through the host page's container.
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { num, errorText } from "../api/annkut";
import { cleanPhone, isCompletePhone, PHONE_ERROR } from "../utils/phone";
import { FormError } from "./AuthFields";
import SevaSheet from "./seva-form/SevaSheet";
import {
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

const asStr = (v) => (v === undefined || v === null ? "" : String(v));

const fromRow = (s) => ({
  surname: asStr(s?.surname),
  first_name: asStr(s?.first_name),
  middle_name: asStr(s?.middle_name),
  mobile: asStr(s?.mobile),
  // 19 sevaks legitimately have no pankh; "" keeps it unset.
  pankh: asStr(s?.pankh),
  target_forms: asStr(num(s?.target_forms)),
});

export default function EditSevakModal({
  modal,
  setModal,
  sevakData = {},
  refreshData,
}) {
  const [formData, setFormData] = useState(() => fromRow(sevakData));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormData(fromRow(sevakData));
    setErrors({});
    setServerError("");
  }, [sevakData]);

  const close = () => setModal(false);

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
    setField(name, name === "mobile" ? cleanPhone(value) : value);
  };

  const validate = () => {
    const next = {};
    if (!formData.first_name.trim())
      next.first_name = "First name is required.";
    if (formData.mobile && !isCompletePhone(formData.mobile)) {
      next.mobile = PHONE_ERROR;
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Checked on Save, not while typing, and Save is never greyed out: a
    // problem in a field scrolled out of view would otherwise be a mystery.
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstError(found, SEVAK_FIELD_ORDER);
      return;
    }

    setSubmitting(true);
    setServerError("");

    try {
      // target_forms goes along with the rest: edit_sevak forwards it to
      // set_target, which also moves the mandal target by the same delta.
      const res = await api.editSevak(sevakData.sevak_code, {
        surname: formData.surname.trim(),
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim(),
        mobile: formData.mobile,
        pankh: formData.pankh || null,
        target_forms: Number(formData.target_forms || 0),
      });

      toast.success(res?.message || "Sevak updated successfully.");
      close();
      if (typeof refreshData === "function") await refreshData();
    } catch (error) {
      console.error("Error editing sevak:", error);
      setServerError(errorText(error, "Could not update that sevak."));
    } finally {
      setSubmitting(false);
    }
  };

  const dirty = JSON.stringify(formData) !== JSON.stringify(fromRow(sevakData));

  const about = [
    sevakData?.sevak_code,
    sevakData?.mandal_name,
    sevakData?.parivar_code ? `Parivar ${sevakData.parivar_code}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SevaSheet
      open={modal}
      title="Edit sevak"
      dirty={dirty}
      busy={submitting}
      discardTitle="Discard changes?"
      discardText="Your changes to this sevak will be lost."
      onClose={close}
      footer={
        <>
          <FormError>{serverError}</FormError>
          <SaveButton busy={submitting} form="sevak-form">
            Save changes
          </SaveButton>
        </>
      }
    >
      <div className="receipt-info mt-0 mb-3">
        <i className="bi bi-person" aria-hidden="true" />
        <span>{about || "—"}</span>
      </div>

      <form
        id="sevak-form"
        className="auth-form"
        onSubmit={handleSubmit}
        onKeyDown={advanceOnEnter}
        noValidate
      >
        <NameAndMobileFields
          form={formData}
          errors={errors}
          onChange={handleChange}
        />

        <PankhPicker
          value={formData.pankh}
          onChange={(code) => setField("pankh", code)}
          allowNone
        />

        <TargetStepper
          value={formData.target_forms}
          onChange={(v) => setField("target_forms", v)}
          error={errors.target_forms}
        />
      </form>
    </SevaSheet>
  );
}

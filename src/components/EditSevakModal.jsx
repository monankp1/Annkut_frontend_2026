// src/components/EditSevakModal.jsx
import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import { toast } from "react-toastify";
import api, { num, errorText } from "../api/annkut";
import {
  cleanPhone,
  isCompletePhone,
  phoneInputProps,
  PHONE_ERROR,
} from "../utils/phone";
import { PANKH_OPTIONS } from "./AddAnnkutSevakModal";

const asStr = (v) => (v === undefined || v === null ? "" : String(v));

// The name is stored in three parts and the full_name column is rebuilt from
// them server-side, so it is edited as three fields rather than one.
export default function EditSevakModal({
  modal,
  setModal,
  sevakData = {},
  refreshData,
}) {
  const [formData, setFormData] = useState({
    surname: "",
    first_name: "",
    middle_name: "",
    mobile: "",
    pankh: "",
    target_forms: "0",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormData({
      surname: asStr(sevakData.surname),
      first_name: asStr(sevakData.first_name),
      middle_name: asStr(sevakData.middle_name),
      mobile: asStr(sevakData.mobile),
      // 19 sevaks legitimately have no pankh; "" keeps it unset.
      pankh: asStr(sevakData.pankh),
      target_forms: asStr(num(sevakData.target_forms)),
    });
    setErrors({});
  }, [sevakData]);

  const toggle = () => setModal(!modal);

  const validate = (data) => {
    const next = {};
    if (!data.first_name.trim()) next.first_name = "First name is required.";
    if (data.mobile && !isCompletePhone(data.mobile)) {
      next.mobile = PHONE_ERROR;
    }
    if (!/^\d*$/.test(data.target_forms)) {
      next.target_forms = "Digits only.";
    }
    return next;
  };

  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === "mobile") value = cleanPhone(value);
    if (name === "target_forms") value = asStr(value).replace(/\D/g, "");

    const next = { ...formData, [name]: value };
    setFormData(next);
    setErrors(validate(next));
  };

  const handleSubmit = async () => {
    const found = validate(formData);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSubmitting(true);

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
      toggle();
      if (typeof refreshData === "function") await refreshData();
    } catch (error) {
      console.error("Error editing sevak:", error);
      toast.error(errorText(error, "Could not update that sevak."));
    } finally {
      setSubmitting(false);
    }
  };

  const invalid = Object.keys(errors).length > 0;

  return (
    <Dialog open={modal} onClose={toggle} fullWidth maxWidth="sm">
      <DialogTitle>Edit Sevak Details</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {sevakData?.sevak_code}
          {sevakData?.mandal_name ? ` · ${sevakData.mandal_name}` : ""}
          {sevakData?.parivar_code ? ` · Parivar ${sevakData.parivar_code}` : ""}
        </Typography>

        <TextField
          fullWidth
          margin="normal"
          label="Surname"
          name="surname"
          value={formData.surname}
          onChange={handleChange}
        />

        <TextField
          fullWidth
          margin="normal"
          label="First Name"
          name="first_name"
          value={formData.first_name}
          onChange={handleChange}
          error={Boolean(errors.first_name)}
          helperText={errors.first_name || ""}
        />

        <TextField
          fullWidth
          margin="normal"
          label="Father's / Husband's Name"
          name="middle_name"
          value={formData.middle_name}
          onChange={handleChange}
        />

        <TextField
          fullWidth
          margin="normal"
          label="Mobile"
          name="mobile"
          type="text"
          value={formData.mobile}
          onChange={handleChange}
          error={Boolean(errors.mobile)}
          helperText={errors.mobile || "10 digits"}
          inputProps={phoneInputProps}
        />

        <FormControl fullWidth margin="normal" size="small">
          <InputLabel id="edit-pankh-label">Pankh</InputLabel>
          <Select
            labelId="edit-pankh-label"
            label="Pankh"
            name="pankh"
            value={formData.pankh}
            onChange={handleChange}
          >
            <MenuItem value="">
              <em>Not set</em>
            </MenuItem>
            {PANKH_OPTIONS.map((p) => (
              <MenuItem key={p.code} value={p.code}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          margin="normal"
          label="Target"
          name="target_forms"
          type="text"
          inputMode="numeric"
          value={formData.target_forms}
          onChange={handleChange}
          error={Boolean(errors.target_forms)}
          helperText={
            errors.target_forms ||
            "Also moves the mandal target by the same amount."
          }
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleSubmit}
          disabled={invalid || submitting}
        >
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={toggle}
          disabled={submitting}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

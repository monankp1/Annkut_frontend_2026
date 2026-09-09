import React, { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import api, { errorText } from "../api/annkut";
import { toast, ToastContainer } from "react-toastify";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

// A Parivar is a family and a Sevak is one person in it. Several sevaks share
// one parivar code, so the code is asked for rather than generated: entering an
// existing one adds this person to that family, a new one starts a family.
export const PANKH_OPTIONS = [
  { code: "S", label: "Satsangi" },
  { code: "M", label: "Mahila" },
  { code: "YK", label: "Yuvak" },
  { code: "YT", label: "Yuvati" },
  { code: "BL", label: "Bal" },
  { code: "BK", label: "Balika" },
];

const EMPTY = {
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

  const toggle = () => setModal(!modal);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "mobile") {
      if (!/^\d{0,10}$/.test(value)) return;
    }

    if (name === "target_forms" && !/^\d*$/.test(value)) return;

    const upper = ["parivar_code", "sevak_code"].includes(name);

    setFormData((p) => ({ ...p, [name]: upper ? value.toUpperCase() : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!mandal?.id) {
      toast.error("Pick a mandal first.");
      return;
    }

    if (
      !formData.parivar_code.trim() ||
      !formData.sevak_code.trim() ||
      !formData.first_name.trim()
    ) {
      toast.error("Parivar ID, Sevak ID and first name are required.");
      return;
    }

    if (formData.mobile && formData.mobile.length !== 10) {
      toast.error("Mobile must be 10 digits.");
      return;
    }

    setLoader(true);

    try {
      const res = await api.addSevak({
        mandal_id: mandal.id,
        parivar_code: formData.parivar_code.trim(),
        sevak_code: formData.sevak_code.trim(),
        surname: formData.surname.trim(),
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim(),
        mobile: formData.mobile,
        pankh: formData.pankh,
        target_forms: Number(formData.target_forms || 0),
      });

      toast.success(res?.message || "Sevak added successfully.");
      setFormData(EMPTY);
      if (typeof refreshData === "function") refreshData();
      toggle();
    } catch (error) {
      // 409 when that sevak code is already taken.
      toast.error(errorText(error, "Failed to add sevak."));
    } finally {
      setLoader(false);
    }
  };

  return (
    <div>
      <Modal isOpen={modal} toggle={toggle}>
        <ModalHeader toggle={toggle}>Add Annkut Sevak</ModalHeader>
        <ModalBody>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Mandal: <strong>{mandal?.name || "-"}</strong>
          </Typography>

          <TextField
            label="Parivar ID"
            name="parivar_code"
            placeholder="e.g. NK001"
            value={formData.parivar_code}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            required
            color="secondary"
            helperText="A family code. Reuse an existing one to add to that family."
          />

          <TextField
            label="Sevak ID"
            name="sevak_code"
            placeholder="e.g. ASNK003"
            value={formData.sevak_code}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            required
            color="secondary"
            helperText="Unique across the whole organisation."
          />

          <TextField
            label="Surname"
            name="surname"
            value={formData.surname}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            color="secondary"
          />

          <TextField
            label="First Name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            required
            color="secondary"
          />

          <TextField
            label="Father's / Husband's Name"
            name="middle_name"
            value={formData.middle_name}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            color="secondary"
          />

          <TextField
            label="Mobile"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            color="secondary"
            inputProps={{ maxLength: 10, inputMode: "numeric" }}
          />

          <FormControl fullWidth margin="normal" size="small">
            <InputLabel id="pankh-label">Pankh</InputLabel>
            <Select
              labelId="pankh-label"
              label="Pankh"
              name="pankh"
              value={formData.pankh}
              onChange={handleChange}
            >
              {PANKH_OPTIONS.map((p) => (
                <MenuItem key={p.code} value={p.code}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Target"
            name="target_forms"
            value={formData.target_forms}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            color="secondary"
            inputProps={{ inputMode: "numeric" }}
            helperText="Also moves the mandal target by the same amount."
          />
        </ModalBody>

        <ModalFooter>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSubmit}
            disabled={loader}
          >
            {loader ? "Submitting..." : "Submit"}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={toggle}
            style={{ marginLeft: "10px" }}
            disabled={loader}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <ToastContainer position="top-center" autoClose={5000} theme="colored" />
    </div>
  );
}

export default AddAnnkutSevakModal;

import React, { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import api, { num, errorText } from "../api/annkut";
import {
  cleanPhone,
  isCompletePhone,
  isPartialPhone,
  phoneInputProps,
  PHONE_ERROR,
} from "../utils/phone";
import { toast, ToastContainer } from "react-toastify";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  Alert,
  Box,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

// A Parivar is a family and a Sevak is one person in it, so adding someone
// means saying which family they join — picked from the mandal's existing
// ones, or a new one the server allocates.
//
// Adding a sevak also creates their login, and the 201 carries the details.
// The person doing the adding is usually sitting next to the person being
// added, so the modal ends on a panel they can read out rather than a toast
// that slides away mid-sentence.
export const PANKH_OPTIONS = [
  { code: "S", label: "Sanyukt" },
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

// Sentinel for the last option in the parivar dropdown. Never sent as a code —
// it switches the request to new_parivar instead.
const NEW_PARIVAR = "__new__";

function AddAnnkutSevakModal({ modal, setModal, mandal, refreshData }) {
  const [loader, setLoader] = useState(false);
  const [formData, setFormData] = useState(EMPTY);

  // Set once the sevak is created; swaps the body for the sign-in details.
  const [result, setResult] = useState(null);

  const [parivars, setParivars] = useState([]);
  const [nextParivarCode, setNextParivarCode] = useState("");
  const [parivarsLoading, setParivarsLoading] = useState(false);
  const [parivarsError, setParivarsError] = useState("");

  const toggle = () => setModal(!modal);

  // The families already in this mandal, plus a preview of the code a new one
  // would get.
  useEffect(() => {
    if (!modal || !mandal?.id) return undefined;

    let ignore = false;
    setResult(null);
    setFormData(EMPTY);

    (async () => {
      try {
        setParivarsLoading(true);
        setParivarsError("");
        const res = await api.parivars(mandal.id);
        if (ignore) return;
        setParivars(Array.isArray(res?.parivar) ? res.parivar : []);
        setNextParivarCode(res?.next_parivar_code || "");
      } catch (e) {
        if (!ignore) {
          setParivars([]);
          setParivarsError(errorText(e, "Unable to load families."));
        }
      } finally {
        if (!ignore) setParivarsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [modal, mandal?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "mobile") {
      setFormData((p) => ({ ...p, mobile: cleanPhone(value) }));
      return;
    }

    if (name === "target_forms" && !/^\d*$/.test(value)) return;

    const upper = name === "sevak_code";

    setFormData((p) => ({ ...p, [name]: upper ? value.toUpperCase() : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!mandal?.id) {
      toast.error("Pick a mandal first.");
      return;
    }

    if (
      !formData.parivar_code ||
      !formData.sevak_code.trim() ||
      !formData.first_name.trim()
    ) {
      toast.error("Parivar, Sevak ID and first name are required.");
      return;
    }

    if (formData.mobile && !isCompletePhone(formData.mobile)) {
      toast.error(PHONE_ERROR);
      return;
    }

    setLoader(true);

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
      const startingNewFamily = formData.parivar_code === NEW_PARIVAR;

      const res = startingNewFamily
        ? await api.addSevakInNewParivar(payload)
        : await api.addSevak({ ...payload, parivar_code: formData.parivar_code });

      // Hold the modal open on a success panel: it carries the sign-in
      // details, and under load the allocated parivar code can differ from
      // the preview, so both need reading rather than flashing past.
      setResult(res);
      if (typeof refreshData === "function") refreshData();
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
        <ModalHeader toggle={toggle}>
          {result ? "Sevak added" : "Add Annkut Sevak"}
        </ModalHeader>

        {result ? (
          <ModalBody>
            <Alert severity="success" sx={{ mb: 2 }}>
              <strong>{result.sevak_code}</strong> added to parivar{" "}
              <strong>{result.parivar_code}</strong>.
            </Alert>

            {/* The whole point of holding the modal open: the details to read
                out to the person standing there. */}
            {result.login && (
              <Box
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "action.hover",
                }}
              >
                <Typography variant="body2" sx={{ mb: 1 }}>
                  They can sign in now:
                </Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 16 }}>
                  Sevak ID: <strong>{result.login.sevak_id}</strong>
                </Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 16 }}>
                  Password: <strong>{result.login.default_password}</strong>
                </Typography>
                {result.login.must_change_password && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    They will be asked to choose a new password on first
                    sign-in.
                  </Typography>
                )}
              </Box>
            )}
          </ModalBody>
        ) : (
        <ModalBody>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Mandal: <strong>{mandal?.name || "-"}</strong>
          </Typography>

          <FormControl fullWidth margin="normal" size="small">
            <InputLabel id="parivar-label">Parivar</InputLabel>
            <Select
              labelId="parivar-label"
              label="Parivar"
              name="parivar_code"
              value={formData.parivar_code}
              onChange={handleChange}
            >
              {parivarsLoading && <MenuItem disabled>Loading…</MenuItem>}
              {parivarsError && <MenuItem disabled>{parivarsError}</MenuItem>}

              {parivars.map((p) => (
                <MenuItem key={p.id} value={p.code}>
                  {p.code} ({num(p.members)} member
                  {num(p.members) === 1 ? "" : "s"})
                </MenuItem>
              ))}

              {parivars.length > 0 && <Divider />}

              {/* The code shown here is only a preview — the server allocates
                  the real one when this saves. */}
              <MenuItem value={NEW_PARIVAR}>
                + New parivar{nextParivarCode ? ` (${nextParivarCode})` : ""}
              </MenuItem>
            </Select>
            <FormHelperText>
              {formData.parivar_code === NEW_PARIVAR
                ? "A new family will be started for this sevak."
                : "Pick the family this sevak belongs to."}
            </FormHelperText>
          </FormControl>

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
            error={isPartialPhone(formData.mobile)}
            helperText={
              isPartialPhone(formData.mobile) ? PHONE_ERROR : "10 digits"
            }
            inputProps={phoneInputProps}
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
        )}

        <ModalFooter>
          {result ? (
            <>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  setResult(null);
                  setFormData(EMPTY);
                }}
              >
                Add another
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={toggle}
                style={{ marginLeft: "10px" }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </ModalFooter>
      </Modal>

      <ToastContainer position="top-center" autoClose={5000} theme="colored" />
    </div>
  );
}

export default AddAnnkutSevakModal;

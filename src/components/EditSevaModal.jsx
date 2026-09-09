// src/components/EditSevaModal.jsx
//
// Karyakar only. An ordinary sevak gets 403 even on an entry they recorded
// themselves, because once the paper receipt is written the record has to keep
// matching it — so the button that opens this is gated on access scope.
import React, { useEffect, useMemo, useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import api, { num, errorText } from "../api/annkut";
import { toast, ToastContainer } from "react-toastify";
import TextField from "@mui/material/TextField";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import CircularProgress from "@mui/material/CircularProgress";
import { Button, FormControlLabel, Typography } from "@mui/material";

function EditSevaModal({ modal, setModal, sevakData, refreshData }) {
  const sevaId = useMemo(
    () => sevakData?.id ?? sevakData?.seva_id,
    [sevakData]
  );

  const [loader, setLoader] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [formData, setFormData] = useState({
    receipt_no: "",
    seva_amount: "500",
    sahyogi_surname: "",
    sahyogi_first_name: "",
    sahyogi_middle_name: "",
    sahyogi_number: "",
  });
  const [customAmount, setCustomAmount] = useState("");
  const [errors, setErrors] = useState({});

  // A receipt may move to another number inside its own book, never to a
  // different book — so the book is shown, not chosen.
  const [book, setBook] = useState({ book_no: "", start_no: 0, end_no: 0 });

  const toggle = () => setModal(!modal);

  useEffect(() => {
    if (!modal || !sevaId) return undefined;

    let ignore = false;

    (async () => {
      try {
        setFetching(true);
        const s = (await api.seva(sevaId)) || {};

        // "500.00" and "500" are the same preset as far as the radio cares;
        // anything else is a custom amount.
        const amt = String(num(s.seva_amount));
        const isPreset = amt === "500" || amt === "1000";

        if (ignore) return;

        setFormData({
          receipt_no: String(s.receipt_no ?? ""),
          seva_amount: isPreset ? amt : "other",
          sahyogi_surname: String(s.sahyogi_surname ?? ""),
          sahyogi_first_name: String(s.sahyogi_first_name ?? ""),
          sahyogi_middle_name: String(s.sahyogi_middle_name ?? ""),
          sahyogi_number: String(s.sahyogi_number ?? ""),
        });
        setCustomAmount(isPreset ? "" : amt);
        setBook({
          book_no: s.book_no ?? "",
          start_no: num(s.start_no),
          end_no: num(s.end_no),
        });
        setErrors({});
      } catch (e) {
        console.error("Error fetching seva by id:", e);
        toast.error(errorText(e, "Unable to fetch seva details."));
      } finally {
        if (!ignore) setFetching(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [modal, sevaId]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "seva_amount" && value !== "other") {
      setCustomAmount("");
    }

    const nextValue = ["receipt_no", "sahyogi_number"].includes(name)
      ? value.replace(/[^\d]/g, "")
      : value;

    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleCustomAmountChange = (e) => {
    const v = e.target.value.replace(/[^\d]/g, "");
    setCustomAmount(v);
    setFormData((prev) => ({ ...prev, seva_amount: "other" }));
  };

  const validateForm = () => {
    const formErrors = {};

    if (!formData.receipt_no) formErrors.receipt_no = "રસીદ નંબર લાખો";
    if (!formData.sahyogi_surname.trim())
      formErrors.sahyogi_surname = "સહયોગી ની અટક લાખો";
    if (!formData.sahyogi_first_name.trim())
      formErrors.sahyogi_first_name = "સહયોગી નું નામ લાખો";
    if (!formData.sahyogi_middle_name.trim())
      formErrors.sahyogi_middle_name = "સહયોગી ના પિતા નું નામ લાખો";
    if (!formData.sahyogi_number)
      formErrors.sahyogi_number = "સહયોગી નો નંબર લાખો";

    if (formData.seva_amount === "other") {
      if (!customAmount) {
        formErrors.customAmount = "Custom amount is required";
      } else if (parseInt(customAmount, 10) <= 1000) {
        formErrors.customAmount = "રોકમ 1000 કરતા વધારે હોઈ તોજ લાખો";
      }
    }

    if (book.start_no && book.end_no) {
      const r = num(formData.receipt_no);
      if (r < book.start_no || r > book.end_no) {
        formErrors.receipt_no = `રસીદ ${book.start_no} થી ${book.end_no} વચ્ચે લાખો`;
      }
    }

    return formErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setLoader(true);

    try {
      const res = await api.editSeva(sevaId, {
        receipt_no: Number(formData.receipt_no),
        seva_amount: Number(
          formData.seva_amount === "other" ? customAmount : formData.seva_amount
        ),
        sahyogi_surname: formData.sahyogi_surname.trim(),
        sahyogi_first_name: formData.sahyogi_first_name.trim(),
        sahyogi_middle_name: formData.sahyogi_middle_name.trim(),
        sahyogi_number: formData.sahyogi_number,
      });

      toast.success(res?.message || "Seva updated successfully");
      toggle();
      if (typeof refreshData === "function") refreshData();
    } catch (error) {
      console.error("Error editing seva:", error);
      toast.error(errorText(error, "Failed to update seva."));
    } finally {
      setLoader(false);
    }
  };

  return (
    <div>
      <Modal isOpen={modal} toggle={toggle}>
        <ModalHeader toggle={toggle}>Edit Annkut Seva</ModalHeader>
        <ModalBody>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            બુક નંબર: <strong>{book.book_no || "-"}</strong>
            {book.start_no || book.end_no
              ? ` (${book.start_no}–${book.end_no})`
              : ""}
          </Typography>

          <FormControl fullWidth variant="outlined" margin="normal">
            <TextField
              label="રસીદ નંબર"
              name="receipt_no"
              type="text"
              value={formData.receipt_no}
              onChange={handleChange}
              variant="outlined"
              color="secondary"
              error={!!errors.receipt_no}
              helperText={errors.receipt_no}
              required
              fullWidth
              inputProps={{ inputMode: "numeric" }}
            />
          </FormControl>

          <FormControl fullWidth variant="outlined" margin="normal">
            <TextField
              label="સહયોગી ની અટક"
              name="sahyogi_surname"
              type="text"
              value={formData.sahyogi_surname}
              onChange={handleChange}
              variant="outlined"
              color="secondary"
              error={!!errors.sahyogi_surname}
              helperText={errors.sahyogi_surname}
              fullWidth
            />
          </FormControl>

          <FormControl fullWidth variant="outlined" margin="normal">
            <TextField
              label="સહયોગી નુ નામ"
              name="sahyogi_first_name"
              type="text"
              value={formData.sahyogi_first_name}
              onChange={handleChange}
              variant="outlined"
              color="secondary"
              error={!!errors.sahyogi_first_name}
              helperText={errors.sahyogi_first_name}
              fullWidth
            />
          </FormControl>

          <FormControl fullWidth variant="outlined" margin="normal">
            <TextField
              label="સહયોગી ના પિતા/પતિ નું નામ"
              name="sahyogi_middle_name"
              type="text"
              value={formData.sahyogi_middle_name}
              onChange={handleChange}
              variant="outlined"
              color="secondary"
              error={!!errors.sahyogi_middle_name}
              helperText={errors.sahyogi_middle_name}
              fullWidth
            />
          </FormControl>

          <FormControl fullWidth variant="outlined" margin="normal">
            <TextField
              label="સહયોગી નો ફોન નંબર"
              name="sahyogi_number"
              type="tel"
              value={formData.sahyogi_number || ""}
              onChange={handleChange}
              variant="outlined"
              color="secondary"
              error={Boolean(errors.sahyogi_number)}
              helperText={errors.sahyogi_number}
              fullWidth
              inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]{10}",
                maxLength: 10,
              }}
            />
          </FormControl>

          <FormControl component="fieldset" margin="normal">
            <FormLabel component="legend">Amount</FormLabel>
            <RadioGroup
              name="seva_amount"
              value={formData.seva_amount}
              onChange={handleChange}
            >
              <FormControlLabel
                value="500"
                control={<Radio color="secondary" />}
                label="500"
              />
              <FormControlLabel
                value="1000"
                control={<Radio color="secondary" />}
                label="1000"
              />
              <FormControlLabel
                value="other"
                control={<Radio color="secondary" />}
                label="Other"
              />
            </RadioGroup>
          </FormControl>

          {formData.seva_amount === "other" && (
            <FormControl fullWidth variant="outlined" margin="normal">
              <TextField
                label="Enter Custom Amount"
                name="customAmount"
                type="text"
                value={customAmount}
                onChange={handleCustomAmountChange}
                variant="outlined"
                color="secondary"
                error={!!errors.customAmount}
                helperText={errors.customAmount}
                fullWidth
                inputProps={{ inputMode: "numeric" }}
              />
            </FormControl>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSubmit}
            disabled={loader || fetching}
          >
            {loader ? <CircularProgress size={24} /> : "Save Changes"}
          </Button>
          <Button
            color="error"
            style={{ margin: "10px" }}
            variant="contained"
            onClick={toggle}
            disabled={loader || fetching}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <ToastContainer
        position="top-center"
        autoClose={5000}
        pauseOnHover
        theme="colored"
      />
    </div>
  );
}

export default EditSevaModal;

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
import {
  Button,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

const EMPTY_FORM = {
  book_id: "",
  receipt_no: "",
  seva_amount: "500",
  sahyogi_surname: "",
  sahyogi_first_name: "",
  sahyogi_middle_name: "",
  sahyogi_number: "",
};

/**
 * `onBehalfOf` is the family member whose tab is open. The seva is credited to
 * them, not to whoever is typing — the book is the household's either way.
 */
function AddSevaModal({ modal, setModal, onBehalfOf, onAdded }) {
  const [loader, setLoader] = useState(false);

  const [myBooks, setMyBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState("");

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [customAmount, setCustomAmount] = useState("");
  const [errors, setErrors] = useState({});

  const toggle = () => setModal(!modal);

  // Books are addressed by book_id; book_no is only what is on the cover.
  const selectedBook = useMemo(
    () => myBooks.find((b) => String(b.id) === String(formData.book_id)),
    [myBooks, formData.book_id]
  );

  const bookLabel = (b) =>
    `${b?.book_no ?? ""} (${num(b?.start_no)}–${num(b?.end_no)})`;

  useEffect(() => {
    if (!modal) return undefined;

    let ignore = false;

    (async () => {
      try {
        setBooksLoading(true);
        setBooksError("");
        const rows = await api.myBooks();
        if (!ignore) setMyBooks(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error("my_books error:", e);
        if (!ignore) {
          setBooksError(errorText(e, "Unable to load your books."));
          setMyBooks([]);
        }
      } finally {
        if (!ignore) setBooksLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [modal]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "seva_amount" && value !== "other") {
      setCustomAmount("");
    }

    const v = name === "sahyogi_number" ? value.replace(/[^\d]/g, "") : value;

    setFormData((p) => ({ ...p, [name]: v }));
  };

  const handleBookChange = (e) => {
    const bookId = e.target.value;
    const b = myBooks.find((x) => String(x.id) === String(bookId));
    setFormData((p) => ({
      ...p,
      book_id: bookId,
      receipt_no: b?.next_receipt_no ? String(b.next_receipt_no) : "",
    }));
  };

  const handleCustomAmountChange = (e) => {
    const v = e.target.value.replace(/[^\d]/g, "");
    setCustomAmount(v);
    setFormData((p) => ({ ...p, seva_amount: "other" }));
  };

  const validateForm = () => {
    const errs = {};

    if (!formData.book_id) errs.book_id = "બુક નંબર પસંદ કરો";
    if (!formData.receipt_no) errs.receipt_no = "રસીદ નંબર લાખો";

    if (!formData.sahyogi_surname.trim())
      errs.sahyogi_surname = "સહયોગી ની અટક લાખો";
    if (!formData.sahyogi_first_name.trim())
      errs.sahyogi_first_name = "સહયોગી નું નામ લાખો";
    if (!formData.sahyogi_middle_name.trim())
      errs.sahyogi_middle_name = "સહયોગી ના પિતા નું નામ લાખો";
    if (!formData.sahyogi_number) errs.sahyogi_number = "સહયોગી નો નંબર લાખો";

    if (formData.seva_amount === "other") {
      if (!customAmount) {
        errs.customAmount = "Custom amount is required";
      } else if (parseInt(customAmount, 10) <= 1000) {
        errs.customAmount = "રોકમ 1000 કરતા વધારે હોઈ તોજ લાખો";
      }
    }

    // The server checks the range too and answers 422; catching it here saves
    // a round trip on the common mistake.
    if (selectedBook) {
      const r = num(formData.receipt_no);
      const s = num(selectedBook.start_no);
      const e = num(selectedBook.end_no);
      if (s && e && (r < s || r > e)) {
        errs.receipt_no = `રસીદ ${s} થી ${e} વચ્ચે લાખો`;
      }
    }

    return errs;
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
      const res = await api.addSeva({
        book_id: Number(formData.book_id),
        receipt_no: Number(formData.receipt_no),
        seva_amount: Number(
          formData.seva_amount === "other" ? customAmount : formData.seva_amount
        ),
        sahyogi_surname: formData.sahyogi_surname.trim(),
        sahyogi_first_name: formData.sahyogi_first_name.trim(),
        sahyogi_middle_name: formData.sahyogi_middle_name.trim(),
        sahyogi_number: formData.sahyogi_number,
        onBehalfOf: onBehalfOf?.is_self ? undefined : onBehalfOf?.sevak_code,
      });

      toast.success(res?.message || "Seva Added Successfully");

      setFormData(EMPTY_FORM);
      setCustomAmount("");
      setErrors({});

      if (typeof onAdded === "function") onAdded();
      toggle();
    } catch (error) {
      console.error("add_seva error:", error);
      // 409 duplicate receipt, 422 out of range, 403 not your book.
      toast.error(errorText(error, "Failed to add Seva"));
    } finally {
      setLoader(false);
    }
  };

  return (
    <div>
      <Modal isOpen={modal} toggle={toggle}>
        <ModalHeader toggle={toggle}>Add Annkut Seva</ModalHeader>
        <ModalBody>
          {onBehalfOf && !onBehalfOf.is_self && (
            <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
              This seva will be recorded for{" "}
              <strong>{onBehalfOf.full_name}</strong> ({onBehalfOf.sevak_code}).
            </Typography>
          )}

          <FormControl fullWidth variant="outlined" margin="normal" size="small">
            <InputLabel id="book-select-label">બુક નંબર</InputLabel>
            <Select
              labelId="book-select-label"
              label="બુક નંબર"
              value={formData.book_id}
              onChange={handleBookChange}
              error={!!errors.book_id}
            >
              {booksLoading && <MenuItem disabled>Loading…</MenuItem>}
              {booksError && <MenuItem disabled>{booksError}</MenuItem>}
              {!booksLoading && !booksError && myBooks.length === 0 && (
                <MenuItem disabled>No books issued to your parivar</MenuItem>
              )}
              {myBooks.map((b) => (
                <MenuItem key={b.id} value={String(b.id)}>
                  {bookLabel(b)}
                </MenuItem>
              ))}
            </Select>
            {errors.book_id && (
              <div style={{ color: "#d32f2f", fontSize: 12, marginTop: 4 }}>
                {errors.book_id}
              </div>
            )}
          </FormControl>

          <FormControl fullWidth variant="outlined" margin="normal">
            <TextField
              label="રસીદ નંબર (auto)"
              name="receipt_no"
              value={formData.receipt_no}
              variant="outlined"
              color="secondary"
              error={!!errors.receipt_no}
              helperText={
                errors.receipt_no ||
                (selectedBook
                  ? `Next: ${selectedBook.next_receipt_no} · ${num(
                      selectedBook.remaining
                    )} left`
                  : "પહેલા બુક પસંદ કરો")
              }
              required
              fullWidth
              InputProps={{ readOnly: true }}
              disabled
            />
          </FormControl>

          {/* Three boxes rather than one: given a single box no two sevaks
              fill the name in the same order. */}
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
            disabled={loader}
          >
            {loader ? <CircularProgress size={24} /> : "Submit"}
          </Button>
          <Button
            color="error"
            style={{ margin: "10px" }}
            variant="contained"
            onClick={toggle}
            disabled={loader}
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

export default AddSevaModal;

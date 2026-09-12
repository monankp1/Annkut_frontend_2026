import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api, { errorText } from "../api/annkut";
import {
  cleanPhone,
  isCompletePhone,
  PHONE_ERROR,
  PHONE_LENGTH,
} from "../utils/phone";

const MIN_LENGTH = 6;

// Reached from the login screen by somebody who cannot sign in at all, so it
// takes no token: the Sevak ID plus the mobile on file stand in for the old
// password. Anyone who can already sign in uses /change-password instead.
const ForgotPassword = () => {
  const [loader, setLoader] = useState(false);
  const [form, setForm] = useState({
    sevak_id: "",
    phone_number: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: name === "phone_number" ? cleanPhone(value) : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isCompletePhone(form.phone_number)) {
      toast.error(PHONE_ERROR);
      return;
    }

    if (form.password.length < MIN_LENGTH) {
      toast.error(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }

    setLoader(true);

    try {
      const res = await api.forgotPassword(
        form.sevak_id.trim(),
        form.phone_number,
        form.password
      );

      toast.success(res?.message || "Password reset. Please sign in.");
      navigate("/", { replace: true });
    } catch (error) {
      // 404 is returned for a wrong Sevak ID and a wrong number alike, so the
      // message stays as the server worded it.
      toast.error(errorText(error, "Could not reset the password."));
    } finally {
      setLoader(false);
    }
  };

  return (
    <div className="password-container">
      <div className="password-card">
        <form onSubmit={handleSubmit}>
          <h1>Change Password</h1>

          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
            Enter your Sevak ID and the phone number registered against it.
          </p>

          <label>Sevak Id:</label>
          <input
            type="text"
            name="sevak_id"
            onChange={handleChange}
            value={form.sevak_id}
            autoCapitalize="characters"
            required
          />

          <label>Phone Number:</label>
          <input
            type="tel"
            name="phone_number"
            onChange={handleChange}
            value={form.phone_number}
            inputMode="numeric"
            maxLength={PHONE_LENGTH}
            required
          />

          <label>New Password:</label>
          <input
            type="password"
            name="password"
            onChange={handleChange}
            value={form.password}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
          />

          <button type="submit" disabled={loader} className="password-btn">
            {loader ? "Loading..." : "Change Password"}
          </button>

          <p className="back-to-login-link">
            <Link to="/" className="link">
              Back to Login
            </Link>
          </p>

          <ToastContainer
            position="top-center"
            autoClose={5000}
            closeOnClick
            pauseOnHover
            theme="colored"
          />
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;

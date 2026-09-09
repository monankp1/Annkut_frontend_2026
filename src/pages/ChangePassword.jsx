import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api, { errorText } from "../api/annkut";
import { getSevak } from "../api/session";

const MIN_LENGTH = 6;

// Changing a password now proves you know the current one, so this screen sits
// behind the login rather than in front of it. There is no self-service reset:
// that needs an OTP flow the backend does not have yet.
const ChangePassword = () => {
  const [loader, setLoader] = useState(false);
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const navigate = useNavigate();
  const sevak = getSevak();
  const firstTime = Boolean(sevak?.must_change_password);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.new_password.length < MIN_LENGTH) {
      toast.error(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }

    if (form.new_password !== form.confirm_password) {
      toast.error("The two new passwords do not match.");
      return;
    }

    if (form.new_password === form.current_password) {
      toast.error("The new password must be different from the current one.");
      return;
    }

    setLoader(true);

    try {
      const res = await api.changePassword(
        form.current_password,
        form.new_password
      );

      // Every token for this account is now revoked, this one included, so
      // there is nothing to go back to but the login screen.
      toast.success(res?.message || "Password changed. Please sign in again.");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(errorText(error, "Could not change the password."));
    } finally {
      setLoader(false);
    }
  };

  const handleCancel = async () => {
    await api.logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="password-container">
      <div className="password-card">
        <form onSubmit={handleSubmit}>
          <h1>Change Password</h1>

          {firstTime && (
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              Please choose your own password before continuing.
            </p>
          )}

          {sevak?.sevak_id && (
            <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
              Signed in as {sevak.sevak_id}
            </p>
          )}

          <label>Current Password:</label>
          <input
            type="password"
            name="current_password"
            onChange={handleChange}
            value={form.current_password}
            autoComplete="current-password"
            required
          />

          <label>New Password:</label>
          <input
            type="password"
            name="new_password"
            onChange={handleChange}
            value={form.new_password}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
          />

          <label>Confirm New Password:</label>
          <input
            type="password"
            name="confirm_password"
            onChange={handleChange}
            value={form.confirm_password}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
          />

          <button type="submit" disabled={loader} className="password-btn">
            {loader ? "Loading..." : "Change Password"}
          </button>

          <p className="back-to-login-link">
            <button
              type="button"
              onClick={handleCancel}
              className="link"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Sign out
            </button>
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

export default ChangePassword;

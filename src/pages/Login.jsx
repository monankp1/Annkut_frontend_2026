import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api, { errorText } from "../api/annkut";
import { landingPath } from "../api/session";
import Mandir from "./../resources/mandir.png";
import bapsLogo from "./../resources/baps_logo.svg";
import { PasswordInput, FormError } from "../components/AuthFields";

const Login = () => {
  const [loader, setLoader] = useState(false);
  const [error, setError] = useState("");
  const [loginData, setLoginData] = useState({
    sevak_id: "",
    password: "",
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value,
    });
    // A stale "wrong password" next to a field they are fixing is noise.
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoader(true);
    setError("");

    try {
      const sevak = await api.login(
        loginData.sevak_id.trim(),
        loginData.password
      );

      // `replace` so the login page does not stay on the history stack:
      // pressing Back should not walk into a form they have already used.
      // landingPath also handles must_change_password, which everyone hits on
      // first sign-in because all accounts were seeded with one password.
      navigate(landingPath(sevak), { replace: true });
    } catch (error) {
      // Shown inline under the button rather than as a toast: that is where
      // the eyes and thumb are, and it stays until they start typing again.
      setError(errorText(error, "Login failed."));
    } finally {
      setLoader(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <img src={Mandir} alt="" className="mandir-image" />
        <div className="login-logo-badge">
          <img src={bapsLogo} alt="BAPS" className="baps-logo" />
        </div>
        <p className="login-eyebrow">Welcome</p>
        <h1 className="login-title">Annkut Sevak</h1>
      </div>

      <div className="login-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="sevak_id">Sevak ID</label>
            <input
              id="sevak_id"
              type="text"
              name="sevak_id"
              onChange={handleChange}
              value={loginData.sevak_id}
              autoCapitalize="characters"
              autoComplete="username"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              required
            />
          </div>

          <label htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            name="password"
            onChange={handleChange}
            value={loginData.password}
            autoComplete="current-password"
            enterKeyHint="go"
            required
          />

          {/* For somebody locked out entirely: the reset behind this link
              asks for the Sevak ID and registered phone instead of the old
              password. Someone who can still sign in changes theirs from the
              menu, which asks for the current one. */}
          <div className="login-forgot">
            <Link to="/forgot-password" className="login-forgot-link">
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={loader} className="brand-btn">
            {loader ? (
              <>
                <span
                  className="spinner-border spinner-border-sm"
                  aria-hidden="true"
                />
                <span>Signing in…</span>
              </>
            ) : (
              "Log In"
            )}
          </button>

          <FormError>{error}</FormError>
        </form>
      </div>

      {/* Still needed here: Change Password and Forgot Password toast their
          success message and then land on this page to show it. */}
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

export default Login;

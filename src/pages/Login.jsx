import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api, { errorText } from "../api/annkut";
import { hasMandalScope } from "../api/session";
import Mandir from "./../resources/mandir.png";
import bapsLogo from "./../resources/logoBaps.png";

const Login = () => {
  const [loader, setLoader] = useState(false);
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoader(true);

    try {
      const sevak = await api.login(
        loginData.sevak_id.trim(),
        loginData.password
      );

      toast.success("Login successful");

      // Everyone was seeded with the same password; that has to go before
      // anything else is reachable.
      if (sevak?.must_change_password) {
        navigate("/change-password");
        return;
      }

      // Leadership lands on the mandal overview, everyone else on their own
      // seva entry screen.
      navigate(hasMandalScope(sevak) ? "/annkut-sevak-list" : "/home");
    } catch (error) {
      toast.error(errorText(error, "Login failed."));
    } finally {
      setLoader(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <img src={Mandir} alt="Mandir Background" className="mandir-image" />
        <img src={bapsLogo} alt="BAPS Logo" className="baps-logo" />
        <h6>WELCOME</h6>
        <h1>Annkut Sevak</h1>
      </div>

      <div className="login-card">
        <form onSubmit={handleSubmit}>
          <label>Sevak Id:</label>
          <input
            type="text"
            name="sevak_id"
            onChange={handleChange}
            value={loginData.sevak_id}
            autoCapitalize="characters"
            required
          />
          <label>Password:</label>
          <input
            type="password"
            name="password"
            onChange={handleChange}
            value={loginData.password}
            required
          />
          <button type="submit" disabled={loader} className="login-btn">
            {loader ? "Loading..." : "Log In"}
          </button>

          {/* For somebody locked out entirely: the reset behind this link
              asks for the Sevak ID and registered phone instead of the old
              password. Someone who can still sign in changes theirs from the
              menu, which asks for the current one. */}
          <p className="change-password-link">
            <Link to="/forgot-password" className="link">
              Change Password
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

export default Login;

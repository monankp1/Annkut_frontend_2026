import React, { useEffect } from "react";
import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import api from "./api/annkut";
import RequireAuth from "./components/RequireAuth";
import PublicOnly from "./components/PublicOnly";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import AnnkutSevakList from "./pages/AnnkutSevakList";
import MandalSevakList from "./pages/MandalSevakList";
import ReceiptBooks from "./pages/ReceiptBooks";
import BookLookup from "./pages/BookLookup";

function App() {
  // Any expired token, on any screen, lands the user back on the sign-in page.
  // A 403 is deliberately not handled here — being refused one mandal is not a
  // reason to sign somebody out.
  useEffect(() => {
    api.onUnauthorized = () => {
      if (window.location.pathname !== "/") window.location.replace("/");
    };
  }, []);

  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Both bounce a signed-in visitor onward, so Back after login
              cannot land on a login form that is no longer true. */}
          <Route
            path="/"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />

          {/* Public: for someone who cannot sign in at all. Anyone already
              signed in wants /change-password instead. */}
          <Route
            path="/forgot-password"
            element={
              <PublicOnly>
                <ForgotPassword />
              </PublicOnly>
            }
          />

          {/* Reachable while must_change_password is still set. */}
          <Route
            path="/change-password"
            element={
              <RequireAuth allowPasswordChange>
                <ChangePassword />
              </RequireAuth>
            }
          />

          <Route
            path="/home"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/annkut-sevak-list"
            element={
              <RequireAuth>
                <AnnkutSevakList />
              </RequireAuth>
            }
          />
          <Route
            path="/receipt-books"
            element={
              <RequireAuth>
                <ReceiptBooks />
              </RequireAuth>
            }
          />
          <Route
            path="/book-lookup"
            element={
              <RequireAuth>
                <BookLookup />
              </RequireAuth>
            }
          />
          <Route
            path="/mandal-sevak-list"
            element={
              <RequireAuth>
                <MandalSevakList />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;

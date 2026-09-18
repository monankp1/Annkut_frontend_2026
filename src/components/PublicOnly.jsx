// The mirror of RequireAuth: pages that only make sense when signed out.
//
// Without this, pressing Back after signing in lands on the login form while
// the session is still perfectly good — which reads as "logged out" even
// though nothing was cleared. Sending them onward is the fix; clearing the
// session would be worse, because Back is a navigation gesture and not a
// decision to sign out.

import React from "react";
import { Navigate } from "react-router-dom";
import api from "../api/annkut";
import { getSevak, landingPath } from "../api/session";

export default function PublicOnly({ children }) {
  if (api.isAuthenticated) {
    return <Navigate to={landingPath(getSevak())} replace />;
  }

  return children;
}

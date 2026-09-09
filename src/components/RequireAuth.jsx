// Route guard.
//
// Renders its children only for a signed-in user, and pushes anyone still
// carrying the seeded password to the change-password screen first. The cached
// profile renders immediately and login/me refreshes it in the background, so
// a reload does not flash a spinner when the token is still good.

import React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import api from "../api/annkut";
import { getSevak } from "../api/session";

export default function RequireAuth({ children, allowPasswordChange = false }) {
  const cached = getSevak();

  const [sevak, setSevak] = React.useState(cached);
  const [checking, setChecking] = React.useState(
    api.isAuthenticated && !cached
  );

  React.useEffect(() => {
    if (!api.isAuthenticated) return undefined;

    let ignore = false;

    (async () => {
      try {
        const fresh = await api.me();
        if (!ignore && fresh) setSevak(fresh);
      } catch {
        // Network trouble: keep the cached profile and let the page's own
        // requests surface the problem. A 401 has already cleared the token,
        // which the render below turns into a redirect.
      } finally {
        if (!ignore) setChecking(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  if (!api.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (checking) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (sevak?.must_change_password && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

// Base URL of the CodeIgniter API.
//
// Override per environment with REACT_APP_BACKEND_ENDPOINT (.env.local for a
// dev machine, .env.production for the Amplify build):
//
//   local        http://localhost:8080/index.php/
//   production   https://production.bharuchbaps.in/index.php/
//
// CORS only allows http://localhost:3000, http://localhost:5173 and the Amplify
// URL, so run the dev server on port 3000.

const FALLBACK_ENDPOINT = "http://localhost:8080/index.php/";

export const BACKEND_ENDPOINT =
  process.env.REACT_APP_BACKEND_ENDPOINT || FALLBACK_ENDPOINT;

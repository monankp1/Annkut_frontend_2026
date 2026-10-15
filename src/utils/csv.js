// Builds a CSV in the browser and hands it to the user as a download.
//
// The byte-order mark at the start is what makes Excel read the file as
// UTF-8; without it Gujarati names and the ₹ sign arrive as mojibake. Google
// Sheets ignores it, so it costs nothing there.

const BOM = "﻿";

/** One cell: quoted when it holds a comma, quote or line break. */
const cell = (value) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * columns: [{ header, value: (row) => any }]
 * Returns the whole file as text, CRLF line endings for Excel.
 */
export function toCsv(rows, columns) {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => cell(c.value(row))).join(","));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

export function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before letting go.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Bharuch - 1" → "bharuch-1", for file names. */
export const slug = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Today as YYYY-MM-DD in the user's own timezone. */
export const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

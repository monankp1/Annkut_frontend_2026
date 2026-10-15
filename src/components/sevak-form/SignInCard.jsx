import React, { useEffect, useState } from "react";

/**
 * Clipboard API first; it needs a secure context (https or localhost), so
 * over a plain-http LAN address fall back to the old select-and-copy.
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }
}

/**
 * The details to read out to the person standing there, after adding a
 * sevak or resetting a password. Large, monospaced (0/O and 1/l look
 * different), with Copy and — where the phone offers it — Share.
 */
export default function SignInCard({ title, sevakId, password, note }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const text = `Annkut Seva sign-in\nSevak ID: ${sevakId}\nPassword: ${password}\n${window.location.origin}`;
  // Only on phones (and only over https); hidden where it would do nothing.
  const canShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  const copy = async () => {
    if (await copyText(text)) setCopied(true);
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Annkut Seva sign-in", text });
    } catch {
      /* closed the share sheet — nothing to do */
    }
  };

  return (
    <div className="signin-card">
      <div className="signin-title">
        <i className="bi bi-check-circle-fill" aria-hidden="true" />
        <span>{title}</span>
      </div>

      <div className="signin-row">
        <span className="signin-label">Sevak ID</span>
        <span className="signin-value">{sevakId}</span>
      </div>
      <div className="signin-row">
        <span className="signin-label">Password</span>
        <span className="signin-value">{password}</span>
      </div>

      <div className="signin-actions">
        <button type="button" className="outline-btn" onClick={copy}>
          <i
            className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"}`}
            aria-hidden="true"
          />
          {copied ? "Copied" : "Copy"}
        </button>
        {canShare && (
          <button type="button" className="outline-btn" onClick={share}>
            <i className="bi bi-share" aria-hidden="true" /> Share
          </button>
        )}
      </div>

      {note && <p className="signin-note">{note}</p>}
    </div>
  );
}

"""Resend-based email notifications for Paris Cuban Salsa.

Configuration (env vars, set on Railway):
  - RESEND_API_KEY        : `re_xxxxx` — Resend API key (required for sending)
  - ADMIN_NOTIFICATION_EMAIL : recipient address for admin notifications
                              (e.g. pariscubansalsa@gmail.com)
  - RESEND_FROM_EMAIL     : (optional) verified sender, defaults to
                              `Paris Cuban Salsa <onboarding@resend.dev>`
                              which works without DNS setup but is less pro.
  - PUBLIC_APP_URL        : (optional) base URL for admin links in emails.
                              Defaults to `https://pariscubansalsa.com`.

If RESEND_API_KEY is missing, send_email() logs a warning and returns False
without raising — so the app keeps working in dev / unconfigured envs.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("server.email")

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "Paris Cuban Salsa <onboarding@resend.dev>"
DEFAULT_PUBLIC_URL = "https://pariscubansalsa.com"


def _cfg() -> dict:
    """Read env vars at call-time so tests / hot-reload pick up changes."""
    return {
        "api_key": (os.getenv("RESEND_API_KEY") or "").strip(),
        "admin": (os.getenv("ADMIN_NOTIFICATION_EMAIL") or "").strip(),
        "sender": (os.getenv("RESEND_FROM_EMAIL") or DEFAULT_FROM).strip(),
        "public_url": (os.getenv("PUBLIC_APP_URL") or DEFAULT_PUBLIC_URL).rstrip("/"),
    }


# ---------------------------------------------------------------------------
# Low-level sender
# ---------------------------------------------------------------------------


async def send_email(
    to: str | list[str],
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """Send an email via Resend. Returns True on success, False on any failure
    (never raises — callers shouldn't have to wrap)."""
    cfg = _cfg()
    if not cfg["api_key"]:
        logger.warning("send_email: RESEND_API_KEY not set — skipping send to %s", to)
        return False

    recipients = [to] if isinstance(to, str) else list(to)
    payload: dict = {
        "from": cfg["sender"],
        "to": recipients,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if reply_to:
        payload["reply_to"] = reply_to

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                RESEND_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {cfg['api_key']}",
                    "Content-Type": "application/json",
                },
            )
        if r.status_code >= 400:
            logger.error(
                "send_email failed [%s] %s — payload to=%s subject=%r",
                r.status_code,
                r.text[:300],
                recipients,
                subject,
            )
            return False
        logger.info("send_email OK → to=%s subject=%r", recipients, subject)
        return True
    except Exception as e:  # network errors, timeouts, etc.
        logger.exception("send_email exception: %s", e)
        return False


# ---------------------------------------------------------------------------
# Domain-specific notifications
# ---------------------------------------------------------------------------


TYPE_FR = {
    "soiree": "Soirée",
    "mensuelle": "Mensuelle",
    "workshop": "Workshop",
    "festival": "Festival",
    "agenda": "Sortie / Event",
}


def _format_date_fr(iso_date: str) -> str:
    """YYYY-MM-DD → 'lundi 15 juillet 2026' (best-effort, falls back to iso)."""
    if not iso_date:
        return "—"
    try:
        from datetime import date
        d = date.fromisoformat(iso_date[:10])
        months = [
            "janvier", "février", "mars", "avril", "mai", "juin",
            "juillet", "août", "septembre", "octobre", "novembre", "décembre",
        ]
        weekdays = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
        return f"{weekdays[d.weekday()]} {d.day} {months[d.month - 1]} {d.year}"
    except Exception:
        return iso_date


def _build_event_email(entry: dict) -> tuple[str, str, str]:
    """Return (subject, html_body, text_body) for a new submission."""
    cfg = _cfg()
    type_label = TYPE_FR.get(entry.get("type") or "", entry.get("type") or "Event")
    title = (entry.get("title") or "").strip() or "(sans titre)"
    date_label = _format_date_fr(entry.get("date") or "")
    time_str = (entry.get("time") or "").strip()
    end_time = (entry.get("end_time") or "").strip()
    if time_str and end_time:
        time_label = f"{time_str} → {end_time}"
    elif time_str:
        time_label = time_str
    else:
        time_label = "—"

    venue = (entry.get("venue") or "").strip()
    address = (entry.get("address") or "").strip()
    venue_label = " · ".join([v for v in (venue, address) if v]) or "—"

    submitter = (entry.get("submitter_name") or "").strip() or "(anonyme)"
    submitter_email = (entry.get("submitter_email") or "").strip()
    submitter_label = (
        f"{submitter} &lt;{submitter_email}&gt;" if submitter_email else submitter
    )

    entry_id = entry.get("id") or ""
    admin_url = f"{cfg['public_url']}/entry/{entry_id}"

    subject = f"🎯 Nouvel event à valider — {title}"

    html = f"""<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #eaeaea;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#111;padding:20px 24px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#F5C518;letter-spacing:-0.3px;">Paris Cuban Salsa</div>
          <div style="font-size:11px;letter-spacing:1.6px;color:#aaa;text-transform:uppercase;margin-top:6px;">Modération · Nouvel event à valider</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <div style="font-size:11px;letter-spacing:1.4px;color:#666;text-transform:uppercase;margin-bottom:10px;">{type_label}</div>
          <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:#111;">{title}</h1>

          <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f0f0f0;">
            {_row("Date", date_label)}
            {_row("Horaire", time_label)}
            {_row("Lieu", venue_label)}
            {_row("Soumis par", submitter_label)}
          </table>

          <div style="margin-top:28px;text-align:center;">
            <a href="{admin_url}"
               style="display:inline-block;background:#F5C518;color:#111;text-decoration:none;padding:14px 28px;font-weight:700;font-size:13px;letter-spacing:1.4px;border-radius:40px;">
              VOIR ET VALIDER →
            </a>
          </div>

          <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.5;">
            Lien direct : <a href="{admin_url}" style="color:#888;">{admin_url}</a><br/>
            Connecte-toi avec ton compte admin pour modérer (approuver / rejeter / éditer).
          </p>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #eaeaea;font-size:11px;color:#999;text-align:center;">
          Email envoyé automatiquement par la plateforme PCS · Ne pas répondre directement
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    text = (
        f"Nouvel event à valider — {title}\n\n"
        f"Type      : {type_label}\n"
        f"Date      : {date_label}\n"
        f"Horaire   : {time_label}\n"
        f"Lieu      : {venue_label}\n"
        f"Soumis par: {submitter}{' <' + submitter_email + '>' if submitter_email else ''}\n\n"
        f"Valider / éditer : {admin_url}\n"
    )
    return subject, html, text


def _row(label: str, value: str) -> str:
    return (
        f'<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">'
        f'  <div style="font-size:10px;letter-spacing:1.3px;color:#888;text-transform:uppercase;">{label}</div>'
        f'  <div style="font-size:14px;color:#111;margin-top:3px;">{value}</div>'
        f"</td></tr>"
    )


async def send_admin_new_event_notification(entry: dict) -> bool:
    """Notify the admin inbox that a new event has been submitted for review.

    Called as a FastAPI BackgroundTask so the public submission endpoint
    returns immediately — email delivery happens out-of-band.
    """
    cfg = _cfg()
    if not cfg["admin"]:
        logger.warning(
            "send_admin_new_event_notification: ADMIN_NOTIFICATION_EMAIL not set"
        )
        return False
    subject, html, text = _build_event_email(entry)
    return await send_email(
        to=cfg["admin"],
        subject=subject,
        html=html,
        text=text,
        reply_to=(entry.get("submitter_email") or "").strip() or None,
    )

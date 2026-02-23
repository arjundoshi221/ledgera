"""Email notification service using Resend"""

import os
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "Ledgera <noreply@ledgera.app>")


def _send_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set, skipping email to %s", to)
        return False
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, str(e))
        return False


def send_bug_report_confirmation(to_email: str, title: str, report_id: str) -> bool:
    subject = f"Bug Report Received: {title}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Bug Report Received</h2>
        <p>Hi there,</p>
        <p>Thank you for submitting a bug report. We have received your report and our team will review it shortly.</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-weight: 600;">Title: {title}</p>
            <p style="margin: 4px 0 0; color: #71717a; font-size: 14px;">Reference: {report_id[:8]}</p>
        </div>
        <p>We will notify you once this issue has been resolved.</p>
        <p style="color: #71717a; font-size: 14px;">&mdash; The Ledgera Team</p>
    </div>
    """
    return _send_email(to_email, subject, html)


def send_bug_report_resolved(to_email: str, title: str) -> bool:
    subject = f"Bug Report Resolved: {title}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Bug Report Resolved</h2>
        <p>Hi there,</p>
        <p>Good news! The bug report you submitted has been resolved.</p>
        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; font-weight: 600;">{title}</p>
            <p style="margin: 4px 0 0; color: #16a34a; font-size: 14px;">Status: Resolved</p>
        </div>
        <p>If you continue to experience this issue, please submit a new bug report.</p>
        <p style="color: #71717a; font-size: 14px;">&mdash; The Ledgera Team</p>
    </div>
    """
    return _send_email(to_email, subject, html)

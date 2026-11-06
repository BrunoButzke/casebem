/**
 * Optional email notifications via Resend HTTP API (free tier ~3k/mês).
 * Zero Cloudflare cost — if RESEND_API_KEY missing, silently no-ops.
 * Never throws to callers (best-effort).
 */

/**
 * @param {object} env
 * @param {{subject: string, text: string, html?: string}} payload
 * @returns {Promise<{sent: boolean, skipped?: boolean, error?: string}>}
 */
export async function sendAdminNotification(env, payload) {
  const apiKey = env?.RESEND_API_KEY;
  const to = env?.ADMIN_NOTIFY_EMAIL;
  const from = env?.RESEND_FROM_EMAIL || 'CaseBem <onboarding@resend.dev>';

  if (!apiKey || !to) {
    return { sent: false, skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: payload.subject,
        text: payload.text,
        ...(payload.html ? { html: payload.html } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err?.message || 'email_failed' };
  }
}

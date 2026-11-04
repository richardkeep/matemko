// Sends account emails (verification and password reset).
//
// Production: set the RESEND_API_KEY secret and the MAIL_FROM variable (e.g. "Easy Math <hello@example.com>").
// Tests: pass env.MAILER = { send(message) } to capture messages.
// Local development without a provider: the link is printed to the Worker console instead.
// Returns true when the message was handed to a provider.
export async function sendMail(env, message, { dev = false } = {}) {
  if (env.MAILER?.send) { await env.MAILER.send(message); return true }
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    })
    if (!response.ok) { console.error(JSON.stringify({ event: 'mail_failure', status: response.status })); return false }
    return true
  }
  if (dev) console.log(`\n[Easy Math mail] To: ${message.to}\n${message.subject}\n${message.text}\n`)
  else console.error(JSON.stringify({ event: 'mail_not_configured' }))
  return false
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function layout(title, intro, button, link, outro) {
  return `<!doctype html><html><body style="margin:0;background:#fcfaf6;font-family:Trebuchet MS,Arial,sans-serif;color:#283e43">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:24px;font-weight:800;color:#285a50;margin:0 0 24px">✦ Easy Math</p>
<h1 style="font-size:22px;margin:0 0 12px">${escape(title)}</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">${escape(intro)}</p>
<p style="margin:0 0 24px"><a href="${escape(link)}" style="display:inline-block;background:#24675c;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">${escape(button)}</a></p>
<p style="font-size:14px;line-height:1.6;color:#5d6a6b;margin:0">${escape(outro)}</p>
</div></body></html>`
}

export function verificationMessage(to, name, link) {
  const intro = `Hi ${name}! Please confirm this email address so we can help if you ever forget your password.`
  const outro = 'This link works for 48 hours. If you did not create an Easy Math account, you can ignore this email.'
  return { to, subject: 'Confirm your Easy Math email', text: `${intro}\n\n${link}\n\n${outro}`, html: layout('Confirm your email', intro, 'Confirm my email', link, outro) }
}

export function resetMessage(to, name, link) {
  const intro = `Hi ${name}! Someone asked to reset the password for your Easy Math account. Choose a new password with the button below.`
  const outro = 'This link works for one hour and can only be used once. If you did not ask for this, you can ignore this email and your password will stay the same.'
  return { to, subject: 'Reset your Easy Math password', text: `${intro}\n\n${link}\n\n${outro}`, html: layout('Reset your password', intro, 'Choose a new password', link, outro) }
}

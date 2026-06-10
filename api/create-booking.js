const TENANT_ID = process.env.BOOKINGS_TENANT_ID;
const CLIENT_ID = process.env.BOOKINGS_CLIENT_ID;
const CLIENT_SECRET = process.env.BOOKINGS_CLIENT_SECRET;
const CALENDAR_ID = process.env.BOOKINGS_CALENDAR_ID;
const SENDER_EMAIL = 'COETrainingScheduling@franconnect.com';

async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default'
  });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get token');
  return data.access_token;
}

async function sendConfirmationEmail(token, { toEmails, subject, html }) {
  const toRecipients = toEmails.map(addr => ({ emailAddress: { address: addr.trim() } }));
  console.error('Sending email to:', toEmails.join(', '));

  const mailRes = await fetch(`https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients
      }
    })
  });

  console.error('sendMail status:', mailRes.status);
  if (!mailRes.ok) {
    const errText = await mailRes.text();
    console.error('sendMail error:', errText);
    throw new Error(`sendMail failed: ${mailRes.status}`);
  }
}

function buildConfirmationHtml({ bookedBy, customerName, meetingTitle, startDateTime, trainerName, rescheduleUrl, cancelUrl }) {
  const startDate = new Date(startDateTime);
  const formattedDate = startDate.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });

  const rescheduleBtn = rescheduleUrl
    ? `<a href="${rescheduleUrl}" style="display:inline-block;background:#134564;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Reschedule</a>`
    : '';
  const cancelBtn = cancelUrl
    ? `<a href="${cancelUrl}" style="display:inline

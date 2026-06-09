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

async function sendBookerConfirmation(token, { bookerEmail, bookedBy, customerName, meetingTitle, startDateTime, trainerName, manageUrl }) {
  const startDate = new Date(startDateTime);
  const formattedDate = startDate.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#2c2c2c;">
      <div style="background:#134564;padding:20px 24px;">
        <span style="color:white;font-size:18px;font-weight:bold;">FranConnect Training</span>
      </div>
      <div style="padding:24px;">
        <h2 style="color:#134564;margin:0 0 16px;">Booking confirmed</h2>
        <p style="margin:0 0 20px;">Hi ${bookedBy}, your booking has been confirmed. Here are the details:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:8px 0;color:#717171;font-size:13px;width:140px;">Customer</td><td style="padding:8px 0;font-weight:600;">${customerName}</td></tr>
          <tr><td style="padding:8px 0;color:#717171;font-size:13px;">Session</td><td style="padding:8px 0;font-weight:600;">${meetingTitle}</td></tr>
          <tr><td style="padding:8px 0;color:#717171;font-size:13px;">Date &amp; time</td><td style="padding:8px 0;font-weight:600;">${formattedDate}</td></tr>
          <tr><td style="padding:8px 0;color:#717171;font-size:13px;">Trainer</td><td style="padding:8px 0;font-weight:600;">${trainerName}</td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:14px;">Need to make a change?</p>
        <table style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:12px;">
              <a href="${manageUrl}" style="display:inline-block;background:#134564;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Reschedule</a>
            </td>
            <td>
              <a href="${manageUrl}" style="display:inline-block;background:white;color:#134564;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;border:1.5px solid #134564;">Cancel</a>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#717171;">The customer will receive their own confirmation email with a Teams meeting link. After the session, the recording will be automatically shared with the customer.</p>
      </div>
      <div style="background:#f5f5f3;padding:12px 24px;font-size:12px;color:#717171;">
        FranConnect · COE Training · Internal use only
      </div>
    </div>`;

  await fetch(`https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: `Booking confirmed: ${meetingTitle}`,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: bookerEmail } }]
      }
    })
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    buildName, customerEmail, customerName, serviceId, staffId,
    startDateTime, endDateTime, sessionNotes, bookedBy, bookerEmail,
    sfId, duration, sessionType, trainerName
  } = req.body;

  if (!customerEmail || !customerName || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const date = new Date(startDateTime);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const titleBase = sessionType || 'COE Consult';
  const meetingTitle = `${dateStr} ${titleBase}`;
  const cleanBuildName = (buildName || '').replace(/\s*\(.*?\)\s*/g, '').trim();

  try {
    const token = await getAccessToken();

    const appointment = {
      "@odata.type": "#microsoft.graph.bookingAppointment",
      "serviceName": meetingTitle,
      "serviceId": serviceId,
      "isLocationOnline": true,
      "startDateTime": {
        "@odata.type": "#microsoft.graph.dateTimeTimeZone",
        "dateTime": startDateTime,
        "timeZone": "UTC"
      },
      "endDateTime": {
        "@odata.type": "#microsoft.graph.dateTimeTimeZone",
        "dateTime": endDateTime,
        "timeZone": "UTC"
      },
      "additionalInformation": `Booked by: ${bookedBy} (${bookerEmail}) | SF ID: ${sfId} | Session: ${titleBase}`,
      ...(staffId && staffId !== 'any' ? { "staffMemberIds": [staffId] } : {}),
      "customers": [{
        "@odata.type": "#microsoft.graph.bookingCustomerInformation",
        "name": customerName,
        "emailAddress": customerEmail,
        "customQuestionAnswers": [
          { "questionId": "03e23d5a-53a0-47c8-a7cb-fc8b0167b158", "question": "Booked By", "answer": bookedBy },
          { "questionId": "41052a65-937a-416f-b195-61db550e914b", "question": "Session Notes", "answer": sessionNotes || '' },
          { "questionId": "96ecbb6b-11e8-491c-a7bb-fe07bd256d2f", "question": "Customer Contact Email", "answer": customerEmail },
          { "questionId": "b1e4da1c-e7dc-47da-84a4-3dcb9e2f646b", "question": "Build Name", "answer": cleanBuildName },
          { "questionId": "30d42ee1-d12f-4402-a6bb-da55e719096c", "question": "Salesforce Account ID", "answer": sfId || '' }
        ]
      }]
    };

    const bookingsRes = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${CALENDAR_ID}/appointments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(appointment)
      }
    );

    if (!bookingsRes.ok) {
      const errText = await bookingsRes.text();
      console.error('Bookings API error:', bookingsRes.status, errText);
      return res.status(500).json({ error: 'Failed to create booking', detail: errText, status: bookingsRes.status });
    }

    const created = await bookingsRes.json();

    const manageUrl = `https://outlook.office.com/bookings/manage?appointmentId=${created.id}&businessId=${encodeURIComponent(CALENDAR_ID)}`;

    try {
      await sendBookerConfirmation(token, {
        bookerEmail, bookedBy, customerName, meetingTitle,
        startDateTime, trainerName: trainerName || 'Assigned trainer', manageUrl
      });
    } catch (emailErr) {
      console.error('Booker email failed (non-fatal):', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      appointmentId: created.id,
      joinUrl: created.joinWebUrl,
      meetingTitle,
      manageUrl
    });

  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Failed to create booking', detail: err.message });
  }
};

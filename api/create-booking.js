const TENANT_ID = process.env.BOOKINGS_TENANT_ID;
const CLIENT_ID = process.env.BOOKINGS_CLIENT_ID;
const CLIENT_SECRET = process.env.BOOKINGS_CLIENT_SECRET;
const CALENDAR_ID = process.env.BOOKINGS_CALENDAR_ID;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    buildName,
    customerEmail,
    customerName,
    serviceId,
    staffId,
    startDateTime,
    endDateTime,
    sessionNotes,
    bookedBy,
    bookerEmail,
    sfId,
    duration
  } = req.body;

  if (!buildName || !customerEmail || !customerName || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const cleanBuildName = buildName.replace(/\s*\(.*?\)\s*/g, '').trim();
  const date = new Date(startDateTime);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const meetingTitle = `${dateStr} COE Consult — ${cleanBuildName} — ${customerEmail} — ${customerName}`;

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
      "additionalInformation": `Booked by: ${bookedBy} (${bookerEmail}) | Salesforce ID: ${sfId}`,
      ...(staffId && staffId !== 'any' ? { "staffMemberIds": [staffId] } : {}),
      "customers": [{
        "@odata.type": "#microsoft.graph.bookingCustomerInformation",
        "name": customerName,
        "emailAddress": customerEmail,
        "customQuestionAnswers": [
          {
            "questionId": "03e23d5a-53a0-47c8-a7cb-fc8b0167b158",
            "question": "Booked By",
            "answer": bookedBy
          },
          {
            "questionId": "41052a65-937a-416f-b195-61db550e914b",
            "question": "Session Notes",
            "answer": sessionNotes || ''
          },
          {
            "questionId": "96ecbb6b-11e8-491c-a7bb-fe07bd256d2f",
            "question": "Customer Contact Email",
            "answer": customerEmail
          },
          {
            "questionId": "b1e4da1c-e7dc-47da-84a4-3dcb9e2f646b",
            "question": "Build Name",
            "answer": cleanBuildName
          },
          {
            "questionId": "30d42ee1-d12f-4402-a6bb-da55e719096c",
            "question": "Salesforce Account ID",
            "answer": sfId || ''
          }
        ]
      }]
    };

    console.error('Sending to Bookings:', JSON.stringify(appointment));

    const bookingsRes = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${CALENDAR_ID}/appointments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(appointment)
      }
    );

    if (!bookingsRes.ok) {
      const errText = await bookingsRes.text();
      console.error('Bookings API error:', bookingsRes.status, errText);
      return res.status(500).json({ error: 'Failed to create booking', detail: errText, status: bookingsRes.status });
    }

    const created = await bookingsRes.json();
    return res.status(200).json({
      success: true,
      appointmentId: created.id,
      joinUrl: created.joinWebUrl,
      meetingTitle
    });

  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Failed to create booking', detail: err.message });
  }
}

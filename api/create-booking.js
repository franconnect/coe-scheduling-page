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

  // Validate required fields
  if (!buildName || !customerEmail || !customerName || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Build meeting title in the format Power Automate expects
  const date = new Date(startDateTime);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const meetingTitle = `${dateStr} COE Consult — ${buildName} — ${customerEmail} — ${customerName}`;

  try {
    const token = await getAccessToken();

    const appointment = {
      "@odata.type": "#microsoft.graph.bookingAppointment",
      "serviceName": meetingTitle,
      "serviceId": serviceId,
      "customerName": customerName,
      "customerEmailAddress": customerEmail,
      "customerNotes": sessionNotes || '',
      "isLocationOnline": true,
      "start": {
        "@odata.type": "#microsoft.graph.dateTimeTimeZone",
        "dateTime": startDateTime,
        "timeZone": "UTC"
      },
      "end": {
        "@odata.type": "#microsoft.graph.dateTimeTimeZone",
        "dateTime": endDateTime,
        "timeZone": "UTC"
      },
      "additionalInformation": `Booked by: ${bookedBy} (${bookerEmail}) | Salesforce ID: ${sfId} | Session notes: ${sessionNotes}`,
      "staffMemberIds": staffId && staffId !== 'any' ? [staffId] : []
    };

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
      const err = await bookingsRes.json();
      console.error('Bookings API error:', err);
      return res.status(500).json({ error: 'Failed to create booking' });
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
    return res.status(500).json({ error: 'Failed to create booking' });
  }
}

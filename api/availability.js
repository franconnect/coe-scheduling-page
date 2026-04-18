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
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { start, end, serviceId, staffId } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end dates required' });
  }

  try {
    const token = await getAccessToken();

    // Build URL for Bookings calendar view
    let url = `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${CALENDAR_ID}/calendarView?start=${start}&end=${end}`;

    const bookingsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await bookingsRes.json();

    // Return busy slots so the front end knows what to mark unavailable
    const busySlots = (data.value || []).map(appt => ({
      start: appt.start?.dateTime,
      end: appt.end?.dateTime,
      staffId: appt.staffMemberIds?.[0]
    }));

    return res.status(200).json({ busySlots });

  } catch (err) {
    console.error('Bookings availability error:', err);
    // Return empty until credentials are available
    return res.status(200).json({ busySlots: [] });
  }
}

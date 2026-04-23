const TENANT_ID = process.env.BOOKINGS_TENANT_ID;
const CLIENT_ID = process.env.BOOKINGS_CLIENT_ID;
const CLIENT_SECRET = process.env.BOOKINGS_CLIENT_SECRET;
const CALENDAR_ID = process.env.BOOKINGS_CALENDAR_ID;

const STAFF_IDS = [
  '93746261-a0e8-4a2c-b3d9-c345626aa1aa', // Frank
  '09c5c966-6e81-4104-b093-80d496d1a5e4', // Monica
  'bbb5a53a-96b8-4f68-890b-05ab765b8bc4'  // Sherry
];

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

  const { start, end, staffId } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'start and end dates required' });
  }

  try {
    const token = await getAccessToken();

    // Use getStaffAvailability for accurate timezone-aware availability
    const staffIds = staffId && staffId !== 'any' ? [staffId] : STAFF_IDS;

    const availRes = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${CALENDAR_ID}/getStaffAvailability`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          staffIds,
          startDateTime: { dateTime: start, timeZone: 'UTC' },
          endDateTime: { dateTime: end, timeZone: 'UTC' }
        })
      }
    );

    const data = await availRes.json();
    console.error('Staff availability raw:', JSON.stringify(data));

    // Build busy slots from unavailable windows
    const busySlots = [];
    for (const staffMember of (data.value || [])) {
      for (const slot of (staffMember.availabilityItems || [])) {
        if (slot.status !== 'available') {
          busySlots.push({
            start: slot.startDateTime?.dateTime,
            end: slot.endDateTime?.dateTime,
            staffId: staffMember.staffId
          });
        }
      }
    }

    return res.status(200).json({ busySlots });

  } catch (err) {
    console.error('Bookings availability error:', err);
    return res.status(200).json({ busySlots: [] });
  }
}

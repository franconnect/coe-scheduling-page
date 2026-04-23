const TENANT_ID = process.env.BOOKINGS_TENANT_ID;
const CLIENT_ID = process.env.BOOKINGS_CLIENT_ID;
const CLIENT_SECRET = process.env.BOOKINGS_CLIENT_SECRET;
const CALENDAR_ID = process.env.BOOKINGS_CALENDAR_ID;
const FRANK_ID = '93746261-a0e8-4a2c-b3d9-c345626aa1aa';

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
  try {
    const token = await getAccessToken();
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${CALENDAR_ID}/staffMembers/${FRANK_ID}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timeZone: 'America/Phoenix' })
      }
    );
    const data = await r.text();
    return res.status(r.status).json({ status: r.status, response: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

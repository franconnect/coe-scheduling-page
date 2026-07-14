const TENANT_ID = process.env.BOOKINGS_TENANT_ID;
const CLIENT_ID = process.env.BOOKINGS_CLIENT_ID;
const CLIENT_SECRET = process.env.BOOKINGS_CLIENT_SECRET;
const CALENDAR_ID = process.env.BOOKINGS_CALENDAR_ID;
const CUSTOMER_EMAIL_QUESTION_ID = '96ecbb6b-11e8-491c-a7bb-fe07bd256d2f';

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

  const { id, date } = req.query;
  if (!id || !date) {
    return res.status(400).json({ error: 'Account ID and date required' });
  }

  try {
    const token = await getAccessToken();

    // Query appointments for the given date (search a 24-hour window)
    const startDate = new Date(`${date}T00:00:00Z`);
    const endDate = new Date(`${date}T23:59:59Z`);

    const apptRes = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${CALENDAR_ID}/appointments?$filter=startDateTime/dateTime ge '${startDate.toISOString()}' and startDateTime/dateTime le '${endDate.toISOString()}'`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!apptRes.ok) {
      const errText = await apptRes.text();
      console.error('Bookings query error:', apptRes.status, errText);
      return res.status(500).json({ error: 'Failed to query appointments' });
    }

    const apptData = await apptRes.json();
    const appointments = apptData.value || [];
    console.error(`Found ${appointments.length} appointments on ${date}`);

    // Find appointment matching the Account ID in additionalInformation
    const match = appointments.find(a => {
      const info = a.additionalInformation || '';
      return info.includes(`SF ID: ${id}`);
    });

    if (!match) {
      console.error(`No appointment found for Account ID ${id} on ${date}`);
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Extract customer email from custom question answers
    const customers = match.customers || [];
    let customerEmail = null;
    let customerName = null;

    for (const customer of customers) {
      const answers = customer.customQuestionAnswers || [];
      const emailAnswer = answers.find(a => a.questionId === CUSTOMER_EMAIL_QUESTION_ID);
      if (emailAnswer?.answer) {
        customerEmail = emailAnswer.answer;
        customerName = customer.name;
        break;
      }
    }

    if (!customerEmail) {
      // Fallback to first customer email address
      customerEmail = customers[0]?.emailAddress || null;
      customerName = customers[0]?.name || null;
    }

    console.error(`Found customer email: ${customerEmail}`);

    return res.status(200).json({
      customerEmail,
      customerName,
      appointmentId: match.id,
      startDateTime: match.startDateTime?.dateTime
    });

  } catch (err) {
    console.error('Get appointment error:', err);
    return res.status(500).json({ error: 'Failed to get appointment', detail: err.message });
  }
}

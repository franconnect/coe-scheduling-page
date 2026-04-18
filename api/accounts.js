const INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL;
const CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const USERNAME = process.env.SALESFORCE_USERNAME;
const PASSWORD = process.env.SALESFORCE_PASSWORD;

async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    username: USERNAME,
    password: PASSWORD
  });

  const res = await fetch(`${INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get Salesforce token');
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.status(200).json({ accounts: [] });
  }

  try {
    const token = await getAccessToken();

    const query = `SELECT Id, Name, Build_Name__c FROM Account WHERE Name LIKE '%${q.replace(/'/g, "\\'")}%' ORDER BY Name LIMIT 20`;
    const encoded = encodeURIComponent(query);

    const sfRes = await fetch(`${INSTANCE_URL}/services/data/v58.0/query?q=${encoded}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await sfRes.json();

    const accounts = (data.records || []).map(r => ({
      name: r.Name,
      sfId: r.Id,
      buildName: r.Build_Name__c || r.Name
    }));

    return res.status(200).json({ accounts });

  } catch (err) {
    console.error('Salesforce error:', err);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }
}

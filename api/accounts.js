export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.status(200).json({ accounts: [] });
  }

  try {
    // Get SharePoint access token using existing credentials
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.BOOKINGS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.BOOKINGS_CLIENT_ID,
          client_secret: process.env.BOOKINGS_CLIENT_SECRET,
          scope: 'https://graph.microsoft.com/.default'
        }).toString()
      }
    );

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Failed to get token');

    // Fetch the CSV file from SharePoint
    const fileRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/francon1062.sharepoint.com:/sites/franconnectuniversity:/drive/root:/account-list.csv:/content`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      }
    );

    if (!fileRes.ok) throw new Error('Failed to fetch account list from SharePoint');

    const csvText = await fileRes.text();

    // Parse CSV
    const lines = csvText.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const accountNameIdx = headers.findIndex(h => h.toLowerCase().includes('account name'));
    const buildNameIdx = headers.findIndex(h => h.toLowerCase().includes('build name'));

    if (accountNameIdx === -1 || buildNameIdx === -1) {
      throw new Error('CSV missing required columns: Account Name, Build Name');
    }

    const searchLower = q.toLowerCase();

    const accounts = lines.slice(1)
      .map(line => {
        // Handle quoted CSV fields
        const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',');
        const name = (cols[accountNameIdx] || '').trim().replace(/"/g, '');
        const buildName = (cols[buildNameIdx] || '').trim().replace(/"/g, '');
        return { name, buildName };
      })
      .filter(a => 
        a.name && 
        a.buildName && 
        a.name.toLowerCase().includes(searchLower)
      )
      .map(a => ({
        name: a.name,
        sfId: a.buildName, // using buildName as identifier since no SF API
        buildName: a.buildName.replace(/\s*\(.*?\)\s*/g, '').trim()
      }))
      .slice(0, 20);

    return res.status(200).json({ accounts });

  } catch (err) {
    console.error('Account list error:', err);
    return res.status(500).json({ error: 'Failed to fetch account list' });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.status(200).json({ accounts: [] });
  }

  try {
    const fileRes = await fetch(
      'https://francon1062.sharepoint.com/:x:/s/franconnectuniversity/IQA6CzvquAsJTLIw_tkRBefDAYyOBjaY7hGM6D1V9aejxgM?e=bnI3Hd&download=1'
    );
if (!fileRes.ok) {
  console.error('SharePoint fetch failed:', fileRes.status, fileRes.statusText, await fileRes.text());
  throw new Error('Failed to fetch account list');
}
    const csvText = await fileRes.text();
    const lines = csvText.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const accountNameIdx = headers.findIndex(h => h.toLowerCase().includes('account name'));
    const buildNameIdx = headers.findIndex(h => h.toLowerCase().includes('build name'));

    if (accountNameIdx === -1 || buildNameIdx === -1) {
      throw new Error('CSV missing required columns');
    }

    const searchLower = q.toLowerCase();

    const accounts = lines.slice(1)
      .map(line => {
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
        sfId: a.buildName,
        buildName: a.buildName.replace(/\s*\(.*?\)\s*/g, '').trim()
      }))
      .slice(0, 20);

    return res.status(200).json({ accounts });

  } catch (err) {
    console.error('Account list error:', err);
    return res.status(500).json({ error: 'Failed to fetch account list' });
  }
}

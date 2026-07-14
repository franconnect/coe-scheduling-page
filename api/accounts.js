const UNFILED_URL = 'https://francon1062.sharepoint.com/:f:/s/franconnectuniversity/IgC4UtG01zezQqG-OSYftEo_AV8qzGGMR2YVlqbHbhBlRTM?e=IiYxRg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.status(200).json({ accounts: [] });
  }

  try {
    const fileRes = await fetch(
      'https://raw.githubusercontent.com/franconnect/coe-scheduling-page/main/account-list.csv'
    );
    if (!fileRes.ok) throw new Error('Failed to fetch account list');

    const csvText = await fileRes.text();
    const lines = csvText.split('\n').filter(l => l.trim());
    // Skip header
    const accounts = lines.slice(1)
      .map(line => {
        const cols = line.split(',');
        // Handle quoted fields
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
          else { current += char; }
        }
        parts.push(current.trim());

        const name = parts[0]?.replace(/"/g, '').trim();
        const sfId = parts[1]?.replace(/"/g, '').trim();
        const folderUrl = parts[2]?.replace(/"/g, '').trim() || UNFILED_URL;

        return { name, sfId, folderUrl };
      })
      .filter(a => a.name && a.sfId && a.name.toLowerCase().includes(q.toLowerCase()));

    return res.status(200).json({ accounts: accounts.slice(0, 10) });

  } catch (err) {
    console.error('Accounts error:', err);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

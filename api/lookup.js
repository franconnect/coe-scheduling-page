const UNFILED_URL = 'https://francon1062.sharepoint.com/:f:/s/franconnectuniversity/IgC4UtG01zezQqG-OSYftEo_AV8qzGGMR2YVlqbHbhBlRTM?e=IiYxRg';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Account ID required' });

  try {
    const fileRes = await fetch(
      'https://raw.githubusercontent.com/franconnect/coe-scheduling-page/main/account-list.csv'
    );
    if (!fileRes.ok) throw new Error('Failed to fetch account list');

    const csvText = await fileRes.text();
    const lines = csvText.split('\n').filter(l => l.trim());

    for (const line of lines.slice(1)) {
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

      if (sfId === id) {
        return res.status(200).json({ name, sfId, folderUrl });
      }
    }

    // Not found — return unfiled
    console.error('Account not found for ID:', id, '— routing to Unfiled');
    return res.status(200).json({ name: 'Unknown', sfId: id, folderUrl: UNFILED_URL });

  } catch (err) {
    console.error('Lookup error:', err);
    return res.status(500).json({ error: 'Failed to lookup account' });
  }
};
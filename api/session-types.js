export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const fileRes = await fetch(
      'https://raw.githubusercontent.com/franconnect/coe-scheduling-page/main/session-types.csv'
    );
    if (!fileRes.ok) throw new Error('Failed to fetch session types');

    const csvText = await fileRes.text();
    const lines = csvText.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const moduleIdx = headers.indexOf('Module');
    const nameIdx = headers.indexOf('Course Name');
    const durationIdx = headers.indexOf('Duration Minutes');
    const trainersIdx = headers.indexOf('Trainers');
    const trainerIdsIdx = headers.indexOf('Trainer IDs');

    const courses = lines.slice(1).map(line => {
      // Handle quoted fields with commas inside
      const cols = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
        else { current += char; }
      }
      cols.push(current.trim());

      const trainerIdsRaw = (cols[trainerIdsIdx] || '').replace(/"/g, '').trim();
      return {
        module: (cols[moduleIdx] || '').replace(/"/g, '').trim(),
        name: (cols[nameIdx] || '').replace(/"/g, '').trim(),
        duration: parseInt((cols[durationIdx] || '60').trim()),
        trainers: (cols[trainersIdx] || '').replace(/"/g, '').trim(),
        trainerIds: trainerIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
      };
    }).filter(c => c.name);

    // Group by module
    const modules = {};
    courses.forEach(c => {
      if (!modules[c.module]) modules[c.module] = [];
      modules[c.module].push(c);
    });

    return res.status(200).json({ modules, courses });

  } catch (err) {
    console.error('Session types error:', err);
    return res.status(500).json({ error: 'Failed to fetch session types' });
  }
}

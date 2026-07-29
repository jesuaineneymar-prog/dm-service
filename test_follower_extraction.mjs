import ZAI from 'z-ai-web-dev-sdk';

const zai = await ZAI.create();

async function getIGFollowers(username) {
  const results = await zai.functions.invoke('web_search', {
    query: `instagram.com/${username} followers`,
    num: 3
  });
  
  for (const item of results) {
    const s = item.snippet || '';
    const patterns = [
      /(\d[\d,.]*[MK]?)\s*(?:Instagram\s*)?followers/i,
      /(\d[\d,.]*[MK]?)\s*seguidores/i,
    ];
    for (const pat of patterns) {
      const m = s.match(pat);
      if (m) return { username, count: m[1], source: s.substring(0, 120) };
    }
  }
  return { username, count: null, source: results[0]?.snippet?.substring(0, 100) || 'no snippet' };
}

const users = ['cristiano', 'leomessi', 'neymarjr'];
for (const u of users) {
  const r = await getIGFollowers(u);
  console.log(`@${r.username}: ${r.count || 'NOT FOUND'} | ${r.source}`);
}

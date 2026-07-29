import ZAI from 'z-ai-web-dev-sdk';

const zai = await ZAI.create();

async function getFollowers(username, platform) {
  const domain = platform === 'instagram' ? 'instagram.com' : 'facebook.com';
  const results = await zai.functions.invoke('web_search', {
    query: `${domain}/${username} followers likes`,
    num: 3
  });
  
  for (const item of results) {
    const s = item.snippet || '';
    const patterns = [
      /(\d[\d,.]*[MK]?)\s*(?:Instagram\s*)?(?:followers|Followers)/i,
      /(\d[\d,.]*[MK]?)\s*(?:likes|Likes|seguidores|people(?:\s+follow))/i,
    ];
    for (const pat of patterns) {
      const m = s.match(pat);
      if (m) return { username, platform, count: m[1], source: s.substring(0, 150) };
    }
  }
  return { username, platform, count: null, source: results[0]?.snippet?.substring(0, 120) || 'no snippet' };
}

// Test with some random smaller accounts
const tests = [
  ['angola_negocios', 'instagram'],
  ['empresariosangola', 'facebook'],
  ['angola_business', 'instagram'],
];

for (const [u, p] of tests) {
  const r = await getFollowers(u, p);
  console.log(`${p} @${r.username}: ${r.count || 'NOT FOUND'} | ${r.source}`);
}

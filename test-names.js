const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    const standings = await fetchUrl('https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings');
    if (standings?.children) {
      standings.children.forEach(group => {
        console.log(`--- ${group.name} ---`);
        group.standings?.entries?.forEach(entry => {
          console.log(`Team: "${entry.team?.displayName}" (ID: ${entry.team?.id})`);
        });
      });
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();

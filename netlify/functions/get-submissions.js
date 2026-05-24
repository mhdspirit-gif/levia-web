// netlify/functions/get-submissions.js
// Proxy sécurisé pour lire les soumissions Netlify Forms

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // Auth
  const auth = event.headers['x-dashboard-auth'] || '';
  const pass = process.env.DASHBOARD_PASS || 'Levia2025!';
  if (auth !== pass) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorisé' }) };

  const token  = process.env.NETLIFY_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Variables manquantes: NETLIFY_TOKEN, NETLIFY_SITE_ID' }) };

  try {
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const req = https.get(
        `https://api.netlify.com/api/v1/sites/${siteId}/submissions?per_page=500`,
        { headers: { 'Authorization': `Bearer ${token}` } },
        res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve({ status: res.statusCode, body: d }));
        }
      );
      req.on('error', reject);
    });
    if (data.status !== 200) return { statusCode: data.status, headers, body: data.body };
    return { statusCode: 200, headers, body: data.body };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

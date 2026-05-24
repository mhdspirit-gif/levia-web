// netlify/functions/export-dataset.js
// Génère le dataset IA Lévia depuis toutes les soumissions Netlify Forms

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Auth
  const auth = event.headers['x-dashboard-auth'] || '';
  const pass = process.env.DASHBOARD_PASS || 'Levia2025!';
  if (auth !== pass) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorisé' }) };
  }

  const token  = process.env.NETLIFY_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Variables manquantes' }) };
  }

  try {
    const https = require('https');

    // Récupérer toutes les soumissions
    const data = await new Promise((resolve, reject) => {
      const req = https.get(
        `https://api.netlify.com/api/v1/sites/${siteId}/submissions?per_page=500`,
        { headers: { 'Authorization': `Bearer ${token}` } },
        res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve(JSON.parse(d)));
        }
      );
      req.on('error', reject);
    });

    // Mapping routine_key depuis type_peau + concern
    function getRoutineKey(skin, concern) {
      const map = {
        'oily_acne': 'oily_acne', 'oily_glow': 'oily_glow',
        'oily_dryness': 'dry_dryness', 'oily_aging': 'mature_aging',
        'dry_dryness': 'dry_dryness', 'dry_aging': 'dry_aging',
        'dry_acne': 'dry_dryness', 'dry_glow': 'oily_glow',
        'sensitive_dryness': 'sensitive_dryness', 'sensitive_acne': 'sensitive_dryness',
        'sensitive_aging': 'mature_aging', 'sensitive_glow': 'sensitive_dryness',
        'mature_aging': 'mature_aging', 'mature_dryness': 'dry_aging',
        'mature_acne': 'oily_acne', 'mature_glow': 'mature_aging'
      };
      return map[`${skin}_${concern}`] || 'oily_acne';
    }

    // Scores par routine
    const SCORES = {
      'oily_acne': 81, 'oily_glow': 78, 'dry_dryness': 74,
      'dry_aging': 82, 'sensitive_dryness': 72, 'mature_aging': 85
    };

    // Construire le dataset
    let validCount = 0;
    const dataset = [];

    data.forEach((s, i) => {
      const d = s.data || {};
      const skin   = d.skin_type || '';
      const concern = d.concern || '';
      const age    = d.age || d.age_range || '';
      const genre  = d.gender || '';
      const lifestyle = d.lifestyle || '';
      const pays   = d.country || 'UK';
      const photoUrl = d.photo_url || '';
      const photoConsent = d.photo_consent || 'no';

      // Ignorer les entrées incomplètes
      if (!skin || !concern || !age) return;

      const routineKey = getRoutineKey(skin, concern);
      const score = parseInt(d.score || d.skin_score) || SCORES[routineKey];

      const entry = {
        id: String(i + 1).padStart(4, '0'),
        input: {
          genre,
          age,
          lifestyle,
          pays,
          // Photo uniquement si consentement donné
          ...(photoUrl && photoConsent === 'yes' ? { photo_url: photoUrl } : {})
        },
        output: {
          type_peau: skin,
          concern,
          routine_key: routineKey,
          score
        },
        meta: {
          date: s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : '',
          has_photo: photoUrl && photoConsent === 'yes' ? true : false
        }
      };

      dataset.push(entry);
      validCount++;
    });

    // Stats du dataset
    const stats = {
      total: validCount,
      with_photo: dataset.filter(e => e.meta.has_photo).length,
      by_routine: {},
      by_pays: {},
      by_age: {}
    };

    dataset.forEach(e => {
      stats.by_routine[e.output.routine_key] = (stats.by_routine[e.output.routine_key] || 0) + 1;
      stats.by_pays[e.input.pays] = (stats.by_pays[e.input.pays] || 0) + 1;
      stats.by_age[e.input.age] = (stats.by_age[e.input.age] || 0) + 1;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ dataset, stats })
    };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

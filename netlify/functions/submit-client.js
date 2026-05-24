// netlify/functions/submit-client.js
// Reçoit les données du scan, stocke la photo sur Cloudinary, envoie l'email

const https = require('https');

// ── Helpers ──
function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsPostForm(url, formBody, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(formBody), ...headers }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(formBody);
    req.end();
  });
}

// ── Upload photo sur Cloudinary ──
async function uploadToCloudinary(base64Photo, clientName) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret || !base64Photo) return null;

  // Extraire le base64 pur (supprimer le préfixe data:image/...;base64,)
  let photoData = base64Photo;
  if (base64Photo.includes(';base64,')) {
    photoData = base64Photo.split(';base64,')[1];
  }
  // Ajouter le préfixe Cloudinary pour upload base64
  const fileData = 'data:image/jpeg;base64,' + photoData;

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = 'levia-clients';
  const publicId  = 'client-' + Date.now() + '-' + (clientName || 'anonymous').replace(/\s+/g, '-').toLowerCase();

  // Signature SHA1
  const crypto = require('crypto');
  const sigString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(sigString).digest('hex');

  const formParts = [
    `file=${encodeURIComponent(fileData)}`,
    `api_key=${apiKey}`,
    `timestamp=${timestamp}`,
    `folder=${encodeURIComponent(folder)}`,
    `public_id=${encodeURIComponent(publicId)}`,
    `signature=${signature}`
  ].join('&');

  try {
    const r = await httpsPostForm(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formParts, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    const json = JSON.parse(r.body);
    if (json.error) {
      console.error('Cloudinary error:', json.error.message);
      return null;
    }
    console.log('Cloudinary upload OK:', json.secure_url);
    return json.secure_url || null;
  } catch(e) {
    console.error('Cloudinary error:', e.message);
    return null;
  }
}

// ── Envoyer email via Resend ──
async function sendEmail(client, photoUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const scoreColor = client.score >= 80 ? '#2D7A4F' : client.score >= 65 ? '#8B6A20' : '#C0392B';
  const photoHtml = photoUrl
    ? `<tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">PHOTO</b><a href="${photoUrl}" target="_blank"><img src="${photoUrl}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;border:2px solid #C9A96E;" /></a></td></tr>`
    : `<tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">PHOTO</b><span style="color:#9B8574;">Aucune photo fournie</span></td></tr>`;

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:30px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E8DDD0;">
  <!-- HEADER -->
  <tr><td style="background:#0D0900;padding:28px 32px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:32px;letter-spacing:6px;color:#C9A96E;">LÉVIA</div>
    <div style="font-size:11px;letter-spacing:3px;color:rgba(201,169,110,0.45);margin-top:4px;">NOUVELLE CLIENTE</div>
  </td></tr>
  <!-- SCORE -->
  <tr><td style="padding:24px 32px;text-align:center;background:#FAF7F2;border-bottom:1px solid #E8DDD0;">
    <div style="font-family:Georgia,serif;font-size:56px;font-weight:700;color:${scoreColor};line-height:1;">${client.score || '—'}</div>
    <div style="font-size:11px;letter-spacing:2px;color:#9B8574;margin-top:4px;">SKIN SCORE</div>
    <div style="margin-top:8px;display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(201,169,110,0.12);border:1px solid rgba(201,169,110,0.3);color:#8B6A20;font-size:12px;font-weight:600;">${client.routine_type || '—'}</div>
  </td></tr>
  <!-- FICHE -->
  <tr><td style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">PRÉNOM</b><span style="font-size:15px;font-weight:600;color:#2A1F0E;">${client.name || '—'}</span></td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">EMAIL</b><a href="mailto:${client.email}" style="font-size:14px;color:#8B6A20;text-decoration:none;">${client.email || '—'}</a></td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">GENRE · ÂGE</b><span style="font-size:13px;color:#2A1F0E;">${client.gender || '—'} · ${client.age || '—'}</span></td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">TYPE DE PEAU</b><span style="font-size:13px;color:#2A1F0E;">${client.skin_type || '—'}</span></td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">CONCERN PRINCIPAL</b><span style="font-size:13px;color:#2A1F0E;">${client.concern || '—'}</span></td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">LIFESTYLE</b><span style="font-size:13px;color:#2A1F0E;">${client.lifestyle || '—'}</span></td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">PAYS · LANGUE</b><span style="font-size:13px;color:#2A1F0E;">${client.country || '—'} · ${client.lang || '—'}</span></td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #E8DDD0;"><b style="color:#9B8574;font-size:11px;letter-spacing:1px;display:block;margin-bottom:4px;">PHOTO CONSENTIE</b><span style="font-size:13px;color:${client.photo_consent === 'yes' ? '#2D7A4F' : '#9B8574'};font-weight:600;">${client.photo_consent === 'yes' ? '✓ Oui' : 'Non'}</span></td></tr>
      ${photoHtml}
    </table>
  </td></tr>
  <!-- CTA -->
  <tr><td style="padding:20px 32px;text-align:center;background:#FAF7F2;">
    <a href="mailto:${client.email}?subject=Votre routine Lévia personnalisée ✨&body=Bonjour ${client.name || ''},%0D%0A%0D%0AMerci d'avoir utilisé Lévia !" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#8B6A20,#C9A96E);color:#1A1208;border-radius:10px;font-weight:700;font-size:13px;text-decoration:none;">📧 Répondre à ${client.name || 'cette cliente'}</a>
  </td></tr>
  <!-- FOOTER -->
  <tr><td style="padding:16px 32px;text-align:center;border-top:1px solid #E8DDD0;">
    <div style="font-size:10px;color:#9B8574;letter-spacing:0.5px;">Lévia Skincare AI · ${new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  try {
    const r = await httpsPost('https://api.resend.com/emails', {
      from: 'Lévia Dashboard <onboarding@resend.dev>',
      to: [process.env.ADMIN_EMAIL || 'mhd.spirit@gmail.com'],
      subject: `✨ Nouvelle cliente Lévia — ${client.name || client.email} · Score ${client.score || '?'}`,
      html
    }, { 'Authorization': `Bearer ${apiKey}` });
    return r.status < 300;
  } catch(e) {
    console.error('Email error:', e.message);
    return false;
  }
}

// ── HANDLER PRINCIPAL ──
exports.handler = async function(event) {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { client, photo } = body; // photo = base64 data URL

    // 1. Upload photo sur Cloudinary
    let photoUrl = null;
    if (photo && client.photo_consent === 'yes') {
      photoUrl = await uploadToCloudinary(photo, client.name);
    }

    // 2. Envoyer email
    const emailSent = await sendEmail({ ...client, photo_url: photoUrl }, photoUrl);

    // 3. Sauvegarder dans Netlify Forms (via fetch interne)
    // Ça se fait côté client via le formulaire HTML — pas besoin ici

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emailSent,
        photoUrl,
        message: emailSent ? 'Fiche client envoyée ✓' : 'Données reçues (email non configuré)'
      })
    };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

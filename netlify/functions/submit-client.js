// netlify/functions/submit-client.js
const https = require('https');

// ── Routines complètes ──
const ROUTINES = {
  oily_acne: {
    label:'Clear & Balanced', score:81, type:'Oily · Blemish-prone',
    metrics:{hydration:74,sensitivity:78,glow:75,barrier:66},
    morning:[
      {name:'BHA Gel Cleanser',detail:'CeraVe SA Cleanser · Lukewarm water',why:'Salicylic acid dissolves excess sebum in pores.'},
      {name:'Niacinamide 10% + Zinc',detail:'The Ordinary · 3-4 drops · 60 sec',why:'Regulates sebum, tightens pores, fades marks.'},
      {name:'Oil-free Gel Moisturiser',detail:'Neutrogena Hydro Boost Gel',why:'Oily skin still needs hydration.'},
      {name:'SPF 50+ Fluid',detail:'La Roche-Posay Anthelios',why:'UV worsens acne scars by 40%.'}],
    evening:[
      {name:'Double Cleanse',detail:'Oil cleanser first, then gel'},
      {name:'BHA Exfoliant 2%',detail:"Paula's Choice · 3x/week",why:'Clears blackheads deep in pores.'},
      {name:'Light Moisturiser',detail:'CeraVe PM · Repair overnight'}]
  },
  oily_glow: {
    label:'Bright & Even', score:78, type:'Oily · Pigmentation',
    metrics:{hydration:76,sensitivity:80,glow:85,barrier:70},
    morning:[
      {name:'Gentle Gel Cleanser',detail:'Cool water rinse'},
      {name:'Vitamin C 15%',detail:'Mad Hippie · 4 drops dry skin',why:'Blocks melanin + protects from UV.'},
      {name:'Niacinamide Serum',detail:'The Ordinary',why:'Synergistic with Vit C — double anti-pigment.'},
      {name:'SPF 50+',detail:'La Roche-Posay Anthelios · Every day'}],
    evening:[
      {name:'Double Cleanse',detail:'Remove SPF, pollution, sebum'},
      {name:'Glycolic Acid 7%',detail:'The Ordinary · 3x/week',why:'Speeds cell turnover.'},
      {name:'Niacinamide + Light Cream',detail:'Seal and repair overnight'}]
  },
  dry_dryness: {
    label:'Nourished & Fortified', score:74, type:'Dry · Dehydrated',
    metrics:{hydration:58,sensitivity:72,glow:68,barrier:62},
    morning:[
      {name:'Cream Cleanser',detail:'CeraVe Hydrating · Lukewarm only',why:'Preserves the lipid barrier.'},
      {name:'Hyaluronic Acid',detail:'The Ordinary HA 2%+B5 · Damp skin',why:'Apply on damp — not dry — skin.'},
      {name:'Rich Ceramide Cream',detail:'CeraVe Moisturising Cream',why:'Ceramides rebuild the corneal layer.'},
      {name:'Rich SPF 50',detail:'Uriage Bariésun Rich Cream'}],
    evening:[
      {name:'Gentle Oil Cleanser',detail:'No SLS, no fragrance'},
      {name:'Bakuchiol Serum',detail:'Biossance · Every night safe',why:'Natural retinol — no irritation.'},
      {name:'Overnight Sleeping Mask',detail:'Laneige Water Mask 3-4 nights/week'}]
  },
  dry_aging: {
    label:'Plumped & Lifted', score:82, type:'Dry · Anti-ageing',
    metrics:{hydration:66,sensitivity:78,glow:76,barrier:68},
    morning:[
      {name:'Cream Cleanser',detail:'Cetaphil Gentle · Lukewarm only'},
      {name:'Vitamin C 15%',detail:'SkinCeuticals CE Ferulic',why:'Collagen + UV protection — #1 anti-age step.'},
      {name:'Peptide-rich Cream',detail:'Olay Regenerist',why:'Signals fibroblasts to produce collagen.'},
      {name:'Rich SPF 50',detail:'La Roche-Posay Anthelios Age Correct'}],
    evening:[
      {name:'Gentle Oil Cleanser',detail:'No stripping'},
      {name:'Bakuchiol 0.5%',detail:'Every night',why:'Retinol results without dryness.'},
      {name:'Overnight Hydration Mask',detail:'Laneige Water Sleeping Mask · 3-4 nights/week'}]
  },
  sensitive_dryness: {
    label:'Calm & Restored', score:72, type:'Sensitive · Reactive',
    metrics:{hydration:65,sensitivity:88,glow:64,barrier:58},
    morning:[
      {name:'Thermal Water Spray',detail:'Avène or La Roche-Posay · No cleanser AM',why:'Cleansing twice strips fragile microbiome.'},
      {name:'Centella + Ectoin Serum',detail:'COSRX Centella · Pat gently',why:'Creates molecular hydration shield.'},
      {name:'Barrier Repair Cream',detail:'Avène Cicalfate+ · Fragrance-free',why:'Fewer ingredients = less to react to.'},
      {name:'Mineral SPF 50',detail:'Zinc oxide only · No chemical filters'}],
    evening:[
      {name:'Micellar Water',detail:'Bioderma Sensibio · No rinse needed'},
      {name:'Probiotic Serum',detail:'Dr.Jart Cicapair',why:'Balanced microbiome = stronger skin defense.'},
      {name:'Rich Barrier Cream',detail:'Avène Cicalfate+'}]
  },
  mature_aging: {
    label:'Lifted & Radiant', score:85, type:'Mature · Anti-ageing',
    metrics:{hydration:72,sensitivity:74,glow:82,barrier:72},
    morning:[
      {name:'Gentle Cream Cleanser',detail:'Cetaphil Gentle · No hot water'},
      {name:'Vitamin C 15-20%',detail:'SkinCeuticals CE Ferulic',why:'Collagen production + antioxidant shield.'},
      {name:'Peptide Moisturiser',detail:'Olay Regenerist Micro-Sculpting',why:'Activates fibroblasts for natural firming.'},
      {name:'SPF 50+ Anti-age',detail:'La Roche-Posay Anthelios Age Correct',why:'80% of ageing is photo-ageing.'}],
    evening:[
      {name:'Night 1 — AHA Exfoliation',detail:'The Ordinary Glycolic 7%',why:'Resurfaces skin, accelerates cell renewal.'},
      {name:'Night 2 — Retinol 0.3%',detail:'Vichy Liftactiv · Not same night as AHA',why:'Skin cycling = better tolerance.'},
      {name:'Nights 3-4 — Recovery',detail:'Ceramides + HA only',why:'Recovery nights prevent over-sensitisation.'},
      {name:'Eye Contour',detail:'Olay Eyes Retinol 24 · Every night'}]
  }
};

function getRoutineKey(skinType, concern) {
  const map = {
    'oily_acne':'oily_acne','oily_glow':'oily_glow','oily_dryness':'dry_dryness','oily_aging':'mature_aging',
    'dry_dryness':'dry_dryness','dry_aging':'dry_aging','dry_acne':'dry_dryness','dry_glow':'oily_glow',
    'sensitive_dryness':'sensitive_dryness','sensitive_acne':'sensitive_dryness','sensitive_aging':'mature_aging','sensitive_glow':'sensitive_dryness',
    'mature_aging':'mature_aging','mature_dryness':'dry_aging','mature_acne':'oily_acne','mature_glow':'mature_aging'
  };
  return map[`${skinType}_${concern}`] || 'oily_acne';
}

// ── Helpers HTTP ──
function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    req.on('error', reject); req.write(body); req.end();
  });
}

function httpsPostForm(url, formBody, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(formBody), ...headers }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    req.on('error', reject); req.write(formBody); req.end();
  });
}

// ── Upload Cloudinary ──
async function uploadToCloudinary(base64Photo, clientName) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret || !base64Photo) return null;
  let photoData = base64Photo;
  if (base64Photo.includes(';base64,')) photoData = base64Photo.split(';base64,')[1];
  const fileData = 'data:image/jpeg;base64,' + photoData;
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'levia-clients';
  const publicId = 'client-' + Date.now() + '-' + (clientName||'anonymous').replace(/\s+/g,'-').toLowerCase();
  const crypto = require('crypto');
  const sigString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(sigString).digest('hex');
  const formParts = [
    `file=${encodeURIComponent(fileData)}`,`api_key=${apiKey}`,`timestamp=${timestamp}`,
    `folder=${encodeURIComponent(folder)}`,`public_id=${encodeURIComponent(publicId)}`,`signature=${signature}`
  ].join('&');
  try {
    const r = await httpsPostForm(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formParts, {'Content-Type':'application/x-www-form-urlencoded'});
    const json = JSON.parse(r.body);
    if (json.error) { console.error('Cloudinary error:', json.error.message); return null; }
    console.log('Cloudinary upload OK:', json.secure_url);
    return json.secure_url || null;
  } catch(e) { console.error('Cloudinary error:', e.message); return null; }
}

// ── Email ADMIN (interne) ──
async function sendAdminEmail(client, photoUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const scoreColor = client.score >= 80 ? '#2D7A4F' : client.score >= 65 ? '#8B6A20' : '#C0392B';
  const photoHtml = photoUrl
    ? `<a href="${photoUrl}" target="_blank"><img src="${photoUrl}" style="width:100px;height:100px;object-fit:cover;border-radius:10px;border:2px solid #C9A96E;" /></a>`
    : '<span style="color:#9B8574;">Aucune photo</span>';
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#F5F0E8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E8DDD0;">
<tr><td style="background:#0D0900;padding:22px;text-align:center;">
  <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:5px;color:#C9A96E;">LÉVIA</div>
  <div style="font-size:10px;letter-spacing:2px;color:rgba(201,169,110,0.4);margin-top:3px;">NOUVELLE CLIENTE</div>
</td></tr>
<tr><td style="padding:20px 28px;text-align:center;background:#FAF7F2;">
  <div style="font-family:Georgia,serif;font-size:48px;font-weight:700;color:${scoreColor};">${client.score||'—'}</div>
  <div style="font-size:10px;letter-spacing:2px;color:#9B8574;">SKIN SCORE · ${client.routine_type||'—'}</div>
</td></tr>
<tr><td style="padding:20px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:8px 0;border-bottom:1px solid #E8DDD0;font-size:12px;color:#2A1F0E;"><b style="color:#9B8574;font-size:10px;display:block;margin-bottom:2px;">PRÉNOM · EMAIL</b>${client.name||'—'} · <a href="mailto:${client.email}" style="color:#8B6A20;">${client.email||'—'}</a></td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #E8DDD0;font-size:12px;color:#2A1F0E;"><b style="color:#9B8574;font-size:10px;display:block;margin-bottom:2px;">PEAU · CONCERN · LIFESTYLE</b>${client.skin_type||'—'} · ${client.concern||'—'} · ${client.lifestyle||'—'}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #E8DDD0;font-size:12px;color:#2A1F0E;"><b style="color:#9B8574;font-size:10px;display:block;margin-bottom:2px;">PAYS · ÂGE</b>${client.country||'—'} · ${client.age||'—'}</td></tr>
    <tr><td style="padding:10px 0;">${photoHtml}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:14px 28px;text-align:center;background:#FAF7F2;border-top:1px solid #E8DDD0;">
  <a href="https://leviaskincare.com/admin" style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,#8B6A20,#C9A96E);color:#1A1208;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;">Voir dans le dashboard</a>
</td></tr>
</table></td></tr></table></body></html>`;
  try {
    const r = await httpsPost('https://api.resend.com/emails', {
      from: 'Lévia <hello@leviaskincare.com>',
      to: [process.env.ADMIN_EMAIL || 'mhd.spirit@gmail.com'],
      subject: `✨ Nouvelle cliente — ${client.name||client.email} · Score ${client.score||'?'}`,
      html
    }, { 'Authorization': `Bearer ${apiKey}` });
    console.log('Admin email:', r.status);
    return r.status < 300;
  } catch(e) { console.error('Admin email error:', e.message); return false; }
}

// ── Email CLIENT (routine complète) ──
async function sendClientEmail(client, routine, photoUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !client.email) return false;

  const firstName = client.name ? client.name.split(' ')[0] : 'there';
  const m = routine.metrics;

  // Barre de métrique HTML
  function metricBar(label, val, color) {
    return `<tr><td style="padding:5px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#6B5744;font-weight:500;">${label}</span>
        <span style="font-size:11px;font-weight:700;color:#2A1F0E;">${val}%</span>
      </div>
      <div style="height:5px;background:#F0E8DC;border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${val}%;background:${color};border-radius:999px;"></div>
      </div>
    </td></tr>`;
  }

  // Étapes routine HTML
  function routineSteps(steps, title) {
    const rows = steps.map((s,i) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #F0E8DC;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="min-width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#8B6A20,#C9A96E);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#1A1208;text-align:center;padding-top:2px;">${i+1}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#2A1F0E;margin-bottom:2px;">${s.name}</div>
            <div style="font-size:11px;color:#6B5744;">${s.detail||''}</div>
            ${s.why ? `<div style="font-size:10px;color:#9B8574;margin-top:3px;font-style:italic;">→ ${s.why}</div>` : ''}
          </div>
        </div>
      </td></tr>`).join('');
    return `
      <tr><td style="padding:14px 0 6px;">
        <div style="font-size:10px;letter-spacing:2px;font-weight:700;color:#8B6A20;text-transform:uppercase;border-left:2px solid #C9A96E;padding-left:8px;">${title}</div>
      </td></tr>
      ${rows}`;
  }

  const photoSection = photoUrl
    ? `<tr><td style="padding:14px 0;text-align:center;">
        <img src="${photoUrl}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;border:2px solid #C9A96E;" />
      </td></tr>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:24px 0;"><tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E8DDD0;max-width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#0D0900;padding:28px 32px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:30px;letter-spacing:6px;color:#C9A96E;">LÉVIA</div>
    <div style="font-size:10px;letter-spacing:3px;color:rgba(201,169,110,0.4);margin-top:4px;">YOUR SKIN ANALYSIS</div>
  </td></tr>

  <!-- HERO -->
  <tr><td style="padding:26px 32px 20px;text-align:center;background:linear-gradient(160deg,#FAF7F2,#EEE4D6);">
    ${photoSection}
    <div style="font-family:Georgia,serif;font-size:20px;color:#2A1F0E;margin-bottom:4px;">Hi ${firstName} ✦</div>
    <div style="font-size:13px;color:#6B5744;line-height:1.7;margin-bottom:16px;">Your personalised skin analysis is ready.<br>Here is your Lévia routine crafted just for you.</div>
    
    <!-- Score -->
    <div style="display:inline-block;padding:14px 28px;background:#fff;border-radius:14px;border:1px solid #E8DDD0;margin-bottom:16px;">
      <div style="font-family:Georgia,serif;font-size:42px;font-weight:700;background:linear-gradient(135deg,#8B6A20,#C9A96E);-webkit-background-clip:text;color:#8B6A20;line-height:1;">${routine.score}</div>
      <div style="font-size:9px;letter-spacing:2px;color:#9B8574;margin-top:2px;">SKIN SCORE</div>
      <div style="margin-top:6px;font-size:11px;font-weight:600;color:#8B6A20;">${routine.label}</div>
      <div style="font-size:10px;color:#9B8574;">${routine.type}</div>
    </div>
  </td></tr>

  <!-- MÉTRIQUES -->
  <tr><td style="padding:20px 32px;">
    <div style="font-size:10px;letter-spacing:2px;font-weight:700;color:#8B6A20;text-transform:uppercase;margin-bottom:12px;">Skin Metrics</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${metricBar('Hydration', m.hydration, 'linear-gradient(90deg,#4A90D9,#7BBDE8)')}
      ${metricBar('Sensitivity', m.sensitivity, 'linear-gradient(90deg,#E8748A,#F4A0B0)')}
      ${metricBar('Glow potential', m.glow, 'linear-gradient(90deg,#C9A96E,#F0D48A)')}
      ${metricBar('Barrier balance', m.barrier, 'linear-gradient(90deg,#2D7A4F,#4CAF80)')}
    </table>
  </td></tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding:0 32px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#E8DDD0,transparent);"></div></td></tr>

  <!-- ROUTINE -->
  <tr><td style="padding:20px 32px;">
    <div style="font-size:10px;letter-spacing:2px;font-weight:700;color:#8B6A20;text-transform:uppercase;margin-bottom:4px;">Your Personalised Routine</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${routineSteps(routine.morning, '☀ Morning · ' + routine.morning.length + ' steps')}
      ${routineSteps(routine.evening, '◑ Evening · ' + routine.evening.length + ' steps')}
    </table>
  </td></tr>

  <!-- DISCLAIMER -->
  <tr><td style="padding:0 32px 16px;">
    <div style="font-size:10px;color:#9B8574;background:#FAF7F2;border-radius:8px;padding:10px 12px;line-height:1.7;border:1px solid #E8DDD0;">
      Independent recommendations. Lévia has no affiliation with brands mentioned and receives no commission.
    </div>
  </td></tr>

  <!-- CTA INSTAGRAM -->
  <tr><td style="padding:20px 32px;text-align:center;background:#0D0900;">
    <div style="font-size:12px;color:rgba(201,169,110,0.6);margin-bottom:12px;">Follow Lévia for daily skincare tips & routines</div>
    <a href="https://www.instagram.com/levia.skincare.uk/" style="display:inline-block;padding:11px 22px;background:linear-gradient(135deg,#833AB4,#FD1D1D,#F77737);color:#fff;border-radius:10px;font-weight:700;font-size:12px;text-decoration:none;">Follow @levia.skincare.uk</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:16px 32px;text-align:center;border-top:1px solid #E8DDD0;background:#FAF7F2;">
    <div style="font-size:10px;color:#9B8574;">Lévia Skincare · hello@leviaskincare.com</div>
    <div style="font-size:9px;color:#C0B0A0;margin-top:3px;">You received this because you completed a Lévia skin analysis.</div>
  </td></tr>

</table></td></tr></table></body></html>`;

  try {
    const r = await httpsPost('https://api.resend.com/emails', {
      from: 'Lévia Skincare <hello@leviaskincare.com>',
      to: [client.email],
      subject: `${firstName}, your personalised Lévia routine is ready ✦`,
      html
    }, { 'Authorization': `Bearer ${apiKey}` });
    console.log('Client email sent:', r.status, 'to', client.email);
    return r.status < 300;
  } catch(e) { console.error('Client email error:', e.message); return false; }
}

// ── HANDLER PRINCIPAL ──
exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers, body: JSON.stringify({error:'Method not allowed'}) };

  try {
    const rawBody = event.body || '{}';
    console.log('Body size:', rawBody.length, 'bytes');
    const body = JSON.parse(rawBody);
    const { client, photo } = body;
    console.log('Client:', client?.email, '| Photo:', !!photo, '| Consent:', client?.photo_consent);

    // 1. Upload photo Cloudinary
    let photoUrl = null;
    if (photo && client.photo_consent === 'yes') {
      photoUrl = await uploadToCloudinary(photo, client.name);
      console.log('Cloudinary:', photoUrl || 'FAILED');
    }

    // 2. Routine
    const routineKey = getRoutineKey(client.skin_type, client.concern);
    const routine = ROUTINES[routineKey];

    // 3. Email admin
    const adminSent = await sendAdminEmail({ ...client, photo_url: photoUrl }, photoUrl);

    // 4. Email client automatique avec routine complète
    const clientSent = await sendClientEmail(client, routine, photoUrl);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        photoUrl,
        adminEmail: adminSent,
        clientEmail: clientSent,
        message: clientSent ? 'Routine envoyée à la cliente ✓' : 'Admin email envoyé'
      })
    };
  } catch(e) {
    console.error('Handler error:', e.message);
    return { statusCode:500, headers, body: JSON.stringify({error: e.message}) };
  }
};

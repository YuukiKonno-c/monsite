const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const os = require('os');
 
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
 
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'content.json');
const IMAGES_DIR = path.join(__dirname, 'public', 'images');
 
// ── MULTER (upload images) ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });
 
// ── MIDDLEWARE ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
 
// ── ADMIN — LOCAL ONLY ────────────────────────────────────────────
function isLocal(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const allowed = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];
  if (allowed.includes(ip)) return next();
  res.status(403).send('⛔ Accès admin refusé — local uniquement');
}
 
// Admin panel HTML
app.get('/admin', isLocal, (req, res) => {
  res.send(adminHTML());
});
 
// ── API ───────────────────────────────────────────────────────────
 
// Get content
app.get('/api/content', isLocal, (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  res.json(data);
});
 
// Save content
app.post('/api/content', isLocal, (req, res) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
  broadcast({ type: 'reload' });
  res.json({ ok: true });
});
 
// Upload image
app.post('/api/upload', isLocal, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  broadcast({ type: 'reload' });
  res.json({ filename: req.file.filename });
});
 
// List images
app.get('/api/images', isLocal, (req, res) => {
  const files = fs.readdirSync(IMAGES_DIR).filter(f =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
  );
  res.json(files);
});
 
// Delete image
app.delete('/api/images/:filename', isLocal, (req, res) => {
  const filePath = path.join(IMAGES_DIR, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});
 
// ── WEBSOCKET (hot reload) ────────────────────────────────────────
function broadcast(msg) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(JSON.stringify(msg));
  });
}
 
// Watch content.json for changes
fs.watch(DATA_FILE, () => {
  setTimeout(() => broadcast({ type: 'reload' }), 100);
});
 
// ── HOT RELOAD SCRIPT injected into HTML ─────────────────────────
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    // Already handled by static, so we inject via response interception
  }
  next();
});
 
// ── START ─────────────────────────────────────────────────────────
server.listen(PORT, () => {
  const ifaces = os.networkInterfaces();
  let localIP = 'localhost';
  Object.values(ifaces).flat().forEach(i => {
    if (i.family === 'IPv4' && !i.internal) localIP = i.address;
  });
 
  console.log('\n\x1b[32m╔════════════════════════════════════════╗');
  console.log('║       NEXUS CORP — SERVEUR LOCAL       ║');
  console.log('╚════════════════════════════════════════╝\x1b[0m\n');
  console.log(`\x1b[32m● Site public   :\x1b[0m http://localhost:${PORT}`);
  console.log(`\x1b[32m● Réseau local  :\x1b[0m http://${localIP}:${PORT}`);
  console.log(`\x1b[33m● Admin (local) :\x1b[0m http://localhost:${PORT}/admin`);
  console.log(`\x1b[31m● Admin bloqué  :\x1b[0m depuis internet ✓\n`);
});
 
// ── ADMIN PANEL HTML ──────────────────────────────────────────────
function adminHTML() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ADMIN — NEXUS CORP</title>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --green: #00ff41; --green-dim: #00c832; --red: #ff2222;
      --amber: #ffb000; --bg: #020a02; --border: rgba(0,255,65,0.25);
      --text: #b0ffb8; --mono: 'Share Tech Mono', monospace;
      --display: 'Orbitron', sans-serif;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:var(--bg); color:var(--text); font-family:var(--mono); min-height:100vh; }
    body::before {
      content:''; position:fixed; inset:0; pointer-events:none; z-index:999;
      background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 4px);
    }
    header {
      background:rgba(0,20,5,0.95); border-bottom:1px solid var(--border);
      padding:16px 40px; display:flex; justify-content:space-between; align-items:center;
      position:sticky; top:0; z-index:100;
    }
    .logo { font-family:var(--display); font-size:14px; font-weight:700; color:var(--green); letter-spacing:4px; }
    .badge { font-size:9px; letter-spacing:3px; border:1px solid var(--amber); color:var(--amber); padding:4px 10px; }
    main { max-width:1000px; margin:0 auto; padding:40px 30px; display:flex; flex-direction:column; gap:40px; }
    .card { border:1px solid var(--border); padding:28px; background:rgba(0,15,5,0.6); }
    .card-title { font-family:var(--display); font-size:11px; letter-spacing:4px; color:var(--green-dim); margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid var(--border); }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .form-full { grid-column:1/-1; }
    label { display:block; font-size:9px; letter-spacing:2px; color:var(--green-dim); margin-bottom:6px; }
    input, textarea, select {
      width:100%; background:rgba(0,30,8,0.8); border:1px solid var(--border);
      color:var(--text); font-family:var(--mono); font-size:13px; padding:10px 14px;
      outline:none; transition:border-color 0.2s;
    }
    input:focus, textarea:focus { border-color:var(--green); }
    textarea { resize:vertical; min-height:80px; }
    .btn {
      display:inline-flex; align-items:center; gap:8px; cursor:pointer;
      font-family:var(--mono); font-size:11px; letter-spacing:2px; padding:10px 20px;
      border:none; transition:all 0.2s;
    }
    .btn-primary { background:var(--green); color:#000; font-weight:bold; }
    .btn-primary:hover { background:var(--green-dim); box-shadow:0 0 15px rgba(0,255,65,0.3); }
    .btn-danger { background:transparent; border:1px solid var(--red); color:var(--red); }
    .btn-danger:hover { background:rgba(255,34,34,0.1); }
    .btn-upload { background:transparent; border:1px solid var(--amber); color:var(--amber); width:100%; justify-content:center; padding:20px; border-style:dashed; }
    .btn-upload:hover { background:rgba(255,176,0,0.1); }
    .suspects-list { display:flex; flex-direction:column; gap:20px; }
    .suspect-edit { border:1px solid var(--border); padding:20px; background:rgba(0,10,3,0.5); }
    .suspect-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; font-family:var(--display); font-size:12px; color:var(--green); }
    .avis-list { display:flex; flex-direction:column; gap:16px; }
    .avis-edit { border:1px solid var(--border); padding:20px; background:rgba(0,10,3,0.5); }
    .images-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px; margin-top:16px; }
    .img-item { border:1px solid var(--border); padding:8px; text-align:center; position:relative; }
    .img-item img { width:100%; height:100px; object-fit:cover; filter:grayscale(60%); margin-bottom:6px; }
    .img-name { font-size:9px; color:var(--green-dim); word-break:break-all; margin-bottom:6px; }
    .toast {
      position:fixed; bottom:30px; right:30px; background:var(--green); color:#000;
      font-family:'Orbitron',sans-serif; font-size:11px; font-weight:700; letter-spacing:2px;
      padding:12px 24px; opacity:0; transition:opacity 0.3s; pointer-events:none; z-index:1000;
    }
    .toast.show { opacity:1; }
    .drop-zone {
      border:2px dashed var(--amber); padding:30px; text-align:center;
      color:var(--amber); font-size:12px; letter-spacing:2px; cursor:pointer;
      transition:all 0.3s;
    }
    .drop-zone.drag-over { background:rgba(255,176,0,0.1); border-color:#fff; }
    .actions { display:flex; gap:12px; margin-top:20px; flex-wrap:wrap; }
    .add-btn { border:1px dashed var(--border); padding:12px; text-align:center; cursor:pointer; color:var(--green-dim); font-size:11px; letter-spacing:2px; transition:all 0.3s; }
    .add-btn:hover { border-color:var(--green); color:var(--green); background:rgba(0,255,65,0.05); }
    hr { border:none; border-top:1px solid var(--border); margin:8px 0; }
  </style>
</head>
<body>
  <header>
    <div class="logo">⚡ ADMIN — NEXUS CORP</div>
    <div class="badge">LOCAL UNIQUEMENT</div>
  </header>
 
  <main>
    <!-- ENTREPRISE -->
    <div class="card" id="card-entreprise">
      <div class="card-title">// 01 — INFORMATIONS ENTREPRISE</div>
      <div class="form-grid">
        <div><label>NOM</label><input id="e-nom" type="text"/></div>
        <div><label>STATUT</label><input id="e-statut" type="text"/></div>
        <div class="form-full"><label>TAGLINE</label><input id="e-tagline" type="text"/></div>
        <div><label>NIVEAU MENACE</label><input id="e-menace" type="text"/></div>
        <div><label>DATE CRÉATION</label><input id="e-date" type="text"/></div>
        <div class="form-full"><label>DESCRIPTION</label><textarea id="e-desc"></textarea></div>
      </div>
    </div>
 
    <!-- SUSPECTS -->
    <div class="card">
      <div class="card-title">// 02 — SUSPECTS (AVIS DE RECHERCHE)</div>
      <div class="suspects-list" id="suspects-list"></div>
      <div class="add-btn" onclick="addSuspect()">+ AJOUTER UN SUSPECT</div>
    </div>
 
    <!-- IMAGES -->
    <div class="card">
      <div class="card-title">// 03 — IMAGES (DRAG & DROP)</div>
      <div class="drop-zone" id="drop-zone">
        ↓ GLISSEZ VOS IMAGES ICI ↓<br>
        <small style="opacity:0.6;font-size:10px;margin-top:8px;display:block">ou cliquez pour sélectionner</small>
        <input type="file" id="file-input" multiple accept="image/*" style="display:none"/>
      </div>
      <div class="images-grid" id="images-grid"></div>
    </div>
 
    <!-- AVIS -->
    <div class="card">
      <div class="card-title">// 04 — FAUX TÉMOIGNAGES</div>
      <div class="avis-list" id="avis-list"></div>
      <div class="add-btn" onclick="addAvis()">+ AJOUTER UN TÉMOIGNAGE</div>
    </div>
 
    <!-- SAVE -->
    <div class="actions">
      <button class="btn btn-primary" onclick="saveAll()">💾 SAUVEGARDER & PUBLIER</button>
      <a href="/" target="_blank" class="btn btn-danger" style="text-decoration:none">↗ VOIR LE SITE</a>
    </div>
  </main>
 
  <div class="toast" id="toast"></div>
 
  <script>
    let data = {};
 
    async function loadData() {
      const res = await fetch('/api/content');
      data = await res.json();
      renderAll();
      loadImages();
    }
 
    function renderAll() {
      const e = data.entreprise;
      document.getElementById('e-nom').value = e.nom || '';
      document.getElementById('e-tagline').value = e.tagline || '';
      document.getElementById('e-desc').value = e.description || '';
      document.getElementById('e-statut').value = e.statut || '';
      document.getElementById('e-menace').value = e.niveau_menace || '';
      document.getElementById('e-date').value = e.date_creation || '';
      renderSuspects();
      renderAvis();
    }
 
    function renderSuspects() {
      const list = document.getElementById('suspects-list');
      list.innerHTML = '';
      data.suspects.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'suspect-edit';
        div.innerHTML = \`
          <div class="suspect-header">
            <span>SUSPECT #\${i+1}</span>
            <button class="btn btn-danger" onclick="removeSuspect(\${i})" style="padding:4px 10px;font-size:9px">✕ SUPPRIMER</button>
          </div>
          <div class="form-grid">
            <div><label>NOM / ALIAS</label><input value="\${s.nom||''}" oninput="data.suspects[\${i}].nom=this.value"/></div>
            <div><label>VRAI NOM</label><input value="\${s.vrai_nom||''}" oninput="data.suspects[\${i}].vrai_nom=this.value"/></div>
            <div><label>FICHIER IMAGE (ex: suspect1.jpg)</label><input value="\${s.image||''}" oninput="data.suspects[\${i}].image=this.value"/></div>
            <div><label>PRIME</label><input value="\${s.prime||''}" oninput="data.suspects[\${i}].prime=this.value"/></div>
            <div><label>NIVEAU DANGER</label>
              <select oninput="data.suspects[\${i}].danger=this.value">
                <option \${s.danger==='ÉLEVÉ'?'selected':''}>ÉLEVÉ</option>
                <option \${s.danger==='EXTRÊME'?'selected':''}>EXTRÊME</option>
                <option \${s.danger==='MODÉRÉ'?'selected':''}>MODÉRÉ</option>
              </select>
            </div>
            <div><label>STATUT</label><input value="\${s.statut||''}" oninput="data.suspects[\${i}].statut=this.value"/></div>
            <div class="form-full"><label>DESCRIPTION</label><textarea oninput="data.suspects[\${i}].description=this.value">\${s.description||''}</textarea></div>
          </div>
        \`;
        list.appendChild(div);
      });
    }
 
    function renderAvis() {
      const list = document.getElementById('avis-list');
      list.innerHTML = '';
      data.avis.forEach((a, i) => {
        const div = document.createElement('div');
        div.className = 'avis-edit';
        div.innerHTML = \`
          <div class="suspect-header">
            <span>TÉMOIGNAGE #\${i+1}</span>
            <button class="btn btn-danger" onclick="removeAvis(\${i})" style="padding:4px 10px;font-size:9px">✕ SUPPRIMER</button>
          </div>
          <div class="form-grid">
            <div><label>AUTEUR</label><input value="\${a.auteur||''}" oninput="data.avis[\${i}].auteur=this.value"/></div>
            <div><label>DATE</label><input value="\${a.date||''}" oninput="data.avis[\${i}].date=this.value"/></div>
            <div><label>FIABILITÉ</label>
              <select oninput="data.avis[\${i}].fiabilite=this.value">
                <option \${a.fiabilite==='CONFIRMÉ'?'selected':''}>CONFIRMÉ</option>
                <option \${a.fiabilite==='NON VÉRIFIÉ'?'selected':''}>NON VÉRIFIÉ</option>
                <option \${a.fiabilite==='EN COURS'?'selected':''}>EN COURS</option>
              </select>
            </div>
            <div class="form-full"><label>TÉMOIGNAGE</label><textarea oninput="data.avis[\${i}].texte=this.value">\${a.texte||''}</textarea></div>
          </div>
        \`;
        list.appendChild(div);
      });
    }
 
    function addSuspect() {
      data.suspects.push({ id: Date.now(), nom: 'NOUVEAU SUSPECT', vrai_nom: 'Inconnu', image: '', description: '', statut: 'RECHERCHÉ', prime: '0 €', danger: 'ÉLEVÉ' });
      renderSuspects();
    }
 
    function removeSuspect(i) {
      data.suspects.splice(i, 1);
      renderSuspects();
    }
 
    function addAvis() {
      data.avis.push({ auteur: 'Anonyme', date: new Date().toISOString().split('T')[0], texte: '', fiabilite: 'NON VÉRIFIÉ' });
      renderAvis();
    }
 
    function removeAvis(i) {
      data.avis.splice(i, 1);
      renderAvis();
    }
 
    async function saveAll() {
      data.entreprise.nom = document.getElementById('e-nom').value;
      data.entreprise.tagline = document.getElementById('e-tagline').value;
      data.entreprise.description = document.getElementById('e-desc').value;
      data.entreprise.statut = document.getElementById('e-statut').value;
      data.entreprise.niveau_menace = document.getElementById('e-menace').value;
      data.entreprise.date_creation = document.getElementById('e-date').value;
 
      await fetch('/api/content', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
      toast('✓ SAUVEGARDÉ & PUBLIÉ');
    }
 
    async function loadImages() {
      const res = await fetch('/api/images');
      const files = await res.json();
      const grid = document.getElementById('images-grid');
      grid.innerHTML = '';
      files.forEach(f => {
        const div = document.createElement('div');
        div.className = 'img-item';
        div.innerHTML = \`
          <img src="/images/\${f}" alt="\${f}"/>
          <div class="img-name">\${f}</div>
          <button class="btn btn-danger" style="font-size:9px;padding:3px 8px;width:100%" onclick="deleteImage('\${f}')">✕</button>
        \`;
        grid.appendChild(div);
      });
    }
 
    async function deleteImage(name) {
      await fetch(\`/api/images/\${name}\`, { method:'DELETE' });
      loadImages();
    }
 
    // DRAG & DROP
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
 
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      uploadFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => uploadFiles(fileInput.files));
 
    async function uploadFiles(files) {
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        await fetch('/api/upload', { method:'POST', body:fd });
      }
      loadImages();
      toast(\`✓ \${files.length} IMAGE(S) UPLOADÉE(S)\`);
    }
 
    function toast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    }
 
    loadData();
  </script>
</body>
</html>`;
}
 

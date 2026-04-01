const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

const GH_TOKEN = process.env.GITHUB_TOKEN;
const API_SECRET = process.env.API_SECRET || 'aokae2026';
const OWNER = 'okuwabara07-gif';

// 認証ミドルウェア
function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// GitHub APIヘルパー
function ghRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'aokae-api',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AOKAE API Server', time: new Date().toISOString() });
});

// 全サイトのVercelビルドステータス確認
app.get('/api/status', auth, async (req, res) => {
  const SITES = [
    'haircolor-lab','diet-now-jp','fitness-lab-jp','skincare-note-jp',
    'pet-love-jp','gadget-lab-jp','baby-note-jp','travel-log-jp',
    'cooking-note-jp','nail-lab-jp','golf-lab-jp','camera-lab-jp',
    'side-job-jp','english-lab-jp','interior-log-jp','fashion-note-jp',
    'yoga-note-jp','coffee-note-jp','sauna-log-jp','career-note-jp',
    'kcos-review-jp','kmake-lab-jp','kbeauty-brand-jp','kskin-lab-jp',
    'kdrama-beauty-jp','makeup-lab-jp','beauty-portal-jp',
    'money-note-jp','health-note-jp'
  ];
  const results = [];
  for (const site of SITES) {
    try {
      const r = await fetch(`https://${site}.vercel.app`, { method: 'HEAD' });
      results.push({ site, status: r.status, ok: r.status === 200 });
    } catch {
      results.push({ site, status: 0, ok: false });
    }
  }
  res.json({ sites: results, total: SITES.length, ok: results.filter(r=>r.ok).length });
});

// X自動投稿を今すぐ実行（workflow_dispatch）
app.post('/api/post-x', auth, async (req, res) => {
  const { repo = 'haircolor-lab' } = req.body;
  const r = await ghRequest('POST',
    `/repos/${OWNER}/${repo}/actions/workflows/auto-post.yml/dispatches`,
    { ref: 'main' }
  );
  res.json({ success: r.status === 204, status: r.status, repo });
});

// 全サイトにX投稿トリガー
app.post('/api/post-x-all', auth, async (req, res) => {
  const REPOS = [
    'haircolor-lab','diet-now-jp','fitness-lab-jp','skincare-note-jp',
    'yoga-note-jp','coffee-note-jp','nail-lab-jp','side-job-jp',
    'career-note-jp','kcos-review-jp','kmake-lab-jp'
  ];
  const results = [];
  for (const repo of REPOS) {
    const r = await ghRequest('POST',
      `/repos/${OWNER}/${repo}/actions/workflows/auto-post.yml/dispatches`,
      { ref: 'main' }
    );
    results.push({ repo, success: r.status === 204 });
    await new Promise(r => setTimeout(r, 500));
  }
  res.json({ results, triggered: results.filter(r=>r.success).length });
});

// 記事数確認
app.get('/api/articles', auth, async (req, res) => {
  const REPOS = [
    'haircolor-lab','diet-now-jp','fitness-lab-jp','skincare-note-jp',
    'yoga-note-jp','coffee-note-jp','nail-lab-jp','career-note-jp',
    'kcos-review-jp','kmake-lab-jp','kbeauty-brand-jp'
  ];
  const results = [];
  for (const repo of REPOS) {
    const r = await ghRequest('GET', `/repos/${OWNER}/${repo}/git/trees/main?recursive=1`);
    const count = (r.data.tree || []).filter(f => f.path.startsWith('content/blog/') && f.path.endsWith('.mdx')).length;
    results.push({ repo, articles: count });
  }
  res.json({ results, total: results.reduce((s,r)=>s+r.articles,0) });
});

// 新サイト作成トリガー（GitHub Actionsで実行）
app.post('/api/create-site', auth, async (req, res) => {
  const { name, genre, description } = req.body;
  if (!name || !genre) return res.status(400).json({ error: 'name and genre required' });
  const r = await ghRequest('POST', '/user/repos', {
    name, private: false, auto_init: false, description: description || genre
  });
  res.json({ success: r.status in [200,201,422], status: r.status, name });
});

// Vercelリビルドトリガー
app.post('/api/rebuild', auth, async (req, res) => {
  const { repo } = req.body;
  if (!repo) return res.status(400).json({ error: 'repo required' });
  const getR = await ghRequest('GET', `/repos/${OWNER}/${repo}/contents/README.md`);
  const sha = getR.data.sha;
  const content = Buffer.from(`# ${repo}\n\nUpdated: ${new Date().toISOString()}\n`).toString('base64');
  const r = await ghRequest('PUT', `/repos/${OWNER}/${repo}/contents/README.md`, {
    message: 'chore: trigger redeploy', content, sha
  });
  res.json({ success: r.status in [200,201], status: r.status, repo });
});

// 収益サマリー（手動入力データ）
app.get('/api/revenue', auth, (req, res) => {
  res.json({
    month: new Date().toISOString().slice(0,7),
    adsense: 0,
    a8: 0,
    rakuten: 0,
    note: 'A8承認待ち・SEOインデックス待ち',
    updated: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AOKAE API running on port ${PORT}`));

import { CONFIG, PROMPT_TEMPLATE } from './config.js';
import { Utils } from './utils.js';

// ─── Shared localStorage wrapper ─────────────────────────────────────────────
const safeStorage = {
  get: (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
    catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
};

// ─── Account pattern learning ────────────────────────────────────────────────
export const ACCOUNT_CODE_LIST = [
  '普通預金','当座預金','現金','売掛金','未収入金','前払費用','仮払金',
  '買掛金','未払金','前受金','預り金','仮受金',
  '売上高','受取利息','雑収入',
  '仕入高','給料手当','法定福利費','旅費交通費','通信費','消耗品費',
  '地代家賃','支払手数料','広告宣伝費','接待交際費','支払利息','雑費',
];

export const AccountPatterns = {
  load: () => safeStorage.get('account_patterns_v1', {}),
  save: (p) => safeStorage.set('account_patterns_v1', p),
  learn: (desc, code) => {
    if (!desc?.trim() || !code?.trim()) return;
    const p = AccountPatterns.load();
    p[desc.trim()] = code.trim();
    AccountPatterns.save(p);
  },
  apply: (transactions) => {
    const p = AccountPatterns.load();
    return transactions.map(t => ({ ...t, accountCode: t.accountCode || p[t.description?.trim()] || '' }));
  },
};

// ─── Description normalization ───────────────────────────────────────────────
export const NormalizationRules = {
  load: () => safeStorage.get('normalization_rules_v1', []),
  save: (rules) => safeStorage.set('normalization_rules_v1', rules),
  applyOne: (desc, rules) => {
    let result = desc || '';
    for (const r of rules) {
      if (!r.pattern) continue;
      try { result = result.replace(new RegExp(r.pattern, 'g'), r.replacement || ''); }
      catch { /* invalid regex — skip */ }
    }
    return result;
  },
  applyAll: (transactions) => {
    const rules = NormalizationRules.load();
    if (!rules.length) return transactions;
    return transactions.map(t => ({ ...t, description: NormalizationRules.applyOne(t.description, rules) }));
  },
};

// ─── Session persistence ─────────────────────────────────────────────────────
const SESSION_KEY = 'passbook_sessions_v1';
const SESSION_LIMIT = 20;

export const SessionService = {
  list: () => safeStorage.get(SESSION_KEY, []),
  save: (name, data) => {
    const sessions = SessionService.list();
    const idx = sessions.findIndex(s => s.name === name);
    const entry = { name, data, savedAt: new Date().toISOString() };
    if (idx >= 0) sessions[idx] = entry; else sessions.unshift(entry);
    safeStorage.set(SESSION_KEY, sessions.slice(0, SESSION_LIMIT));
  },
  load: (name) => SessionService.list().find(s => s.name === name)?.data ?? null,
  delete: (name) => safeStorage.set(SESSION_KEY, SessionService.list().filter(s => s.name !== name)),
};

// ─── PDF rendering ───────────────────────────────────────────────────────────
const loadScript = (url, integrity) => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = url;
  if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
  s.onload = resolve;
  s.onerror = reject;
  document.body.appendChild(s);
});

export const PdfService = {
  load: async (onProgress) => {
    if (window.pdfjsLib) return;
    onProgress?.('PDFエンジンを起動中...');
    try {
      await loadScript(CONFIG.PDF_JS_URL, CONFIG.PDF_JS_INTEGRITY);
    } catch {
      await loadScript(CONFIG.PDF_JS_URL_FALLBACK, null);
    }
    try {
      const workerText = await (await fetch(CONFIG.PDF_WORKER_URL)).text();
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerText], { type: 'text/javascript' }));
    } catch {
      try {
        const workerText = await (await fetch(CONFIG.PDF_WORKER_URL_FALLBACK)).text();
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerText], { type: 'text/javascript' }));
      } catch { /* use default worker */ }
    }
  },

  extractImagesStreaming: async (file, onPageReady, onProgress) => {
    await PdfService.load(onProgress);
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const total = pdf.numPages;
    return Promise.all(Array.from({ length: total }, async (_, i) => {
      onProgress?.(`解析中... (${i + 1}/${total}P)`);
      const page = await pdf.getPage(i + 1);
      const vp = page.getViewport({ scale: CONFIG.RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const b64 = canvas.toDataURL('image/jpeg', CONFIG.RENDER_QUALITY).split(',')[1];
      onPageReady(i, b64, total);
      return b64;
    }));
  }
};

// ─── Gemini API ──────────────────────────────────────────────────────────────
export const GeminiService = {
  extractData: async (base64Array, mimeType, apiKey) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_ID}:generateContent`;
    const payload = {
      contents: [{ parts: [{ text: PROMPT_TEMPLATE }, ...base64Array.map(data => ({ inlineData: { mimeType, data } }))] }],
      generationConfig: {
        maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            totalDetectedRows: { type: 'INTEGER' },
            transactions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  bankName: { type: 'STRING' }, date: { type: 'STRING' }, description: { type: 'STRING' },
                  withdrawal: { type: 'STRING' }, deposit: { type: 'STRING' }, balance: { type: 'STRING' }, note: { type: 'STRING' },
                  boundingBox: { type: 'ARRAY', items: { type: 'INTEGER' } },
                  needsReview: { type: 'BOOLEAN' },
                  confidenceScore: { type: 'INTEGER' },
                  chunkPageIndex: { type: 'INTEGER' },
                },
                required: ['bankName', 'date', 'description', 'withdrawal', 'deposit', 'balance', 'boundingBox', 'needsReview', 'confidenceScore', 'chunkPageIndex']
              }
            }
          },
          required: ['totalDetectedRows', 'transactions']
        }
      }
    };

    let delay = 1000;
    for (let attempt = 0; attempt < 5; attempt++) {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), CONFIG.API_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });
        clearTimeout(tid);
        if (res.status === 400) throw new Error('APIキーが無効です。設定を確認してください');
        if (res.status === 429) throw new Error('API利用制限に達しました。しばらく待ってから再試行してください');
        if (!res.ok) throw new Error(`APIエラー (HTTP ${res.status})`);
        const json = await res.json();
        const candidate = json.candidates?.[0];
        if (!candidate || candidate.finishReason === 'SAFETY') throw new Error('AI応答エラー: 安全フィルターによりブロックされました');
        let text = candidate.content?.parts?.[0]?.text?.trim() || '{}';
        if (text.startsWith('\x60')) text = text.replace(/^[\x60]{3}(?:json)?\s*/i, '').replace(/\s*[\x60]{3}$/i, '');
        return JSON.parse(text);
      } catch (err) {
        clearTimeout(tid);
        if (attempt === 4) throw err;
        if (err.name === 'AbortError') throw new Error('APIタイムアウト: ネットワーク接続を確認してください');
        await new Promise(r => setTimeout(r, delay)); delay *= 2;
      }
    }
  }
};

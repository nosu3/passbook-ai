export const Utils = {
  readFileAsBase64: (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }),

  runWithConcurrencyLimit: async (tasks, limit, onProgress) => {
    const results = new Array(tasks.length);
    let currentIndex = 0; let completedCount = 0;
    const worker = async () => {
      while (currentIndex < tasks.length) {
        const taskIndex = currentIndex++;
        try { results[taskIndex] = await tasks[taskIndex](); }
        catch (err) { results[taskIndex] = { error: err }; }
        completedCount++; onProgress(completedCount, tasks.length);
      }
    };
    const workers = [];
    for (let i = 0; i < Math.min(limit, tasks.length); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  },

  cleanNum: (str) => parseInt(String(str || '').replace(/[^\d-]/g, ''), 10) || 0,

  hashFile: async (file) => {
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  cache: {
    _db: null,
    getDB: () => {
      if (Utils.cache._db) return Promise.resolve(Utils.cache._db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('PassbookCache_v2', 1);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore('results', { keyPath: 'hash' });
        req.onsuccess = (e) => { Utils.cache._db = e.target.result; resolve(e.target.result); };
        req.onerror = reject;
      });
    },
    get: async (hash) => {
      try {
        const db = await Utils.cache.getDB();
        return new Promise((resolve) => {
          const req = db.transaction('results', 'readonly').objectStore('results').get(hash);
          req.onsuccess = () => resolve(req.result?.data ?? null);
          req.onerror = () => resolve(null);
        });
      } catch { return null; }
    },
    set: async (hash, data) => {
      try {
        const db = await Utils.cache.getDB();
        return new Promise((resolve) => {
          const tx = db.transaction('results', 'readwrite');
          tx.objectStore('results').put({ hash, data, ts: Date.now() });
          tx.oncomplete = resolve; tx.onerror = resolve;
        });
      } catch { /* ignore */ }
    }
  },

  downloadCSV: (data) => {
    if (!data?.length) return;
    const header = ['金融機関名', '日付', 'お取引内容', '科目', 'お支払金額(円)', 'お預り金額(円)', '残高(円)', '確信度', '備考'];
    const esc = (v) => {
      if (v == null) return '""';
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = data.map(r => [esc(r.bankName), esc(r.date), esc(r.description), esc(r.accountCode), esc(r.withdrawal), esc(r.deposit), esc(r.balance), r.confidenceScore ?? '', esc(r.note)]);
    const csv = [header, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '通帳読取データ.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
};

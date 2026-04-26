import { useState, useRef, useEffect, useMemo, useCallback, useReducer } from 'react';
import { CONFIG } from './config.js';
import { nextGid } from './config.js';
import { Utils } from './utils.js';
import { Validators } from './validators.js';
import { AccountPatterns, NormalizationRules, PdfService, GeminiService } from './services.js';

const MAX_UNDO = 50;

function undoReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { past: [], present: action.payload, future: [] };
    case 'UPDATE': {
      const past = [...state.past, state.present].slice(-MAX_UNDO);
      return { past, present: action.payload, future: [] };
    }
    case 'UNDO': {
      if (!state.past.length) return state;
      const past = [...state.past];
      const present = past.pop();
      return { past, present, future: [state.present, ...state.future].slice(0, MAX_UNDO) };
    }
    case 'REDO': {
      if (!state.future.length) return state;
      const [present, ...future] = state.future;
      return { past: [...state.past, state.present].slice(-MAX_UNDO), present, future };
    }
    default: return state;
  }
}

// ─── processFile helpers ──────────────────────────────────────────────────────

async function processPdfFile(selectedFile, pageOffset, apiKey, isAppend, accountAlias, { setPdfProgress, setApiProgress, setPageImages }) {
  setPdfProgress({ current: 0, total: 0, text: 'PDF展開中...' });
  const base64List = await PdfService.extractImagesStreaming(
    selectedFile,
    (i, b64, total) => {
      setPageImages(prev => { const n = [...prev]; n[pageOffset + i] = `data:image/jpeg;base64,${b64}`; return n; });
      setPdfProgress({ current: i + 1, total, text: `PDF展開中 (${i + 1}/${total}P)` });
    },
    (t) => setPdfProgress(p => ({ ...p, text: t }))
  );
  setPdfProgress({ current: 1, total: 1, text: 'PDF展開完了' });

  const chunks = [];
  for (let i = 0; i < base64List.length; i += CONFIG.CHUNK_SIZE) {
    chunks.push({ startPage: i, images: base64List.slice(i, i + CONFIG.CHUNK_SIZE) });
  }

  setApiProgress({ current: 0, total: chunks.length, text: 'AI抽出待機中...' });
  const tasks = chunks.map(chunk => async () => {
    const res = await GeminiService.extractData(chunk.images, 'image/jpeg', apiKey);
    return { ...res, chunkStartPage: chunk.startPage };
  });

  const results = await Utils.runWithConcurrencyLimit(tasks, CONFIG.CONCURRENCY_LIMIT, (done, total) => {
    setApiProgress({ current: done, total, text: `AI抽出中 (${done}/${total}チャンク完了)` });
  });

  const newTxs = [];
  results.forEach(res => {
    if (!res?.transactions) return;
    res.transactions.forEach(t => {
      const cpi = typeof t.chunkPageIndex === 'number' ? Math.max(0, t.chunkPageIndex) : 0;
      const absPage = pageOffset + res.chunkStartPage + cpi;
      const bankName = (isAppend && accountAlias) ? accountAlias : (t.bankName || accountAlias || '');
      newTxs.push({ ...t, bankName, pageIndex: absPage });
    });
  });
  return newTxs;
}

async function processImageFile(selectedFile, pageOffset, apiKey, isAppend, accountAlias, { setApiProgress, setPageImages }) {
  setPdfProgress_noop();
  setApiProgress({ current: 0, total: 1, text: 'AI抽出中...' });
  const b64 = await Utils.readFileAsBase64(selectedFile);
  setPageImages(prev => { const n = [...prev]; n[pageOffset] = `data:${selectedFile.type};base64,${b64}`; return n; });
  const res = await GeminiService.extractData([b64], selectedFile.type, apiKey);
  const alias = (isAppend && accountAlias) ? accountAlias : null;
  const newTxs = (res?.transactions || []).map(t => ({
    ...t,
    bankName: alias || t.bankName || '',
    pageIndex: pageOffset
  }));
  setApiProgress({ current: 1, total: 1, text: 'AI抽出完了' });
  return newTxs;
}
const setPdfProgress_noop = () => {};

function finalizeTransactions(newTxs, existingData, materialityThreshold) {
  const combined = [...existingData, ...newTxs];
  return NormalizationRules.applyAll(
    AccountPatterns.apply(
      Validators.runAll(combined, materialityThreshold).map(t => ({ ...t, globalIndex: nextGid() }))
    )
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const usePassbookReader = () => {
  const [undoState, dispatch] = useReducer(undoReducer, { past: [], present: [], future: [] });
  const data = undoState.present;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageImages, setPageImages] = useState([]);
  const [cacheHit, setCacheHit] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0, text: '' });
  const [apiProgress, setApiProgress] = useState({ current: 0, total: 0, text: '' });
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('gemini_api_key') || '');
  const [materialityThreshold, setMaterialityThreshold] = useState(
    () => parseInt(localStorage.getItem('materiality_threshold') || '0', 10)
  );

  const saveApiKey = (key) => { setApiKey(key); sessionStorage.setItem('gemini_api_key', key); };
  const saveMaterialityThreshold = (val) => {
    setMaterialityThreshold(val);
    localStorage.setItem('materiality_threshold', String(val));
  };

  // Stable refs so callbacks don't re-create on every render
  const dataRef = useRef(data);
  dataRef.current = data;
  const materialityThresholdRef = useRef(materialityThreshold);
  materialityThresholdRef.current = materialityThreshold;
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;
  const pageImagesRef = useRef(pageImages);
  pageImagesRef.current = pageImages;

  useEffect(() => {
    if (!dataRef.current.length) return;
    dispatch({ type: 'UPDATE', payload: Validators.applyMaterialityFlag(dataRef.current, materialityThreshold) });
  }, [materialityThreshold]);

  const setData = useCallback((payload) => dispatch({ type: 'UPDATE', payload }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const canUndo = undoState.past.length > 0;
  const canRedo = undoState.future.length > 0;

  // Stable callbacks — use refs instead of capturing state in closure
  const updateData = useCallback((globalIndex, field, value) => {
    const currentData = dataRef.current;
    if (field === 'accountCode') {
      const row = currentData.find(r => r.globalIndex === globalIndex);
      if (row?.description) AccountPatterns.learn(row.description, value);
    }
    const next = currentData.map(r => r.globalIndex === globalIndex ? { ...r, [field]: value } : r);
    const needsValidation = ['withdrawal', 'deposit', 'balance', 'bankName', 'date'].includes(field);
    setData(needsValidation ? Validators.runAll(next, materialityThresholdRef.current) : next);
  }, [setData]);

  const addRowAfter = useCallback((globalIndex) => {
    const currentData = dataRef.current;
    const idx = currentData.findIndex(r => r.globalIndex === globalIndex);
    const ref = currentData[idx];
    const newRow = {
      globalIndex: nextGid(), pageIndex: ref?.pageIndex ?? 0,
      bankName: ref?.bankName || '', date: ref?.date ?? '',
      description: '', withdrawal: '', deposit: '', balance: '',
      note: '【手動追加】', boundingBox: [], needsReview: true,
      confidenceScore: null, isManual: true, _balanceIssue: null,
      reconcileTag: null,
    };
    const next = [...currentData]; next.splice(idx + 1, 0, newRow);
    setData(Validators.runAll(next, materialityThresholdRef.current));
  }, [setData]);

  const deleteRow = useCallback((globalIndex) => {
    setData(Validators.runAll(dataRef.current.filter(r => r.globalIndex !== globalIndex), materialityThresholdRef.current));
  }, [setData]);

  const processFile = useCallback(async (selectedFile, isAppend = false, accountAlias = null) => {
    if (!apiKeyRef.current.trim()) return setError('API キーを設定してください（右上の設定ボタン）');
    try { Utils.validateFile(selectedFile); } catch (e) { return setError(e.message); }

    setLoading(true); setError(''); setCacheHit(false);
    if (!isAppend) { dispatch({ type: 'SET', payload: [] }); setPageImages([]); }

    try {
      const fileHash = await Utils.hashFile(selectedFile);
      const cacheKey = isAppend ? null : fileHash;
      if (cacheKey) {
        const cached = await Utils.cache.get(cacheKey);
        if (cached) {
          dispatch({ type: 'SET', payload: cached.data });
          setCacheHit(true);
          return;
        }
      }

      const pageOffset = isAppend ? pageImagesRef.current.length : 0;
      const currentData = isAppend ? dataRef.current : [];

      let newTxs;
      const setters = { setPdfProgress, setApiProgress, setPageImages };
      if (selectedFile.type === 'application/pdf') {
        newTxs = await processPdfFile(selectedFile, pageOffset, apiKeyRef.current, isAppend, accountAlias, setters);
      } else {
        newTxs = await processImageFile(selectedFile, pageOffset, apiKeyRef.current, isAppend, accountAlias, setters);
      }

      const validated = finalizeTransactions(newTxs, currentData, materialityThresholdRef.current);
      dispatch({ type: 'SET', payload: validated });
      if (cacheKey) await Utils.cache.set(cacheKey, { data: validated });

    } catch (err) {
      const msg = err.message || '不明なエラー';
      setError(msg.startsWith('API') || msg.startsWith('AI') ? msg : `読み取りエラー: ${msg}`);
    } finally {
      setLoading(false);
      setPdfProgress({ current: 0, total: 0, text: '' });
      setApiProgress({ current: 0, total: 0, text: '' });
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const applyNormalization = useCallback(() => {
    if (!dataRef.current.length) return;
    dispatch({ type: 'UPDATE', payload: NormalizationRules.applyAll(dataRef.current) });
  }, []);

  const summary = useMemo(() => {
    if (!data.length) return null;
    return {
      total: data.length,
      withdrawal: data.reduce((s, r) => s + Utils.cleanNum(r.withdrawal), 0),
      deposit: data.reduce((s, r) => s + Utils.cleanNum(r.deposit), 0),
      review: data.filter(r => r.needsReview).length,
      balanceIssues: data.filter(r => r._balanceIssue).length,
      duplicates: data.filter(r => r._duplicateIssue).length,
      carryoverIssues: data.filter(r => r._carryoverIssue).length,
      materialityFlags: data.filter(r => r._materialityFlag).length,
      pageGapWarnings: data.filter(r => r._pageGapWarning).length,
    };
  }, [data]);

  return {
    loading, data, error, pageImages, cacheHit, pdfProgress, apiProgress, summary,
    apiKey, saveApiKey, materialityThreshold, saveMaterialityThreshold,
    canUndo, canRedo, undo, redo,
    processFile, updateData, addRowAfter, deleteRow, applyNormalization,
    loadSession: (sessionData) => { dispatch({ type: 'SET', payload: sessionData }); setPageImages([]); setCacheHit(false); },
    reset: () => { dispatch({ type: 'SET', payload: [] }); setPageImages([]); setCacheHit(false); }
  };
};

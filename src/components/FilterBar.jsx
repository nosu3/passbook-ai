import React, { useState, useEffect } from 'react';
import { Icons } from '../icons.jsx';
import { Utils } from '../utils.js';

export const FilterBar = ({ data, onFiltered }) => {
  const [kw, setKw] = useState('');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('all');

  const active = kw || minAmt || maxAmt || dateFrom || dateTo || status !== 'all';

  useEffect(() => {
    let r = data;
    if (kw) {
      const q = kw.toLowerCase();
      r = r.filter(t => [t.description, t.bankName, t.note, t.accountCode].some(v => v?.toLowerCase().includes(q)));
    }
    if (minAmt) r = r.filter(t => Utils.cleanNum(t.withdrawal) >= +minAmt || Utils.cleanNum(t.deposit) >= +minAmt);
    if (maxAmt) r = r.filter(t => (!t.withdrawal || Utils.cleanNum(t.withdrawal) <= +maxAmt) && (!t.deposit || Utils.cleanNum(t.deposit) <= +maxAmt));
    const normDate = (d) => d?.replace(/\//g, '-') ?? '';
    if (dateFrom) r = r.filter(t => normDate(t.date) >= dateFrom);
    if (dateTo)   r = r.filter(t => normDate(t.date) <= dateTo);
    if (status === 'review') r = r.filter(t => t.needsReview || t._balanceIssue || t._duplicateIssue || t._carryoverIssue || t._pageGapWarning);
    else if (status === 'ok') r = r.filter(t => !t.needsReview && !t._balanceIssue && !t._duplicateIssue && !t._carryoverIssue && !t._pageGapWarning);
    else if (status === 'tagged') r = r.filter(t => t.reconcileTag);
    else if (status === 'large') r = r.filter(t => t._materialityFlag);
    onFiltered(r);
  }, [kw, minAmt, maxAmt, dateFrom, dateTo, status, data]);

  const clear = () => { setKw(''); setMinAmt(''); setMaxAmt(''); setDateFrom(''); setDateTo(''); setStatus('all'); };

  return (
    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center text-xs no-print">
      <Icons.SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"/>
      <input value={kw} onChange={e => setKw(e.target.value)} placeholder="キーワードで検索…" className="border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 w-40 bg-white"/>
      <input type="number" value={minAmt} onChange={e => setMinAmt(e.target.value)} placeholder="下限金額" className="border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 w-24 bg-white"/>
      <input type="number" value={maxAmt} onChange={e => setMaxAmt(e.target.value)} placeholder="上限金額" className="border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 w-24 bg-white"/>
      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="開始日" className="border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 bg-white"/>
      <span className="text-slate-400">〜</span>
      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="終了日" className="border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 bg-white"/>
      <select value={status} onChange={e => setStatus(e.target.value)} className="border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 bg-white">
        <option value="all">すべて</option>
        <option value="review">要確認</option>
        <option value="ok">正常のみ</option>
        <option value="tagged">タグ付き</option>
        <option value="large">大口</option>
      </select>
      {active && (
        <button onClick={clear} className="flex items-center gap-0.5 px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold">
          <Icons.X className="w-3 h-3"/>リセット
        </button>
      )}
    </div>
  );
};

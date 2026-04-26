import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Icons } from '../icons.jsx';
import { Utils } from '../utils.js';
import { ACCOUNT_CODE_LIST } from '../services.js';
import { FilterBar } from './FilterBar.jsx';
import { ConfidenceBadge } from './TableComponents.jsx';

export const ResultTable = ({ data, activeIndex, onRowActive, onPageChange, onUpdateData, onAddRow, onDeleteRow, canUndo, canRedo, onUndo, onRedo }) => {
  const tableRef = useRef(null);
  const rowRefs = useRef({});
  const [filteredData, setFilteredData] = useState(data);
  const [monthlyView, setMonthlyView] = useState(false);

  useEffect(() => { setFilteredData(data); }, [data]);

  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.key === 'Enter') {
        e.preventDefault();
        const curr = data.findIndex(r => r.globalIndex === activeIndex);
        if (curr < data.length - 1) {
          const next = data[curr + 1];
          onRowActive(next.globalIndex); onPageChange(next.pageIndex);
        }
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const curr = data.findIndex(r => r.globalIndex === activeIndex);
      const nextIdx = e.key === 'ArrowDown'
        ? Math.min(curr + 1, data.length - 1)
        : Math.max(curr <= -1 ? 0 : curr - 1, 0);
      if (nextIdx >= 0 && data[nextIdx]) {
        onRowActive(data[nextIdx].globalIndex); onPageChange(data[nextIdx].pageIndex);
      }
    }
  }, [data, activeIndex, onRowActive, onPageChange]);

  const hasIssue = (r) => r.needsReview || r._balanceIssue || r._duplicateIssue || r._carryoverIssue;

  const jumpToNextReview = useCallback(() => {
    const curr = data.findIndex(r => r.globalIndex === activeIndex);
    const candidates = data.filter((r, i) => i > curr && hasIssue(r));
    if (!candidates.length) {
      const first = data.find(r => hasIssue(r));
      if (first) { onRowActive(first.globalIndex); onPageChange(first.pageIndex); }
      return;
    }
    onRowActive(candidates[0].globalIndex); onPageChange(candidates[0].pageIndex);
  }, [data, activeIndex, onRowActive, onPageChange]);

  useEffect(() => {
    if (activeIndex != null && rowRefs.current[activeIndex]) {
      rowRefs.current[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  useEffect(() => {
    const currentKeys = new Set(data.map(r => String(r.globalIndex)));
    Object.keys(rowRefs.current).forEach(key => {
      if (!currentKeys.has(key)) delete rowRefs.current[key];
    });
  }, [data]);

  const reviewCount = data.filter(r => hasIssue(r)).length;

  const monthlyRows = useMemo(() => {
    if (!monthlyView) return null;
    const groups = {};
    filteredData.forEach(r => {
      const m = r.date ? r.date.slice(0, 7) : '不明';
      if (!groups[m]) groups[m] = [];
      groups[m].push(r);
    });
    return groups;
  }, [monthlyView, filteredData]);

  const displayRows = useMemo(() => {
    if (!monthlyView || !monthlyRows) return filteredData;
    const result = [];
    Object.keys(monthlyRows).sort().forEach(m => {
      const rows = monthlyRows[m];
      const w = rows.reduce((s, r) => s + Utils.cleanNum(r.withdrawal), 0);
      const d = rows.reduce((s, r) => s + Utils.cleanNum(r.deposit), 0);
      result.push({ _isGroupHeader: true, month: m, count: rows.length, withdrawal: w, deposit: d });
      result.push(...rows);
    });
    return result;
  }, [monthlyView, monthlyRows, filteredData]);

  const inputCls = 'w-full p-1 bg-transparent border border-transparent group-hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded outline-none text-xs';

  return (
    <div
      ref={tableRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="bg-white rounded-2xl shadow-xl flex flex-col h-[calc(100vh-160px)] print-full-height border border-slate-200 overflow-hidden outline-none focus:ring-2 focus:ring-blue-400/30"
    >
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
        <h2 className="font-black text-slate-800 flex items-center gap-2">
          取引一覧 <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{filteredData.length}{filteredData.length !== data.length ? `/${data.length}` : ''}件</span>
          {reviewCount > 0 && <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">要確認 {reviewCount}</span>}
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          {reviewCount > 0 && (
            <button onClick={jumpToNextReview} title="次の要確認へジャンプ" className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-black hover:bg-amber-100">
              <Icons.SkipForward className="w-3.5 h-3.5"/> 次の要確認
            </button>
          )}
          <button onClick={onUndo} disabled={!canUndo} aria-label="元に戻す (Ctrl+Z)" title="元に戻す (Ctrl+Z)" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-opacity">
            <Icons.Undo2 className="w-4 h-4 text-slate-600"/>
          </button>
          <button onClick={onRedo} disabled={!canRedo} aria-label="やり直す (Ctrl+Y)" title="やり直す (Ctrl+Y)" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-opacity">
            <Icons.Redo2 className="w-4 h-4 text-slate-600"/>
          </button>
          <span className="text-xs text-slate-400 font-bold hidden md:block bg-white px-2 py-1 rounded border no-print">↑↓ 移動 · Enter 次行</span>
          <button onClick={() => setMonthlyView(v => !v)} title="月次集計表示" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black no-print transition-colors ${monthlyView ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
            月別
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black no-print">
            <Icons.Print className="w-3.5 h-3.5"/> 印刷
          </button>
          <button onClick={() => Utils.downloadCSV(filteredData)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black no-print">
            <Icons.Download className="w-3.5 h-3.5"/> CSV
          </button>
        </div>
      </div>

      <FilterBar data={data} onFiltered={setFilteredData} />
      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/30">
        <datalist id="account-code-list">
          {ACCOUNT_CODE_LIST.map(c => <option key={c} value={c}/>)}
        </datalist>
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-30 shadow-sm border-b border-slate-200">
            <tr className="text-xs text-slate-500 uppercase font-black">
              <th className="p-2 w-8 text-center" title="ページ番号">P</th>
              <th className="p-2 w-20">口座</th>
              <th className="p-2 w-24">日付</th>
              <th className="p-2">摘要</th>
              <th className="p-2 w-20">科目</th>
              <th className="p-2 text-right w-20">出金</th>
              <th className="p-2 text-right w-20">入金</th>
              <th className="p-2 text-right w-24">残高</th>
              <th className="p-2 w-10 text-center" title="AIの読み取り精度">精度</th>
              <th className="p-2 w-14 text-center">状態</th>
              <th className="p-2 w-16 text-center no-print">照合</th>
              <th className="p-2 w-10 text-center no-print">操作</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => {
              if (row._isGroupHeader) {
                return (
                  <tr key={`grp-${row.month}`} className="bg-indigo-50 border-y border-indigo-200">
                    <td colSpan={4} className="p-2 font-black text-indigo-700 text-xs">
                      📅 {row.month} — {row.count}件
                    </td>
                    <td className="p-2"/>
                    <td className="p-2 text-right font-black text-red-600 text-xs">-¥{row.withdrawal.toLocaleString()}</td>
                    <td className="p-2 text-right font-black text-emerald-600 text-xs">+¥{row.deposit.toLocaleString()}</td>
                    <td colSpan={5} className="p-2 text-xs text-indigo-500 font-bold">
                      収支: {row.deposit - row.withdrawal >= 0 ? '+' : ''}¥{(row.deposit - row.withdrawal).toLocaleString()}
                    </td>
                  </tr>
                );
              }
              const row2 = row;
              const isActive = activeIndex === row2.globalIndex;
              const rowBg = isActive
                ? 'bg-blue-100/60 shadow-[inset_4px_0_0_#3b82f6]'
                : (row2._balanceIssue || row2._carryoverIssue) ? 'bg-red-50/50'
                : row2._duplicateIssue ? 'bg-orange-50/40'
                : row2._pageGapWarning ? 'bg-violet-50/40'
                : row2._materialityFlag ? 'bg-amber-50/30'
                : row2.needsReview ? 'bg-amber-50/50'
                : row2.isManual ? 'bg-purple-50/30'
                : 'bg-white hover:bg-slate-50';
              return (
                <tr
                  key={row2.globalIndex}
                  ref={el => rowRefs.current[row2.globalIndex] = el}
                  onClick={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); tableRef.current?.focus(); }}
                  className={`group transition-colors border-b border-slate-100 cursor-pointer ${rowBg}`}
                >
                  <td className="p-1.5 text-center text-slate-400 font-bold text-xs">{row2.pageIndex + 1}</td>
                  <td className="p-1"><input value={row2.bankName || ''} onChange={e => onUpdateData(row2.globalIndex, 'bankName', e.target.value)} onFocus={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); }} aria-label="金融機関" className={`${inputCls} font-bold`} /></td>
                  <td className="p-1"><input value={row2.date || ''} onChange={e => onUpdateData(row2.globalIndex, 'date', e.target.value)} onFocus={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); }} aria-label="日付" className={`${inputCls} font-mono text-slate-600`} /></td>
                  <td className="p-1"><input value={row2.description || ''} onChange={e => onUpdateData(row2.globalIndex, 'description', e.target.value)} onFocus={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); }} aria-label="摘要" className={`${inputCls} font-bold text-slate-800`} title={row2.note} /></td>
                  <td className="p-1"><input value={row2.accountCode || ''} onChange={e => onUpdateData(row2.globalIndex, 'accountCode', e.target.value)} onFocus={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); }} list="account-code-list" aria-label="科目" className={`${inputCls} text-slate-600`} placeholder="科目…"/></td>
                  <td className="p-1"><input value={row2.withdrawal || ''} onChange={e => onUpdateData(row2.globalIndex, 'withdrawal', e.target.value)} onFocus={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); }} aria-label="出金" className={`${inputCls} text-right text-red-600 font-mono`} /></td>
                  <td className="p-1"><input value={row2.deposit || ''} onChange={e => onUpdateData(row2.globalIndex, 'deposit', e.target.value)} onFocus={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); }} aria-label="入金" className={`${inputCls} text-right text-green-600 font-mono`} /></td>
                  <td className="p-1"><input value={row2.balance || ''} onChange={e => onUpdateData(row2.globalIndex, 'balance', e.target.value)} onFocus={() => { onRowActive(row2.globalIndex); onPageChange(row2.pageIndex); }} aria-label="残高" className={`${inputCls} text-right font-black ${row2._balanceIssue ? 'text-red-600' : 'text-slate-800'}`} /></td>
                  <td className="p-1 text-center"><ConfidenceBadge score={row2.confidenceScore}/></td>
                  <td className="p-1">
                    <div className="flex flex-col gap-0.5 items-center">
                      {row2._balanceIssue && <span title={row2._balanceIssue} className="px-1 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-600 cursor-help whitespace-nowrap">残高!</span>}
                      {row2._carryoverIssue && <span title={row2._carryoverIssue} className="px-1 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-600 cursor-help whitespace-nowrap">繰越!</span>}
                      {row2._duplicateIssue && <span title="同日・同額・同摘要の重複があります" className="px-1 py-0.5 rounded text-[9px] font-black bg-orange-100 text-orange-600 whitespace-nowrap">重複</span>}
                      {row2._pageGapWarning && <span title={row2._pageGapWarning} className="px-1 py-0.5 rounded text-[9px] font-black bg-violet-100 text-violet-600 cursor-help whitespace-nowrap">欠落</span>}
                      {row2._materialityFlag && <span title="重要性閾値を超える金額" className="px-1 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 whitespace-nowrap">大口</span>}
                      {row2.needsReview && <span className="px-1 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-600 whitespace-nowrap">要確認</span>}
                      {row2.isManual && <span className="px-1 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-600 whitespace-nowrap">追加</span>}
                      {!row2._balanceIssue && !row2._carryoverIssue && !row2._duplicateIssue && !row2._pageGapWarning && !row2.needsReview && !row2.isManual && <span title="問題なし" className="text-emerald-500 text-xs">✓</span>}
                    </div>
                  </td>
                  <td className="p-1 no-print">
                    <div className="flex items-center justify-center gap-0.5">
                      {[
                        { v: 'timing',      label: 'T差',  title: 'タイミング差異', cls: 'bg-sky-100 text-sky-700' },
                        { v: 'adjustment',  label: '調整', title: '調整仕訳必要',   cls: 'bg-orange-100 text-orange-700' },
                        { v: 'investigate', label: '調査', title: '要調査',         cls: 'bg-purple-100 text-purple-700' },
                      ].map(tag => (
                        <button key={tag.v}
                          onClick={e => { e.stopPropagation(); onUpdateData(row2.globalIndex, 'reconcileTag', row2.reconcileTag === tag.v ? null : tag.v); }}
                          title={tag.title}
                          aria-label={tag.title}
                          aria-pressed={row2.reconcileTag === tag.v}
                          className={`px-1 py-0.5 rounded text-[9px] font-black transition-colors ${row2.reconcileTag === tag.v ? tag.cls + ' ring-1 ring-inset ring-current' : 'opacity-30 hover:opacity-80 bg-slate-100 text-slate-600'}`}
                        >{tag.label}</button>
                      ))}
                    </div>
                  </td>
                  <td className="p-1 no-print">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={e => { e.stopPropagation(); onAddRow(row2.globalIndex); }} aria-label="この行の下に追加" title="この行の下に追加" className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700"><Icons.Plus className="w-3.5 h-3.5"/></button>
                      <button onClick={e => { e.stopPropagation(); onDeleteRow(row2.globalIndex); }} aria-label="削除" title="削除" className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500"><Icons.Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './icons.jsx';
import { usePassbookReader } from './usePassbookReader.js';
import { AccountAliasDialog, SessionManager, NormalizationMaster, SettingsModal, ConfirmDialog } from './components/Dialogs.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { DualProgressBar } from './components/TableComponents.jsx';
import { VerificationViewer } from './components/VerificationViewer.jsx';
import { ResultTable } from './components/ResultTable.jsx';

export default function App() {
  const {
    loading, data, error, pageImages, cacheHit, pdfProgress, apiProgress, summary,
    apiKey, saveApiKey, materialityThreshold, saveMaterialityThreshold,
    canUndo, canRedo, undo, redo,
    processFile, updateData, addRowAfter, deleteRow, applyNormalization, loadSession, reset
  } = usePassbookReader();

  const [currentPage, setCurrentPage] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);
  const [showAliasDialog, setShowAliasDialog] = useState(false);
  const [pendingAppendFile, setPendingAppendFile] = useState(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showNormMaster, setShowNormMaster] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const appendInputRef = useRef(null);

  useEffect(() => { setCurrentPage(0); }, [pageImages.length]);

  const handleAppendRequest = (file) => {
    setPendingAppendFile(file);
    setShowAliasDialog(true);
  };
  const handleAliasConfirm = (alias) => {
    setShowAliasDialog(false);
    if (pendingAppendFile) processFile(pendingAppendFile, true, alias);
    setPendingAppendFile(null);
  };

  const handleReset = () => {
    reset();
    setShowClearConfirm(false);
  };

  const handleReload = () => {
    document.getElementById('main-upload').click();
  };

  return (
    <div
      className="min-h-screen bg-[#f8fafc] p-4 md:p-6 font-sans text-slate-800"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !loading) { data.length > 0 ? handleAppendRequest(f) : processFile(f, false); } }}
    >
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-full-height { height: auto !important; max-height: none !important; overflow: visible !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { background: white !important; }
        }
      `}</style>

      {showAliasDialog && <AccountAliasDialog onConfirm={handleAliasConfirm} onCancel={() => { setShowAliasDialog(false); setPendingAppendFile(null); }} />}
      {showSessionManager && <SessionManager data={data} onLoad={loadSession} onClose={() => setShowSessionManager(false)} />}
      {showNormMaster && <NormalizationMaster onApply={applyNormalization} onClose={() => setShowNormMaster(false)} />}
      {showSettings && <SettingsModal apiKey={apiKey} onSaveApiKey={saveApiKey} onClose={() => setShowSettings(false)} />}
      {showClearConfirm && (
        <ConfirmDialog
          title="データをリセットしますか？"
          message={`${data.length}件の取引データと照合結果がすべて消去されます。この操作は元に戻せません。`}
          confirmLabel="リセットする"
          cancelLabel="キャンセル"
          onConfirm={handleReset}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      <div className="max-w-[1800px] mx-auto space-y-4">
        <header className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200">
              <Icons.ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">PassbookAI</h1>
              <p className="text-xs text-slate-400">AI による自動照合・残高検証</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {data.length > 0 && (
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 items-center gap-1.5 no-print">
                <span className="text-xs text-slate-400 font-black flex-shrink-0">大口基準</span>
                <input type="number" value={materialityThreshold || ''} onChange={e => saveMaterialityThreshold(parseInt(e.target.value, 10) || 0)} placeholder="0" className="bg-transparent text-xs font-mono outline-none w-20 text-slate-700" />
                <span className="text-xs text-slate-400 flex-shrink-0">円〜</span>
              </div>
            )}
            {data.length > 0 && (
              <>
                <button onClick={() => appendInputRef.current?.click()} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 no-print">
                  <Icons.Layers className="w-4 h-4"/> 口座を追加
                </button>
                <input ref={appendInputRef} type="file" onChange={e => { if (e.target.files[0]) handleAppendRequest(e.target.files[0]); e.target.value = ''; }} accept=".pdf,image/*" className="hidden" />
              </>
            )}
            <button onClick={() => setShowSessionManager(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 no-print">
              <Icons.Database className="w-4 h-4"/> セッション
            </button>
            <button onClick={() => setShowNormMaster(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 no-print">
              <Icons.Tag className="w-4 h-4"/> 変換ルール
            </button>
            <button
              onClick={() => setShowSettings(true)}
              title="設定"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border no-print transition-colors ${apiKey ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <Icons.Settings className="w-4 h-4"/>
              {apiKey ? 'Gemini 接続済み' : 'API キー未設定'}
            </button>
            {data.length > 0 && (
              <button onClick={() => setShowClearConfirm(true)} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 border border-red-200 flex items-center gap-1.5 no-print">
                <Icons.Trash2 className="w-4 h-4"/> データを消去
              </button>
            )}
          </div>
        </header>

        {summary && (
          <div className="grid grid-cols-4 md:grid-cols-9 gap-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            {[
              { l: '件数',       v: `${summary.total}件`,                     c: 'text-slate-800' },
              { l: '支出',       v: `¥${summary.withdrawal.toLocaleString()}`, c: 'text-red-600' },
              { l: '入金',       v: `¥${summary.deposit.toLocaleString()}`,    c: 'text-emerald-600' },
              { l: '要確認',     v: `${summary.review}件`,                     c: summary.review > 0 ? 'text-amber-500' : 'text-slate-300' },
              { l: '残高エラー', v: `${summary.balanceIssues}件`,              c: summary.balanceIssues > 0 ? 'text-red-500' : 'text-slate-300' },
              { l: '繰越エラー', v: `${summary.carryoverIssues}件`,            c: summary.carryoverIssues > 0 ? 'text-red-500' : 'text-slate-300' },
              { l: '重複検出',   v: `${summary.duplicates}件`,                 c: summary.duplicates > 0 ? 'text-orange-500' : 'text-slate-300' },
              { l: '大口',       v: `${summary.materialityFlags}件`,           c: summary.materialityFlags > 0 ? 'text-amber-600' : 'text-slate-300' },
              { l: 'ページ欠落', v: `${summary.pageGapWarnings}件`,            c: summary.pageGapWarnings > 0 ? 'text-violet-600' : 'text-slate-300' },
            ].map(s => (
              <div key={s.l} className="text-center">
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">{s.l}</p>
                <p className={`text-xl font-black ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
        )}

        {cacheHit && (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-xs font-bold text-sky-700">
            <div className="flex items-center gap-2">
              <Icons.Layers className="w-4 h-4 flex-shrink-0"/>
              前回の作業データを復元しました。画像を表示するにはファイルを再読込してください。
            </div>
            <button onClick={handleReload} className="flex items-center gap-1 px-3 py-1.5 bg-sky-100 hover:bg-sky-200 rounded-lg text-sky-800 font-black whitespace-nowrap flex-shrink-0">
              <Icons.UploadCloud className="w-3.5 h-3.5"/> ファイルを再読込
            </button>
          </div>
        )}

        {!data.length ? (
          <div className="max-w-3xl mx-auto pt-8">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 p-12 text-center">
              <h2 className="text-3xl font-black text-slate-800 mb-3">AI で通帳を照合・検証</h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm">PDF・画像をドロップまたはクリックして選択。<br/>残高・重複・繰越を自動で検出します。</p>

              {!apiKey && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-700 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2"><Icons.Key className="w-4 h-4 flex-shrink-0"/> Gemini API キーが設定されていません。</span>
                  <button onClick={() => setShowSettings(true)} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg text-xs font-black whitespace-nowrap">キーを設定する</button>
                </div>
              )}

              <button
                onClick={() => document.getElementById('main-upload').click()}
                disabled={loading}
                className={`w-full py-16 border-4 border-dashed rounded-[2rem] transition-all duration-300 ${loading ? 'border-blue-400 bg-blue-50 cursor-wait' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'}`}
              >
                <input id="main-upload" type="file" onChange={e => e.target.files[0] && processFile(e.target.files[0], false)} accept=".pdf,image/*" className="hidden" />
                <div className="flex flex-col items-center gap-2">
                  {loading
                    ? <Icons.Loader2 className="animate-spin text-blue-600 w-12 h-12"/>
                    : <div className="bg-blue-600 text-white p-5 rounded-3xl shadow-xl shadow-blue-200"><Icons.UploadCloud className="w-10 h-10" /></div>
                  }
                  {!loading && <span className="text-2xl font-black text-slate-800 mt-2">ファイルを開く</span>}
                </div>
              </button>

              {loading && (
                <div className="flex justify-center mt-4">
                  <DualProgressBar pdfProgress={pdfProgress} apiProgress={apiProgress} />
                </div>
              )}

              {loading && pageImages.filter(Boolean).length > 0 && (
                <div className="mt-4 text-left">
                  <p className="text-xs text-slate-500 font-bold mb-2">読み込み中 — {pageImages.filter(Boolean).length} ページ</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {pageImages.map((img, i) => img
                      ? <img key={i} src={img} alt={`p${i+1}`} className="h-20 w-auto rounded border border-slate-200 shadow-sm flex-shrink-0"/>
                      : <div key={i} className="h-20 w-14 rounded border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0"><Icons.Loader2 className="animate-spin w-4 h-4 text-slate-400"/></div>
                    )}
                  </div>
                </div>
              )}

              {error && <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-bold text-sm flex items-center gap-2"><Icons.AlertCircle className="w-5 h-5 flex-shrink-0"/>{error}</div>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            <div className="print-only col-span-2 border-b-2 border-slate-800 pb-4 mb-2">
              <h1 className="text-2xl font-black text-slate-900">PassbookAI — 抽出レポート</h1>
              <div className="flex flex-wrap gap-6 mt-2 text-sm text-slate-600">
                {summary && <><span>総件数: {summary.total}件</span><span>出金計: ¥{summary.withdrawal.toLocaleString()}</span><span>入金計: ¥{summary.deposit.toLocaleString()}</span>{summary.balanceIssues > 0 && <span className="text-red-600">残高不整合: {summary.balanceIssues}件</span>}{summary.duplicates > 0 && <span className="text-orange-600">重複疑い: {summary.duplicates}件</span>}{summary.carryoverIssues > 0 && <span className="text-red-600">繰越不整合: {summary.carryoverIssues}件</span>}{summary.materialityFlags > 0 && <span className="text-amber-700">大口取引: {summary.materialityFlags}件</span>}</>}
              </div>
            </div>
            <div className="no-print">
              <VerificationViewer
                images={pageImages} data={data}
                currentPage={currentPage} onPageChange={setCurrentPage}
                activeIndex={activeIndex} onRowActive={setActiveIndex}
              />
            </div>
            <div className="print-full-height">
              <ErrorBoundary>
              <ResultTable
                data={data} activeIndex={activeIndex}
                onRowActive={setActiveIndex} onPageChange={setCurrentPage}
                onUpdateData={updateData} onAddRow={addRowAfter} onDeleteRow={deleteRow}
                canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
              />
              </ErrorBoundary>
            </div>
            {loading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-2xl gap-4 no-print">
                <Icons.Loader2 className="animate-spin text-blue-600 w-10 h-10"/>
                <DualProgressBar pdfProgress={pdfProgress} apiProgress={apiProgress} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

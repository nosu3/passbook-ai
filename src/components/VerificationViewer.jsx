import React, { useRef, useEffect } from 'react';
import { Icons } from '../icons.jsx';
import { LoupeCanvas } from './TableComponents.jsx';

export const VerificationViewer = ({ images, data, currentPage, onPageChange, activeIndex, onRowActive }) => {
  const currentTxs = data.filter(t => t.pageIndex === currentPage);
  const activeTx = data.find(t => t.globalIndex === activeIndex);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!activeTx || activeTx.pageIndex !== currentPage || !activeTx.boundingBox?.length || !containerRef.current) return;
    const [ymin] = activeTx.boundingBox;
    const container = containerRef.current;
    container.scrollTo({ top: (ymin / 1000) * container.scrollHeight - container.clientHeight / 2 + 40, behavior: 'smooth' });
  }, [activeIndex, currentPage, activeTx]);

  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-160px)] border border-slate-700">
      <div className="p-3 bg-slate-950 flex justify-between items-center border-b border-slate-800">
        <span className="text-xs font-bold flex items-center gap-2 text-slate-200"><Icons.FileText className="w-4 h-4"/> 証跡プレビュー</span>
        {images.length > 1 && (
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)} className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"><Icons.ChevronLeft className="w-5 h-5 text-white"/></button>
            <span className="text-xs font-mono text-white">P.{currentPage + 1} / {images.length}</span>
            <button disabled={currentPage === images.length - 1} onClick={() => onPageChange(currentPage + 1)} className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"><Icons.ChevronRight className="w-5 h-5 text-white"/></button>
          </div>
        )}
      </div>

      {activeTx && activeTx.pageIndex === currentPage && activeTx.boundingBox?.length >= 4 && (
        <div className="border-b border-slate-700 bg-slate-800 p-2">
          <div className="text-[10px] text-blue-400 font-black mb-1 flex items-center gap-1">🔍 拡大鏡 — {activeTx.description}</div>
          <LoupeCanvas imageSrc={images[currentPage]} boundingBox={activeTx.boundingBox} />
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-auto bg-[#1a1a1a] p-4 flex justify-center items-start custom-scrollbar">
        <div className="relative inline-block shadow-2xl">
          {images[currentPage]
            ? <img src={images[currentPage]} alt="Passbook" className="max-w-none w-full h-auto rounded-sm border border-slate-700" style={{ minWidth: '600px' }} />
            : <div className="w-[600px] h-64 bg-slate-800 rounded flex items-center justify-center"><Icons.Loader2 className="animate-spin text-slate-500 w-8 h-8"/></div>
          }
          {currentTxs.map(t => {
            const [ymin, xmin, ymax, xmax] = t.boundingBox || [];
            if (ymin == null) return null;
            const isActive = t.globalIndex === activeIndex;
            const color = t.isManual ? 'ring-purple-400 bg-purple-400/10'
              : t._balanceIssue ? (isActive ? 'ring-red-500 bg-red-500/20' : 'ring-red-400/60 bg-red-400/10')
              : t.needsReview ? (isActive ? 'ring-amber-500 bg-amber-500/20' : 'ring-amber-400/60 bg-amber-400/10')
              : (isActive ? 'ring-blue-400 bg-blue-400/20' : 'ring-blue-500/30 bg-blue-500/5');
            return (
              <div key={t.globalIndex} onMouseEnter={() => onRowActive(t.globalIndex)}
                className={`absolute transition-all duration-100 cursor-pointer ${isActive ? 'z-50 ring-4' : 'z-10 ring-2 hover:ring-4'} ${color}`}
                style={{ top: `${ymin/10}%`, left: `${xmin/10}%`, height: `${(ymax-ymin)/10}%`, width: `${(xmax-xmin)/10}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React, { useRef, useEffect } from 'react';

export const ConfidenceBadge = ({ score }) => {
  if (score == null) return null;
  const color = score >= 90 ? 'bg-emerald-100 text-emerald-700' : score >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`px-1.5 py-0.5 rounded text-xs font-black ${color}`}>{score}</span>;
};

export const DualProgressBar = ({ pdfProgress, apiProgress }) => {
  const pdfPct = pdfProgress.total > 0 ? (pdfProgress.current / pdfProgress.total) * 100 : 0;
  const apiPct = apiProgress.total > 0 ? (apiProgress.current / apiProgress.total) * 100 : 0;
  if (!pdfProgress.text && !apiProgress.text) return null;
  return (
    <div className="w-full max-w-sm space-y-1.5 mt-4">
      {pdfProgress.text && (
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
            <span>📄 {pdfProgress.text}</span>
            <span>{Math.round(pdfPct)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${pdfPct || (pdfProgress.text ? 10 : 0)}%` }} />
          </div>
        </div>
      )}
      {apiProgress.text && (
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
            <span>🤖 {apiProgress.text}</span>
            <span>{Math.round(apiPct)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${apiPct || (apiProgress.text ? 5 : 0)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export const LoupeCanvas = ({ imageSrc, boundingBox }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!imageSrc || !boundingBox || boundingBox.length < 4) return;
    const [ymin, , ymax] = boundingBox;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const margin = 0.04;
      const sy = Math.max(0, ((ymin / 1000) - margin) * img.height);
      const sh = Math.min(img.height - sy, (((ymax - ymin) / 1000) + margin * 2) * img.height);
      canvas.width = 600; canvas.height = 80;
      ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageSrc;
  }, [imageSrc, boundingBox]);
  return <canvas ref={canvasRef} className="w-full h-20 object-cover rounded" />;
};

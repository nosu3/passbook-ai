import React, { useState } from 'react';
import { Icons } from '../icons.jsx';
import { SessionService, NormalizationRules } from '../services.js';

export const ConfirmDialog = ({ title, message, confirmLabel = '実行', cancelLabel = 'キャンセル', onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200">
      <h3 className="text-base font-black text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">{cancelLabel}</button>
        <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-black hover:bg-red-700">{confirmLabel}</button>
      </div>
    </div>
  </div>
);

export const SettingsModal = ({ apiKey, onSaveApiKey, onClose }) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const handleSave = () => { onSaveApiKey(localKey.trim()); onClose(); };
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Icons.Settings className="w-5 h-5 text-slate-600"/> 設定
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><Icons.X className="w-5 h-5 text-slate-500"/></button>
        </div>
        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Gemini API キー</label>
        <div className="flex bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 items-center gap-2 mb-1">
          <Icons.Key className="w-4 h-4 text-slate-400 flex-shrink-0"/>
          <input
            type="password"
            value={localKey}
            onChange={e => setLocalKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="APIキーを入力..."
            className="bg-transparent text-sm font-mono outline-none flex-1"
            autoFocus
          />
          {localKey && <Icons.ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0"/>}
        </div>
        <p className="text-xs text-slate-400 mb-6">Google AI Studio から取得した Gemini API キーを入力してください。</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">キャンセル</button>
          <button onClick={handleSave} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700">保存して閉じる</button>
        </div>
      </div>
    </div>
  );
};

export const AccountAliasDialog = ({ onConfirm, onCancel }) => {
  const [alias, setAlias] = useState('');
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-slate-200">
        <h3 className="text-lg font-black text-slate-900 mb-2">口座名を設定</h3>
        <p className="text-sm text-slate-500 mb-1">
          複数口座を照合する際の識別名です。
        </p>
        <p className="text-xs text-slate-400 mb-4">例：○○銀行普通預金、小口現金口座</p>
        <input
          autoFocus
          value={alias}
          onChange={e => setAlias(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && alias.trim() && onConfirm(alias.trim())}
          placeholder="例：○○銀行普通預金"
          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">キャンセル</button>
          <button onClick={() => onConfirm(alias.trim() || '追加口座')} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700">読み込む</button>
        </div>
      </div>
    </div>
  );
};

export const SessionManager = ({ data, onLoad, onClose }) => {
  const [sessions, setSessions] = useState(() => SessionService.list());
  const [newName, setNewName] = useState('');

  const handleSave = () => {
    const name = newName.trim() || `セッション ${new Date().toLocaleString('ja-JP')}`;
    SessionService.save(name, data);
    setSessions(SessionService.list());
    setNewName('');
  };
  const handleLoad = (name) => {
    const d = SessionService.load(name);
    if (d) { onLoad(d); onClose(); }
  };
  const handleDelete = (name) => {
    SessionService.delete(name); setSessions(SessionService.list());
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Icons.Database className="w-5 h-5 text-blue-600"/> 作業データの保存・読み込み</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><Icons.X className="w-5 h-5 text-slate-500"/></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="保存名（省略すると日時が自動入力）" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"/>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-black hover:bg-blue-700">保存</button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              保存されたデータはありません。<br/>
              <span className="text-xs">上のフィールドに名前を入力して保存してください。</span>
            </p>
          )}
          {sessions.map(s => (
            <div key={s.name} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50">
              <div>
                <p className="text-sm font-bold text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-400">{new Date(s.savedAt).toLocaleString('ja-JP')} · {s.data.length}件</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleLoad(s.name)} title="現在のデータを置き換えて読み込みます" className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded font-bold hover:bg-blue-100">読み込む</button>
                <button onClick={() => handleDelete(s.name)} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded font-bold hover:bg-red-100">削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const NormalizationMaster = ({ onApply, onClose }) => {
  const [rules, setRules] = useState(() => NormalizationRules.load());
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');

  const handleAdd = () => {
    if (!pattern.trim()) return;
    const next = [...rules, { pattern: pattern.trim(), replacement: replacement.trim() }];
    setRules(next); NormalizationRules.save(next); setPattern(''); setReplacement('');
  };
  const handleDelete = (i) => {
    const next = rules.filter((_, j) => j !== i);
    setRules(next); NormalizationRules.save(next);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Icons.Tag className="w-5 h-5 text-emerald-600"/> 摘要の自動変換ルール</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><Icons.X className="w-5 h-5 text-slate-500"/></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">摘要テキストを検索・置換するルールを設定します。ファイル読込時と手動適用時に自動実行されます。</p>
        <div className="flex gap-2 mb-3">
          <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="検索パターン（正規表現）" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono"/>
          <input value={replacement} onChange={e => setReplacement(e.target.value)} placeholder="置換後のテキスト" className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"/>
          <button onClick={handleAdd} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700">追加</button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
          {rules.length === 0 && <p className="text-sm text-slate-400 text-center py-4">ルールが登録されていません</p>}
          {rules.map((r, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded border border-slate-100 bg-slate-50 text-xs">
              <span className="font-mono text-slate-600">{r.pattern}</span>
              <span className="text-slate-400 mx-2">→</span>
              <span className="flex-1 text-slate-700">{r.replacement || '（削除）'}</span>
              <button onClick={() => handleDelete(i)} className="ml-2 text-red-400 hover:text-red-600"><Icons.X className="w-3.5 h-3.5"/></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">閉じる</button>
          <button onClick={() => { onApply(); onClose(); }} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700">現在のデータに適用</button>
        </div>
      </div>
    </div>
  );
};

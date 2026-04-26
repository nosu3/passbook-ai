import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountPatterns, NormalizationRules, SessionService } from '../services.js';

// localStorage のモック
const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
});

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

// ─── NormalizationRules ───────────────────────────────────────────────────────
describe('NormalizationRules.applyOne', () => {
  it('パターンに一致した文字列を置換', () => {
    const rules = [{ pattern: 'ATM', replacement: 'ATM出金' }];
    expect(NormalizationRules.applyOne('ATM引出', rules)).toBe('ATM出金引出');
  });

  it('複数ルールを順番に適用', () => {
    const rules = [
      { pattern: 'ABC', replacement: 'DEF' },
      { pattern: 'DEF', replacement: 'GHI' },
    ];
    expect(NormalizationRules.applyOne('ABC', rules)).toBe('GHI');
  });

  it('無効な正規表現はスキップ', () => {
    const rules = [{ pattern: '[invalid', replacement: 'x' }];
    expect(NormalizationRules.applyOne('test', rules)).toBe('test');
  });

  it('空文字でも動作する', () => {
    const rules = [{ pattern: 'x', replacement: 'y' }];
    expect(NormalizationRules.applyOne('', rules)).toBe('');
  });

  it('patternなしのルールはスキップ', () => {
    const rules = [{ pattern: '', replacement: 'y' }];
    expect(NormalizationRules.applyOne('abc', rules)).toBe('abc');
  });
});

describe('NormalizationRules.save / load', () => {
  it('保存したルールを読み込める', () => {
    const rules = [{ pattern: 'test', replacement: 'replaced' }];
    NormalizationRules.save(rules);
    expect(NormalizationRules.load()).toEqual(rules);
  });

  it('未保存は空配列', () => {
    expect(NormalizationRules.load()).toEqual([]);
  });
});

// ─── AccountPatterns ─────────────────────────────────────────────────────────
describe('AccountPatterns.learn / apply', () => {
  it('学習したパターンを適用', () => {
    AccountPatterns.learn('電気代', '消耗品費');
    const txs = [{ description: '電気代', accountCode: '' }];
    const result = AccountPatterns.apply(txs);
    expect(result[0].accountCode).toBe('消耗品費');
  });

  it('既存のaccountCodeは上書きしない', () => {
    AccountPatterns.learn('電気代', '消耗品費');
    const txs = [{ description: '電気代', accountCode: '地代家賃' }];
    const result = AccountPatterns.apply(txs);
    expect(result[0].accountCode).toBe('地代家賃');
  });

  it('空の説明は学習しない', () => {
    AccountPatterns.learn('', '消耗品費');
    expect(Object.keys(AccountPatterns.load())).toHaveLength(0);
  });
});

// ─── SessionService ───────────────────────────────────────────────────────────
describe('SessionService', () => {
  const sampleData = [{ globalIndex: '1', date: '2024/01/01', description: 'テスト' }];

  it('保存して読み込める', () => {
    SessionService.save('テストセッション', sampleData);
    const loaded = SessionService.load('テストセッション');
    expect(loaded).toEqual(sampleData);
  });

  it('存在しないセッションはnull', () => {
    expect(SessionService.load('存在しない')).toBeNull();
  });

  it('削除後はnull', () => {
    SessionService.save('削除テスト', sampleData);
    SessionService.delete('削除テスト');
    expect(SessionService.load('削除テスト')).toBeNull();
  });

  it('同名で上書き保存', () => {
    SessionService.save('重複テスト', sampleData);
    const newData = [{ globalIndex: '2', date: '2024/02/01', description: '更新' }];
    SessionService.save('重複テスト', newData);
    const sessions = SessionService.list();
    expect(sessions.filter(s => s.name === '重複テスト')).toHaveLength(1);
    expect(SessionService.load('重複テスト')).toEqual(newData);
  });

  it('list()は配列を返す', () => {
    SessionService.save('s1', sampleData);
    SessionService.save('s2', sampleData);
    expect(SessionService.list().length).toBeGreaterThanOrEqual(2);
  });
});

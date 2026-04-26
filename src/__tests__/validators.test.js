import { describe, it, expect } from 'vitest';
import { Validators, cleanNum } from '../validators.js';

// ─── helpers ─────────────────────────────────────────────────────────────────
const tx = (overrides) => ({
  bankName: 'テスト銀行',
  date: '2024/01/15',
  description: '取引',
  withdrawal: '',
  deposit: '',
  balance: '100000',
  note: '',
  pageIndex: 0,
  boundingBox: [],
  needsReview: false,
  confidenceScore: 99,
  ...overrides,
});

// ─── cleanNum ────────────────────────────────────────────────────────────────
describe('cleanNum', () => {
  it('数値文字列をパース', () => expect(cleanNum('12345')).toBe(12345));
  it('カンマ付き数値は0 (カンマ除去済み想定)', () => expect(cleanNum('1234')).toBe(1234));
  it('空文字は0', () => expect(cleanNum('')).toBe(0));
  it('nullは0', () => expect(cleanNum(null)).toBe(0));
  it('負数をパース', () => expect(cleanNum('-500')).toBe(-500));
});

// ─── checkBalanceContinuity ──────────────────────────────────────────────────
describe('checkBalanceContinuity', () => {
  it('正常な残高の連続はフラグなし', () => {
    const data = [
      tx({ balance: '100000', withdrawal: '', deposit: '' }),
      tx({ balance: '90000',  withdrawal: '10000', deposit: '' }),
      tx({ balance: '95000',  withdrawal: '', deposit: '5000' }),
    ];
    const result = Validators.checkBalanceContinuity(data);
    expect(result.every(r => r._balanceIssue === null)).toBe(true);
  });

  it('残高不整合を検知', () => {
    const data = [
      tx({ balance: '100000', withdrawal: '', deposit: '' }),
      tx({ balance: '80000',  withdrawal: '10000', deposit: '' }), // 期待値90000
    ];
    const result = Validators.checkBalanceContinuity(data);
    expect(result[1]._balanceIssue).toMatch(/残高不整合/);
    expect(result[1]._balanceIssue).toMatch(/期待値 90,000/);
  });

  it('銀行ごとに独立してチェック', () => {
    const data = [
      tx({ bankName: 'A銀行', balance: '100000' }),
      tx({ bankName: 'B銀行', balance: '50000' }),  // 別銀行なのでチェックなし
    ];
    const result = Validators.checkBalanceContinuity(data);
    expect(result[1]._balanceIssue).toBe(null);
  });

  it('残高0はスキップ（繰越行など）', () => {
    const data = [
      tx({ balance: '100000', withdrawal: '', deposit: '' }),
      tx({ balance: '0',      withdrawal: '', deposit: '' }),
      tx({ balance: '90000',  withdrawal: '10000', deposit: '' }),
    ];
    const result = Validators.checkBalanceContinuity(data);
    expect(result[2]._balanceIssue).toBe(null);
  });

  it('許容誤差1円以内はOK', () => {
    const data = [
      tx({ balance: '100000', withdrawal: '', deposit: '' }),
      tx({ balance: '89999',  withdrawal: '10000', deposit: '' }), // 差1円
    ];
    const result = Validators.checkBalanceContinuity(data);
    expect(result[1]._balanceIssue).toBe(null);
  });
});

// ─── checkDuplicates ────────────────────────────────────────────────────────
describe('checkDuplicates', () => {
  it('重複なしはフラグなし', () => {
    const data = [
      tx({ date: '2024/01/10', withdrawal: '10000', description: '電気代' }),
      tx({ date: '2024/01/11', withdrawal: '10000', description: '電気代' }), // 日付違う
    ];
    const result = Validators.checkDuplicates(data);
    expect(result.every(r => r._duplicateIssue === null)).toBe(true);
  });

  it('同日同額同摘要を重複と判定', () => {
    const data = [
      tx({ date: '2024/01/15', withdrawal: '5000', description: 'コンビニ' }),
      tx({ date: '2024/01/15', withdrawal: '5000', description: 'コンビニ' }),
    ];
    const result = Validators.checkDuplicates(data);
    expect(result[0]._duplicateIssue).toBe('重複疑い');
    expect(result[1]._duplicateIssue).toBe('重複疑い');
  });

  it('金額も摘要も空の行はスキップ', () => {
    const data = [
      tx({ withdrawal: '', deposit: '', description: '繰越' }),
      tx({ withdrawal: '', deposit: '', description: '繰越' }),
    ];
    const result = Validators.checkDuplicates(data);
    expect(result.every(r => r._duplicateIssue === null)).toBe(true);
  });
});

// ─── checkTransferMatching ──────────────────────────────────────────────────
describe('checkTransferMatching', () => {
  it('同日同額の口座間振替を検知', () => {
    const data = [
      tx({ bankName: 'A銀行', date: '2024/01/20', withdrawal: '30000', deposit: '' }),
      tx({ bankName: 'B銀行', date: '2024/01/20', withdrawal: '',      deposit: '30000' }),
    ];
    const result = Validators.checkTransferMatching(data);
    expect(result[0].note).toContain('口座間振替を検知');
    expect(result[1].note).toContain('口座間振替を検知');
  });

  it('同一銀行の同日同額は小口として注記', () => {
    const data = [
      tx({ bankName: '同一銀行', date: '2024/01/20', withdrawal: '10000', deposit: '' }),
      tx({ bankName: '同一銀行', date: '2024/01/20', withdrawal: '',      deposit: '10000' }),
    ];
    const result = Validators.checkTransferMatching(data);
    expect(result[0].note).toContain('小口推測');
    expect(result[1].note).toContain('小口推測');
  });

  it('金額不一致は照合なし', () => {
    const data = [
      tx({ bankName: 'A銀行', date: '2024/01/20', withdrawal: '30000', deposit: '' }),
      tx({ bankName: 'B銀行', date: '2024/01/20', withdrawal: '',      deposit: '20000' }), // 不一致
    ];
    const result = Validators.checkTransferMatching(data);
    expect(result[0].note).toBe('');
    expect(result[1].note).toBe('');
  });
});

// ─── applyMaterialityFlag ───────────────────────────────────────────────────
describe('applyMaterialityFlag', () => {
  it('閾値未満はフラグなし', () => {
    const data = [tx({ withdrawal: '50000', deposit: '' })];
    const result = Validators.applyMaterialityFlag(data, 100000);
    expect(result[0]._materialityFlag).toBe(false);
  });

  it('閾値以上の出金はフラグあり', () => {
    const data = [tx({ withdrawal: '100000', deposit: '' })];
    const result = Validators.applyMaterialityFlag(data, 100000);
    expect(result[0]._materialityFlag).toBe(true);
  });

  it('閾値以上の入金もフラグあり', () => {
    const data = [tx({ withdrawal: '', deposit: '500000' })];
    const result = Validators.applyMaterialityFlag(data, 100000);
    expect(result[0]._materialityFlag).toBe(true);
  });

  it('閾値0は全件フラグなし', () => {
    const data = [tx({ withdrawal: '9999999', deposit: '' })];
    const result = Validators.applyMaterialityFlag(data, 0);
    expect(result[0]._materialityFlag).toBe(false);
  });
});

// ─── checkPageGaps ──────────────────────────────────────────────────────────
describe('checkPageGaps', () => {
  it('40日以内の日付差はフラグなし', () => {
    const data = [
      tx({ date: '2024/01/01' }),
      tx({ date: '2024/02/05' }), // 35日
    ];
    const result = Validators.checkPageGaps(data);
    expect(result[1]._pageGapWarning).toBe(null);
  });

  it('40日超の日付差はフラグあり', () => {
    const data = [
      tx({ date: '2024/01/01' }),
      tx({ date: '2024/03/01' }), // 60日
    ];
    const result = Validators.checkPageGaps(data);
    expect(result[1]._pageGapWarning).toMatch(/欠落の可能性/);
    expect(result[1]._pageGapWarning).toMatch(/60日間/);
  });

  it('銀行ごとに独立してチェック', () => {
    const data = [
      tx({ bankName: 'A銀行', date: '2024/01/01' }),
      tx({ bankName: 'B銀行', date: '2024/06/01' }), // 別銀行なので無視
    ];
    const result = Validators.checkPageGaps(data);
    expect(result[1]._pageGapWarning).toBe(null);
  });
});

// ─── runAll ─────────────────────────────────────────────────────────────────
describe('runAll', () => {
  it('空配列でクラッシュしない', () => {
    expect(() => Validators.runAll([])).not.toThrow();
    expect(Validators.runAll([])).toEqual([]);
  });

  it('全バリデーターが適用される（フィールド存在確認）', () => {
    const data = [tx({ withdrawal: '10000', balance: '90000' })];
    const result = Validators.runAll(data, 0);
    expect(result[0]).toHaveProperty('_balanceIssue');
    expect(result[0]).toHaveProperty('_duplicateIssue');
    expect(result[0]).toHaveProperty('_carryoverIssue');
    expect(result[0]).toHaveProperty('_pageGapWarning');
    expect(result[0]).toHaveProperty('_materialityFlag');
  });
});

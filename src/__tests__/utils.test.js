import { describe, it, expect, vi } from 'vitest';
import { Utils } from '../utils.js';

// ─── cleanNum ─────────────────────────────────────────────────────────────────
describe('Utils.cleanNum', () => {
  it('数値文字列をパース', () => expect(Utils.cleanNum('12345')).toBe(12345));
  it('カンマ付きは除去済み想定', () => expect(Utils.cleanNum('1234')).toBe(1234));
  it('空文字は0', () => expect(Utils.cleanNum('')).toBe(0));
  it('nullは0', () => expect(Utils.cleanNum(null)).toBe(0));
  it('undefinedは0', () => expect(Utils.cleanNum(undefined)).toBe(0));
  it('負数をパース', () => expect(Utils.cleanNum('-500')).toBe(-500));
  it('全角数字は0', () => expect(Utils.cleanNum('１２３')).toBe(0));
});

// ─── normDate ────────────────────────────────────────────────────────────────
describe('Utils.normDate', () => {
  it('スラッシュをハイフンに変換', () => expect(Utils.normDate('2024/01/15')).toBe('2024-01-15'));
  it('ハイフン済みはそのまま', () => expect(Utils.normDate('2024-01-15')).toBe('2024-01-15'));
  it('nullは空文字', () => expect(Utils.normDate(null)).toBe(''));
  it('undefinedは空文字', () => expect(Utils.normDate(undefined)).toBe(''));
});

// ─── validateFile ────────────────────────────────────────────────────────────
describe('Utils.validateFile', () => {
  const makeFile = (size, type) => ({ size, type });

  it('PDFは許可', () => {
    expect(() => Utils.validateFile(makeFile(1024, 'application/pdf'))).not.toThrow();
  });
  it('JPEGは許可', () => {
    expect(() => Utils.validateFile(makeFile(1024, 'image/jpeg'))).not.toThrow();
  });
  it('50MB超はエラー', () => {
    expect(() => Utils.validateFile(makeFile(51 * 1024 * 1024, 'application/pdf')))
      .toThrow('ファイルサイズが上限');
  });
  it('非対応形式はエラー', () => {
    expect(() => Utils.validateFile(makeFile(1024, 'text/plain')))
      .toThrow('非対応のファイル形式');
  });
  it('nullはエラー', () => {
    expect(() => Utils.validateFile(null)).toThrow('ファイルが選択されていません');
  });
});

// ─── runWithConcurrencyLimit ─────────────────────────────────────────────────
describe('Utils.runWithConcurrencyLimit', () => {
  it('全タスクが完了する', async () => {
    const tasks = [1, 2, 3].map(n => async () => n * 2);
    const results = await Utils.runWithConcurrencyLimit(tasks, 2, () => {});
    expect(results).toEqual([2, 4, 6]);
  });

  it('同時実行数を超えない', async () => {
    let concurrent = 0; let maxConcurrent = 0;
    const tasks = Array.from({ length: 6 }, () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
    });
    await Utils.runWithConcurrencyLimit(tasks, 2, () => {});
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('progressコールバックが呼ばれる', async () => {
    const progress = vi.fn();
    const tasks = [1, 2, 3].map(n => async () => n);
    await Utils.runWithConcurrencyLimit(tasks, 3, progress);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it('失敗タスクはerrorプロパティで返る', async () => {
    const tasks = [
      async () => 'ok',
      async () => { throw new Error('失敗'); },
    ];
    const results = await Utils.runWithConcurrencyLimit(tasks, 1, () => {});
    expect(results[0]).toBe('ok');
    expect(results[1].error.message).toBe('失敗');
  });
});

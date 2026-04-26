// Pure validation logic — no React / DOM dependencies
export const cleanNum = (str) => parseInt(String(str || '').replace(/[^\d-]/g, ''), 10) || 0;

export const Validators = {
  checkBalanceContinuity: (transactions) => {
    const result = transactions.map(t => ({
      ...t,
      _balanceIssue: null,
      note: String(t.note || '').replace(/【残高不整合[^】]*】/g, '').trim()
    }));

    const grouped = {};
    result.forEach(t => { (grouped[t.bankName] = grouped[t.bankName] || []).push(t); });

    Object.values(grouped).forEach(group => {
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1]; const curr = group[i];
        const prevBal = cleanNum(prev.balance);
        const currBal = cleanNum(curr.balance);
        if (!prevBal || !currBal) continue;
        const expected = prevBal - cleanNum(curr.withdrawal) + cleanNum(curr.deposit);
        if (Math.abs(expected - currBal) > 1) {
          curr._balanceIssue = `残高不整合: 期待値 ${expected.toLocaleString()} / 実際 ${currBal.toLocaleString()}`;
          curr.note = `${curr.note ? curr.note + ' ' : ''}【残高不整合】期待値:${expected.toLocaleString()} 実際:${currBal.toLocaleString()}`;
        }
      }
    });
    return result;
  },

  checkTransferMatching: (transactions) => {
    const result = transactions.map(t => ({
      ...t,
      note: String(t.note || '').replace(/【自動照合】[^】]*】?/g, '').trim()
    }));
    const matched = new Set();
    const depositIndex = new Map();
    result.forEach((t, j) => {
      const amt = cleanNum(t.deposit);
      if (amt <= 0) return;
      const key = `${t.date}_${amt}`;
      if (!depositIndex.has(key)) depositIndex.set(key, []);
      depositIndex.get(key).push(j);
    });
    result.forEach((w, i) => {
      if (matched.has(i)) return;
      const wAmt = cleanNum(w.withdrawal);
      if (wAmt <= 0) return;
      const candidates = depositIndex.get(`${w.date}_${wAmt}`) || [];
      const matchIdx = candidates.find(j => j !== i && !matched.has(j));
      if (matchIdx == null) return;
      const isCrossAccount = result[i].bankName !== result[matchIdx].bankName;
      const msg = isCrossAccount ? '【自動照合】口座間振替を検知' : '【自動照合】同日同額の入金あり(小口推測)';
      const msgR = isCrossAccount ? '【自動照合】口座間振替を検知' : '【自動照合】同日同額の出金あり(小口推測)';
      result[i].note = `${result[i].note ? result[i].note + ' ' : ''}${msg}`;
      result[matchIdx].note = `${result[matchIdx].note ? result[matchIdx].note + ' ' : ''}${msgR}`;
      matched.add(i); matched.add(matchIdx);
    });
    return result;
  },

  checkDuplicates: (transactions) => {
    const result = transactions.map(t => ({ ...t, _duplicateIssue: null }));
    const seen = new Map();
    result.forEach((t, i) => {
      const w = String(t.withdrawal || '').trim();
      const d = String(t.deposit || '').trim();
      if (!w && !d) return;
      const key = `${t.date}_${w}_${d}_${String(t.description || '').trim()}`;
      if (seen.has(key)) {
        result[i]._duplicateIssue = '重複疑い';
        result[seen.get(key)]._duplicateIssue = '重複疑い';
      } else {
        seen.set(key, i);
      }
    });
    return result;
  },

  checkCarryover: (transactions) => {
    const result = transactions.map(t => ({ ...t, _carryoverIssue: null }));
    const CARRYOVER_RX = /前頁より繰越|前ページより繰越|繰越残高/;
    const bankGroups = {};
    result.forEach(t => {
      const k = t.bankName || '';
      if (!bankGroups[k]) bankGroups[k] = [];
      bankGroups[k].push(t);
    });
    Object.values(bankGroups).forEach(group => {
      const pageMap = {};
      group.forEach(t => { if (!pageMap[t.pageIndex]) pageMap[t.pageIndex] = []; pageMap[t.pageIndex].push(t); });
      const pages = Object.keys(pageMap).map(Number).sort((a, b) => a - b);
      for (let pi = 1; pi < pages.length; pi++) {
        const prevRows = pageMap[pages[pi - 1]];
        const currRows = pageMap[pages[pi]];
        const prevLast = [...prevRows].reverse().find(t => cleanNum(t.balance) !== 0);
        if (!prevLast) continue;
        const carryRow = currRows.find(t => CARRYOVER_RX.test(t.description || ''));
        if (!carryRow) continue;
        const prevBal = cleanNum(prevLast.balance);
        const carryBal = cleanNum(carryRow.balance);
        if (Math.abs(prevBal - carryBal) > 1) {
          carryRow._carryoverIssue = `繰越不整合: 前頁末残 ${prevBal.toLocaleString()} / 繰越額 ${carryBal.toLocaleString()}`;
        }
      }
    });
    return result;
  },

  applyMaterialityFlag: (transactions, threshold) => {
    if (!threshold || threshold <= 0) return transactions.map(t => ({ ...t, _materialityFlag: false }));
    return transactions.map(t => ({
      ...t,
      _materialityFlag: cleanNum(t.withdrawal) >= threshold || cleanNum(t.deposit) >= threshold
    }));
  },

  checkPageGaps: (transactions) => {
    const result = transactions.map(t => ({ ...t, _pageGapWarning: null }));
    const grouped = {};
    result.forEach(t => { (grouped[t.bankName] = grouped[t.bankName] || []).push(t); });
    Object.values(grouped).forEach(group => {
      const withDate = group.filter(t => t.date);
      for (let i = 1; i < withDate.length; i++) {
        const d1 = new Date(withDate[i-1].date.replace(/\//g, '-'));
        const d2 = new Date(withDate[i].date.replace(/\//g, '-'));
        if (isNaN(d1) || isNaN(d2)) continue;
        const gap = (d2 - d1) / 86400000;
        if (gap > 40) withDate[i]._pageGapWarning = `前取引から${Math.round(gap)}日間のデータ欠落の可能性`;
      }
    });
    return result;
  },

  runAll: (transactions, threshold = 0) => {
    let r = Validators.checkTransferMatching(transactions);
    r = Validators.checkBalanceContinuity(r);
    r = Validators.checkDuplicates(r);
    r = Validators.checkCarryover(r);
    r = Validators.checkPageGaps(r);
    r = Validators.applyMaterialityFlag(r, threshold);
    return r;
  }
};

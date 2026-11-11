// ccc.js: the finance math for the ElectroMart CCC app.
// Plain functions that never touch the page, so they can be checked with Node:
//   node -e "const c=require('./ccc.js'); ..."

(function (root) {
  "use strict";

  // Split CSV text into an array of row objects keyed by the header line.
  // Handles quoted fields so a note containing a comma still parses.
  function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
    const splitLine = (line) => {
      const out = [];
      let field = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
          else if (ch === '"') quoted = false;
          else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") { out.push(field); field = ""; }
        else field += ch;
      }
      out.push(field);
      return out.map((f) => f.trim());
    };
    const header = splitLine(lines[0]);
    return lines.slice(1).map((line) => {
      const cells = splitLine(line);
      const row = {};
      header.forEach((h, i) => { row[h] = cells[i]; });
      return row;
    });
  }

  // Turn statement rows (section,item,before,after) into
  // { before: {revenue, cogs, inventory, ...}, after: {...}, sections: {item: section} }.
  function statementsFromRows(rows) {
    const before = {};
    const after = {};
    const sections = {};
    rows.forEach((r) => {
      before[r.item] = Number(r.before);
      after[r.item] = Number(r.after);
      sections[r.item] = r.section;
    });
    return { before, after, sections };
  }

  // Turn assumption rows (assumption,value,note) into { days_in_year: 365, ... }.
  function assumptionsFromRows(rows) {
    const a = {};
    rows.forEach((r) => { a[r.assumption] = Number(r.value); });
    return a;
  }

  // Days inventory outstanding = Inventory / COGS × days in year
  function dio(s, days) { return (s.inventory / s.cogs) * days; }

  // Days sales outstanding = Accounts receivable / Revenue × days (all sales on credit)
  function dso(s, days) { return (s.accounts_receivable / s.revenue) * days; }

  // Days payables outstanding = Accounts payable / COGS × days (purchases = COGS)
  function dpo(s, days) { return (s.accounts_payable / s.cogs) * days; }

  // Cash conversion cycle = DIO + DSO − DPO
  function ccc(s, days) { return dio(s, days) + dso(s, days) - dpo(s, days); }

  // All four day counts for one period.
  function dayCounts(s, days) {
    return { dio: dio(s, days), dso: dso(s, days), dpo: dpo(s, days), ccc: ccc(s, days) };
  }

  // Cash freed by each lever, from the balance sheet change.
  // A drop in an asset frees cash; a rise in accounts payable frees cash.
  function cashFreed(before, after) {
    const inventory = before.inventory - after.inventory;
    const receivables = before.accounts_receivable - after.accounts_receivable;
    const payables = after.accounts_payable - before.accounts_payable;
    return { inventory, receivables, payables, total: inventory + receivables + payables };
  }

  // The same cash freed, worked out from the days instead:
  // days changed × annual COGS (or revenue) / days in year.
  // Uses Before revenue and COGS. Should equal cashFreed() when sales and costs are unchanged.
  function cashFreedFromDays(before, after, days) {
    const b = dayCounts(before, days);
    const a = dayCounts(after, days);
    const inventory = (b.dio - a.dio) * before.cogs / days;
    const receivables = (b.dso - a.dso) * before.revenue / days;
    const payables = (a.dpo - b.dpo) * before.cogs / days;
    return { inventory, receivables, payables, total: inventory + receivables + payables };
  }

  const api = {
    parseCSV, statementsFromRows, assumptionsFromRows,
    dio, dso, dpo, ccc, dayCounts, cashFreed, cashFreedFromDays,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CCC = api;
})(this);

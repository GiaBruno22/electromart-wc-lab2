// app.js: loads the CSV files and fills in the page. The math lives in ccc.js.
(function () {
  "use strict";

  const fmtDays = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDollars = (n) => {
    const r = Math.round(n);
    const s = "$" + Math.abs(r).toLocaleString("en-US");
    return r < 0 ? "−" + s : s;
  };
  const fmtSignedDays = (n) => {
    const r = Number(n.toFixed(2));
    if (r === 0) return "0.00";
    return (r > 0 ? "+" : "−") + fmtDays(Math.abs(r));
  };

  function row(cells, isTotal) {
    const tr = document.createElement("tr");
    if (isTotal) tr.className = "total";
    cells.forEach((c, i) => {
      const el = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) el.scope = "row";
      el.textContent = c;
      tr.appendChild(el);
    });
    return tr;
  }

  async function loadCSV(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load " + path + " (" + res.status + ")");
    return CCC.parseCSV(await res.text());
  }

  async function init() {
    const status = document.getElementById("status");
    try {
      const [stmtRows, assumpRows] = await Promise.all([
        loadCSV("data/electromart.csv"),
        loadCSV("data/assumptions.csv"),
      ]);
      const { before, after } = CCC.statementsFromRows(stmtRows);
      const a = CCC.assumptionsFromRows(assumpRows);
      const days = a.days_in_year;

      const b = CCC.dayCounts(before, days);
      const f = CCC.dayCounts(after, days);

      document.getElementById("days-note").textContent =
        "Uses a " + days + "-day year. DIO = Inventory / COGS × " + days +
        ", DSO = Receivables / Revenue × " + days +
        ", DPO = Payables / COGS × " + days + ", CCC = DIO + DSO − DPO.";

      const daysBody = document.querySelector("#days-table tbody");
      daysBody.replaceChildren(
        row(["DIO (inventory)", fmtDays(b.dio), fmtDays(f.dio), fmtSignedDays(f.dio - b.dio)]),
        row(["DSO (receivables)", fmtDays(b.dso), fmtDays(f.dso), fmtSignedDays(f.dso - b.dso)]),
        row(["DPO (payables)", fmtDays(b.dpo), fmtDays(f.dpo), fmtSignedDays(f.dpo - b.dpo)]),
        row(["Cash conversion cycle", fmtDays(b.ccc), fmtDays(f.ccc), fmtSignedDays(f.ccc - b.ccc)], true)
      );

      const bs = CCC.cashFreed(before, after);
      const chk = CCC.cashFreedFromDays(before, after, days);
      const cashBody = document.querySelector("#cash-table tbody");
      cashBody.replaceChildren(
        row(["Inventory", fmtDollars(bs.inventory), fmtDollars(chk.inventory)]),
        row(["Receivables", fmtDollars(bs.receivables), fmtDollars(chk.receivables)]),
        row(["Payables", fmtDollars(bs.payables), fmtDollars(chk.payables)]),
        row(["Total", fmtDollars(bs.total), fmtDollars(chk.total)], true)
      );

      status.hidden = true;
    } catch (err) {
      status.textContent = "Something went wrong: " + err.message;
      status.classList.add("error");
    }
  }

  init();
})();

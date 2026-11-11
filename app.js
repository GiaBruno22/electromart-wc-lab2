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
  const fmtPct = (n) => (n * 100).toFixed(2) + "%";

  // A table row. cells[0] is the row label; it can be {text, hint}.
  // A cell can be {text, neg} to colour a negative value.
  function row(cells, cls) {
    const tr = document.createElement("tr");
    if (cls) tr.className = cls;
    cells.forEach((c, i) => {
      const el = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) el.scope = "row";
      const text = typeof c === "object" ? c.text : c;
      el.textContent = text;
      if (typeof c === "object" && c.hint) {
        const hint = document.createElement("span");
        hint.className = "hint";
        hint.textContent = c.hint;
        el.appendChild(hint);
      }
      if (typeof c === "object" && c.neg) el.className = "neg";
      tr.appendChild(el);
    });
    return tr;
  }
  const sectionRow = (text) => {
    const tr = document.createElement("tr");
    tr.className = "section-row";
    const th = document.createElement("th");
    th.colSpan = 3;
    th.scope = "colgroup";
    th.textContent = text;
    tr.appendChild(th);
    return tr;
  };
  const money = (n) => ({ text: fmtDollars(n), neg: Math.round(n) < 0 });

  async function loadCSV(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load " + path + " (" + res.status + ")");
    return CCC.parseCSV(await res.text());
  }

  function renderSummary(before, after, a) {
    const days = a.days_in_year;
    const b = CCC.dayCounts(before, days);
    const f = CCC.dayCounts(after, days);

    document.getElementById("days-note").textContent =
      "Uses a " + days + "-day year. DIO = Inventory / COGS × " + days +
      ", DSO = Receivables / Revenue × " + days +
      ", DPO = Payables / COGS × " + days + ", CCC = DIO + DSO − DPO.";

    document.querySelector("#days-table tbody").replaceChildren(
      row(["DIO (inventory)", fmtDays(b.dio), fmtDays(f.dio), fmtSignedDays(f.dio - b.dio)]),
      row(["DSO (receivables)", fmtDays(b.dso), fmtDays(f.dso), fmtSignedDays(f.dso - b.dso)]),
      row(["DPO (payables)", fmtDays(b.dpo), fmtDays(f.dpo), fmtSignedDays(f.dpo - b.dpo)]),
      row(["Cash conversion cycle", fmtDays(b.ccc), fmtDays(f.ccc), fmtSignedDays(f.ccc - b.ccc)], "total")
    );

    const bs = CCC.cashFreed(before, after);
    const chk = CCC.cashFreedFromDays(before, after, days);
    document.querySelector("#cash-table tbody").replaceChildren(
      row(["Inventory", fmtDollars(bs.inventory), fmtDollars(chk.inventory)]),
      row(["Receivables", fmtDollars(bs.receivables), fmtDollars(chk.receivables)]),
      row(["Payables", fmtDollars(bs.payables), fmtDollars(chk.payables)]),
      row(["Total", fmtDollars(bs.total), fmtDollars(chk.total)], "total")
    );
  }

  function setupLevers(before, after, a) {
    const days = a.days_in_year;
    const b = CCC.dayCounts(before, days);
    const f = CCC.dayCounts(after, days);
    const base = CCC.leverResults({ dio: b.dio, dso: b.dso, dpo: b.dpo }, before, a);

    const sliders = {
      dio: document.getElementById("dio-slider"),
      dso: document.getElementById("dso-slider"),
      dpo: document.getElementById("dpo-slider"),
    };
    const outputs = {
      dio: document.getElementById("dio-value"),
      dso: document.getElementById("dso-value"),
      dpo: document.getElementById("dpo-value"),
    };

    // Slider range: 0 up to twice the larger of Before and After, rounded up to 10 days.
    // DPO also reaches at least twice the net due date.
    const maxFor = (k, floor) => Math.max(floor || 0, Math.ceil((Math.max(b[k], f[k]) * 2) / 10) * 10);
    sliders.dio.max = maxFor("dio");
    sliders.dso.max = maxFor("dso");
    sliders.dpo.max = maxFor("dpo", a.net_days * 2);

    const discountLabel = "Annual cost of skipping the " + fmtPct(a.supplier_discount).replace(".00", "") + " discount";
    const discountText = (cost) => (cost === null ? "Takes discount" : fmtPct(cost));

    function update() {
      const lv = {};
      Object.keys(sliders).forEach((k) => {
        lv[k] = Number(sliders[k].value);
        outputs[k].textContent = fmtDays(lv[k]) + " days";
      });
      const r = CCC.leverResults(lv, before, a);

      document.querySelector("#lever-table tbody").replaceChildren(
        row(["Cash conversion cycle (days)", fmtDays(base.ccc), fmtDays(r.ccc)], "total"),

        sectionRow("Balances the days imply"),
        row(["Inventory", fmtDollars(base.balances.inventory), fmtDollars(r.balances.inventory)]),
        row(["Accounts receivable", fmtDollars(base.balances.accounts_receivable), fmtDollars(r.balances.accounts_receivable)]),
        row(["Accounts payable", fmtDollars(base.balances.accounts_payable), fmtDollars(r.balances.accounts_payable)]),

        sectionRow("Cash freed compared with Before"),
        row(["Inventory", "—", money(r.cashFreed.inventory)]),
        row(["Receivables", "—", money(r.cashFreed.receivables)]),
        row(["Payables", "—", money(r.cashFreed.payables)]),
        row(["Total cash freed", "—", money(r.cashFreed.total)], "total"),

        sectionRow("Bank line and suppliers"),
        row([{ text: "Interest saved per year",
               hint: "Assumes every freed dollar pays down the bank line (" + fmtPct(a.bank_rate) +
                     "), up to its Before balance of " + fmtDollars(before.notes_payable) +
                     ". The case's After balance sheet shows part of the cash was kept." },
             "—", money(r.interestSaved)]),
        row(["Days paid past the net-" + a.net_days + " due date", fmtDays(base.daysPastDue), fmtDays(r.daysPastDue)]),
        row([{ text: discountLabel,
               hint: "Nominal annual rate: d / (1 − d) × " + days + " / (days paid − " + a.discount_days + ")." },
             discountText(base.discountCost), discountText(r.discountCost)])
      );
    }

    function setTo(dc) {
      sliders.dio.value = dc.dio;
      sliders.dso.value = dc.dso;
      sliders.dpo.value = dc.dpo;
      update();
    }

    Object.values(sliders).forEach((s) => s.addEventListener("input", update));
    document.getElementById("set-before").addEventListener("click", () => setTo(b));
    document.getElementById("set-after").addEventListener("click", () => setTo(f));
    setTo(b);
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

      renderSummary(before, after, a);
      setupLevers(before, after, a);
      status.hidden = true;
    } catch (err) {
      status.textContent = "Something went wrong: " + err.message;
      status.classList.add("error");
    }
  }

  init();

  // Register the service worker so the app installs and works offline.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
})();

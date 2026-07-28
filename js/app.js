(function () {
  "use strict";

  const METRIC_LABEL = {
    establishments: "Shops",
    employees: "Employees",
    payroll_annual_thousands: "Payroll",
    "nonemployer.establishments": "Solo shops",
    "nonemployer.receipts_thousands": "Solo receipts",
    total_shops: "Total shops",
  };

  function getMetric(cat, metric) {
    if (!cat) return null;
    if (metric === "total_shops") {
      const emp = cat.establishments;
      const solo = cat.nonemployer ? cat.nonemployer.establishments : null;
      if ((emp === null || emp === undefined) && (solo === null || solo === undefined)) return null;
      return (emp || 0) + (solo || 0);
    }
    if (metric.startsWith("nonemployer.")) {
      const field = metric.split(".")[1];
      return cat.nonemployer ? cat.nonemployer[field] ?? null : null;
    }
    return cat[metric] ?? null;
  }

  const state = {
    data: null,
    metric: "establishments",
    selectedFips: null, // null = show national totals
  };

  const els = {
    search: document.getElementById("state-search"),
    stateList: document.getElementById("state-list"),
    metricBtns: Array.from(document.querySelectorAll(".metric-btn")),
    detail: document.getElementById("detail"),
    rankTitle: document.getElementById("rank-title"),
    rankSub: document.getElementById("rank-sub"),
    rankChart: document.getElementById("rank-chart"),
    tableBody: document.getElementById("data-table-body"),
    sampleBanner: document.getElementById("sample-banner"),
    sourceLabel: document.getElementById("source-label"),
    updatedLabel: document.getElementById("updated-label"),
  };

  function fmtNumber(n) {
    if (n === null || n === undefined) return null;
    return n.toLocaleString("en-US");
  }

  function fmtPayroll(thousands) {
    if (thousands === null || thousands === undefined) return null;
    const dollars = thousands * 1000;
    if (dollars >= 1_000_000_000) return "$" + (dollars / 1_000_000_000).toFixed(2) + "B";
    if (dollars >= 1_000_000) return "$" + (dollars / 1_000_000).toFixed(1) + "M";
    return "$" + fmtNumber(dollars);
  }

  function formatMetric(metric, value) {
    if (value === null || value === undefined) return null;
    return metric.endsWith("_thousands") ? fmtPayroll(value) : fmtNumber(value);
  }

  function categoryTotal(stateObj, metric) {
    let total = 0;
    let any = false;
    Object.values(stateObj.categories).forEach((cat) => {
      const v = getMetric(cat, metric);
      if (v !== null && v !== undefined) {
        total += v;
        any = true;
      }
    });
    return any ? total : null;
  }

  function findState(query) {
    if (!query) return null;
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (
      state.data.states.find((s) => s.state.toLowerCase() === q) ||
      state.data.states.find((s) => s.abbr.toLowerCase() === q) ||
      state.data.states.find((s) => s.state.toLowerCase().startsWith(q)) ||
      null
    );
  }

  function nationalTotals() {
    const totals = {};
    Object.keys(state.data.categories).forEach((code) => {
      totals[code] = { establishments: 0, employees: 0, payroll_annual_thousands: 0, label: state.data.categories[code] };
    });
    state.data.states.forEach((s) => {
      Object.entries(s.categories).forEach(([code, cat]) => {
        ["establishments", "employees", "payroll_annual_thousands"].forEach((m) => {
          if (cat[m] !== null && cat[m] !== undefined) totals[code][m] += cat[m];
        });
      });
    });
    return totals;
  }

  function renderDetail() {
    const sel = state.selectedFips ? state.data.states.find((s) => s.state_fips === state.selectedFips) : null;
    const title = sel ? sel.state : "United States (all states)";
    let rankBadge = "";
    if (sel) {
      const rank = rankStates(state.metric).findIndex((r) => r.state_fips === sel.state_fips) + 1;
      rankBadge = `<span class="rank-badge">#${rank} of ${state.data.states.length} in ${METRIC_LABEL[state.metric].toLowerCase()}</span>`;
    }
    const categories = sel ? sel.categories : nationalTotals();

    const stateTotalShops = Object.values(categories).reduce((sum, cat) => {
      const v = getMetric(cat, "total_shops");
      return v === null ? sum : sum + v;
    }, 0);

    const boards = Object.entries(categories)
      .map(([code, cat]) => {
        const employerRows = [
          ["Establishments", formatMetric("establishments", cat.establishments)],
          ["Employees", formatMetric("employees", cat.employees)],
          ["Annual payroll", formatMetric("payroll_annual_thousands", cat.payroll_annual_thousands)],
        ];
        const nonemp = cat.nonemployer || {};
        const nonempRows = [
          ["Solo/self-employed shops", formatMetric("nonemployer.establishments", nonemp.establishments)],
          ["Annual receipts", formatMetric("nonemployer.receipts_thousands", nonemp.receipts_thousands)],
        ];
        const totalShops = getMetric(cat, "total_shops");
        const rowHtml = ([label, value]) =>
          `<div class="row"><dt>${label}</dt><dd>${value === null ? '<span class="na">withheld</span>' : value}</dd></div>`;
        return `<div class="board">
          <h3>${cat.label}</h3>
          <p class="board-group-label">Employer shops (paid staff)</p>
          <dl>${employerRows.map(rowHtml).join("")}</dl>
          <p class="board-group-label">No paid employees</p>
          <dl>${nonempRows.map(rowHtml).join("")}</dl>
          <div class="row row-total"><dt>Total shops</dt><dd>${totalShops === null ? '<span class="na">withheld</span>' : fmtNumber(totalShops)}</dd></div>
        </div>`;
      })
      .join("");

    els.detail.innerHTML = `
      <div class="detail-heading">
        <h2>${title}</h2>
        ${rankBadge}
      </div>
      <p class="state-total-shops">
        <span class="state-total-shops-value">${fmtNumber(stateTotalShops)}</span>
        total shops (employer + solo/self-employed) across barbershops, beauty salons &amp; nail salons
      </p>
      <div class="board-grid">${boards}</div>
    `;
  }

  function rankStates(metric) {
    return state.data.states
      .map((s) => ({ ...s, _value: categoryTotal(s, metric) }))
      .sort((a, b) => (b._value ?? -1) - (a._value ?? -1));
  }

  function renderRankChart() {
    els.rankTitle.textContent = "How states compare — " + METRIC_LABEL[state.metric];
    els.rankSub.textContent = `Ranked by total ${METRIC_LABEL[state.metric].toLowerCase()} across barbershops, beauty salons & nail salons.`;

    const ranked = rankStates(state.metric);
    const max = ranked[0]._value || 1;
    const showCount = 15;
    let list = ranked.slice(0, showCount);

    if (state.selectedFips && !list.find((s) => s.state_fips === state.selectedFips)) {
      const sel = ranked.find((s) => s.state_fips === state.selectedFips);
      if (sel) list = list.concat([sel]);
    }

    els.rankChart.innerHTML = list

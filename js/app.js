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
    if (dollars >= 1_000_000)

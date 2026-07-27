(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  const STORAGE = {
    filters: "textiq_filters_v1",
    history: "textiq_history_v1",
  };

  const DEFAULT_FILTERS = [
    "Chase",
    "PayPal",
    "Amazon",
    "WhatsApp",
    "Google",
    "Apple",
    "Bank",
    "Verification",
  ];

  const DEMOS = [
    {
      sender: "Chase Alerts",
      region: "+1",
      text: "From: Chase Alerts\nYour verification code is 483291.\nExpires in 5 minutes. Do not share.",
    },
    {
      sender: "PayPal",
      region: "+44",
      text: "PayPal: 902114 is your security code. It expires in 10 minutes.",
    },
    {
      sender: "Amazon",
      region: "+91",
      text: "Amazon OTP 771902 for sign-in. Valid for 5 minutes. If this wasn't you, ignore.",
    },
    {
      sender: "Unknown",
      region: "ANY",
      text: "Hey are we still on for lunch at 1?",
    },
  ];

  const els = {
    message: document.getElementById("message"),
    sender: document.getElementById("sender"),
    region: document.getElementById("region"),
    analyzeBtn: document.getElementById("analyze-btn"),
    clearBtn: document.getElementById("clear-btn"),
    demoBtn: document.getElementById("demo-btn"),
    copyBtn: document.getElementById("copy-btn"),
    sendBtn: document.getElementById("send-btn"),
    charCount: document.getElementById("char-count"),
    tokenCount: document.getElementById("token-count"),
    filterHit: document.getElementById("filter-hit"),
    scoreValue: document.getElementById("score-value"),
    scoreRing: document.getElementById("score-ring"),
    verdict: document.getElementById("verdict"),
    verdictSub: document.getElementById("verdict-sub"),
    otpRow: document.getElementById("otp-row"),
    otpFull: document.getElementById("otp-full"),
    mPattern: document.getElementById("m-pattern"),
    mSender: document.getElementById("m-sender"),
    mContext: document.getElementById("m-context"),
    mFresh: document.getElementById("m-fresh"),
    breakdownList: document.getElementById("breakdown-list"),
    bridgeCore: document.getElementById("bridge-core"),
    portALive: document.getElementById("port-a-live"),
    portBLive: document.getElementById("port-b-live"),
    filterList: document.getElementById("filter-list"),
    newFilter: document.getElementById("new-filter"),
    saveFilterBtn: document.getElementById("save-filter-btn"),
    addFilterBtn: document.getElementById("add-filter-btn"),
    historyList: document.getElementById("history-list"),
    wipeHistoryBtn: document.getElementById("wipe-history-btn"),
    copyPitchBtn: document.getElementById("copy-pitch-btn"),
    pitchLine: document.getElementById("pitch-line"),
    tgPill: document.getElementById("tg-pill"),
    userLine: document.getElementById("user-line"),
    modePill: document.getElementById("mode-pill"),
  };

  let filters = loadFilters();
  let history = loadHistory();
  let lastResult = null;
  let demoIndex = 0;
  const CIRC = 2 * Math.PI * 52;

  function loadFilters() {
    try {
      const raw = localStorage.getItem(STORAGE.filters);
      if (!raw) return DEFAULT_FILTERS.slice();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_FILTERS.slice();
    } catch {
      return DEFAULT_FILTERS.slice();
    }
  }

  function saveFilters() {
    localStorage.setItem(STORAGE.filters, JSON.stringify(filters));
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE.history);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, 40)));
  }

  function initTelegram() {
    if (!tg) {
      els.tgPill.textContent = "Browser";
      return;
    }
    tg.ready();
    tg.expand();
    try {
      if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    } catch (_) {}

    const map = [
      ["--bg", tg.themeParams.bg_color],
      ["--text", tg.themeParams.text_color],
      ["--hint", tg.themeParams.hint_color],
      ["--link", tg.themeParams.link_color],
      ["--btn", tg.themeParams.button_color],
      ["--btn-text", tg.themeParams.button_text_color],
      ["--panel", tg.themeParams.secondary_bg_color],
    ];
    map.forEach(([k, v]) => v && document.documentElement.style.setProperty(k, v));

    const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user) {
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "User";
      els.userLine.textContent = name;
      els.tgPill.textContent = "Telegram";
    } else {
      els.tgPill.textContent = "Telegram";
    }

    if (tg.MainButton) {
      tg.MainButton.setText("Run TextIQ");
      tg.MainButton.show();
      tg.MainButton.onClick(analyze);
    }
  }

  function setTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById("view-" + tab.dataset.tab).classList.add("active");
      });
    });
  }

  function updateStreamMeta() {
    const text = els.message.value || "";
    els.charCount.textContent = String(text.length);
    els.tokenCount.textContent = String(text.trim() ? text.trim().split(/\s+/).length : 0);
    const sender = (els.sender.value || "").trim();
    const hit = matchFilter(sender, text);
    els.filterHit.textContent = hit || "none";
  }

  function matchFilter(sender, text) {
    const hay = (sender + " " + text).toLowerCase();
    return filters.find((f) => hay.includes(String(f).toLowerCase())) || null;
  }

  function extractOtp(text) {
    const patterns = [
      { re: /\b(?:code|otp|pin|passcode|verification(?:\s+code)?)\s*(?:is|:)?\s*(\d{4,8})\b/i, w: 1 },
      { re: /\b(\d{6})\b/, w: 0.92 },
      { re: /\b(\d{4,8})\b/, w: 0.7 },
    ];
    for (const p of patterns) {
      const m = text.match(p.re);
      if (m) return { otp: m[1], weight: p.w, pattern: p.re.source };
    }
    return null;
  }

  function scoreText({ text, sender, region }) {
    const breakdown = [];
    let score = 0;

    const otpHit = extractOtp(text);
    if (otpHit) {
      const pts = Math.round(42 * otpHit.weight);
      score += pts;
      breakdown.push({ label: "OTP pattern match", pts: "+" + pts });
    } else {
      breakdown.push({ label: "OTP pattern match", pts: "+0" });
    }

    const filter = matchFilter(sender, text);
    if (filter) {
      score += 22;
      breakdown.push({ label: 'Sender filter "' + filter + '"', pts: "+22" });
    } else if ((sender || "").trim()) {
      score += 6;
      breakdown.push({ label: "Sender present (unlisted)", pts: "+6" });
    } else {
      breakdown.push({ label: "Sender filter", pts: "+0" });
    }

    const ctxRe = /(verif|otp|code|secure|login|sign[ -]?in|auth|expir|minute|do not share|one[ -]?time)/i;
    if (ctxRe.test(text)) {
      score += 18;
      breakdown.push({ label: "Auth context keywords", pts: "+18" });
    } else {
      breakdown.push({ label: "Auth context keywords", pts: "+0" });
    }

    const exp = text.match(/(\d+)\s*(minute|min|second|sec)/i);
    if (exp) {
      score += 10;
      breakdown.push({ label: "Expiry language", pts: "+10" });
    } else {
      breakdown.push({ label: "Expiry language", pts: "+0" });
    }

    if (region && region !== "ANY") {
      if (text.includes(region)) {
        score += 8;
        breakdown.push({ label: "Region tag in text " + region, pts: "+8" });
      } else {
        score += 3;
        breakdown.push({ label: "Region tag selected " + region, pts: "+3" });
      }
    } else {
      breakdown.push({ label: "Region tag", pts: "+0" });
    }

    // Length sanity — real OTP messages are usually short
    const len = text.trim().length;
    if (len > 20 && len < 320) {
      score += 5;
      breakdown.push({ label: "Message length sanity", pts: "+5" });
    } else if (len >= 320) {
      score -= 4;
      breakdown.push({ label: "Message unusually long", pts: "-4" });
    }

    score = Math.max(0, Math.min(99, score));

    let verdict, sub, tone;
    if (score >= 80) {
      verdict = "High-confidence OTP";
      sub = "Strong pattern + sender/context alignment.";
      tone = "high";
    } else if (score >= 55) {
      verdict = "Likely verification text";
      sub = "Good signals — review before acting.";
      tone = "mid";
    } else if (otpHit) {
      verdict = "Weak OTP candidate";
      sub = "Digits found, but surrounding evidence is thin.";
      tone = "low";
    } else {
      verdict = "Not an OTP message";
      sub = "No reliable verification signature detected.";
      tone = "none";
    }

    return {
      score,
      verdict,
      sub,
      tone,
      otp: otpHit ? otpHit.otp : null,
      filter,
      breakdown,
      metrics: {
        pattern: otpHit ? (otpHit.otp.length + "-digit") : "none",
        sender: filter ? "matched" : sender ? "custom" : "empty",
        context: ctxRe.test(text) ? "auth-like" : "generic",
        fresh: exp ? exp[0] : "n/a",
      },
    };
  }

  function renderOtp(otp, miss) {
    const chars = otp ? String(otp).slice(0, 6).split("") : [];
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const ch = chars[i];
      const cls = ch ? "box filled" : miss ? "box miss" : "box";
      boxes.push('<div class="' + cls + '">' + (ch || "-") + "</div>");
    }
    els.otpRow.innerHTML = boxes.join("");
    els.otpFull.textContent = otp ? otp : "——————";
  }

  function setRing(score, tone) {
    const offset = CIRC - (CIRC * score) / 100;
    els.scoreRing.style.strokeDasharray = String(CIRC);
    els.scoreRing.style.strokeDashoffset = String(offset);
    const color =
      tone === "high" ? "#4ade80" : tone === "mid" ? "#22d3ee" : tone === "low" ? "#fbbf24" : "#f87171";
    els.scoreRing.style.stroke = score ? color : "#64748b";
    els.scoreValue.textContent = score || score === 0 ? score + "%" : "—";
    els.scoreValue.style.color = score || score === 0 ? color : "";
  }

  function renderBreakdown(items) {
    els.breakdownList.innerHTML = items
      .map(
        (i) =>
          "<li><span>" +
          escapeHtml(i.label) +
          '</span><span class="pts">' +
          escapeHtml(i.pts) +
          "</span></li>"
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "&quot;");
  }

  function pulseBridge() {
    els.bridgeCore.classList.remove("pulse");
    void els.bridgeCore.offsetWidth;
    els.bridgeCore.classList.add("pulse");
    els.portBLive.textContent = "SYNC";
    els.portBLive.classList.remove("dim");
    setTimeout(() => {
      els.portBLive.textContent = "LIVE";
    }, 450);
  }

  function analyze() {
    const payload = {
      text: els.message.value || "",
      sender: els.sender.value || "",
      region: els.region.value || "ANY",
    };

    pulseBridge();
    const result = scoreText(payload);
    lastResult = { ...result, ...payload, ts: Date.now() };

    setRing(result.score, result.tone);
    els.verdict.textContent = result.verdict;
    els.verdictSub.textContent = result.sub;
    renderOtp(result.otp, !result.otp);
    els.mPattern.textContent = result.metrics.pattern;
    els.mSender.textContent = result.metrics.sender;
    els.mContext.textContent = result.metrics.context;
    els.mFresh.textContent = result.metrics.fresh;
    renderBreakdown(result.breakdown);

    const canUse = Boolean(result.otp);
    els.copyBtn.disabled = !canUse;
    els.sendBtn.disabled = !canUse;

    history.unshift({
      otp: result.otp || "—",
      score: result.score,
      verdict: result.verdict,
      sender: payload.sender || "—",
      preview: payload.text.slice(0, 90),
      ts: Date.now(),
    });
    saveHistory();
    renderHistory();
    updateStreamMeta();

    if (tg) {
      if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(result.score >= 55 ? "success" : "warning");
      }
      if (tg.MainButton) {
        if (result.otp) {
          tg.MainButton.setText("Send " + result.otp);
          tg.MainButton.onClick(sendToBot);
        } else {
          tg.MainButton.setText("Run TextIQ");
          tg.MainButton.onClick(analyze);
        }
      }
    }
  }

  function clearAll() {
    els.message.value = "";
    els.sender.value = "";
    els.region.value = "ANY";
    lastResult = null;
    setRing(0, "none");
    els.scoreValue.textContent = "—";
    els.verdict.textContent = "Awaiting analysis";
    els.verdictSub.textContent = "Port A feeds Port B through the TextIQ engine.";
    renderOtp(null, false);
    els.mPattern.textContent = "—";
    els.mSender.textContent = "—";
    els.mContext.textContent = "—";
    els.mFresh.textContent = "—";
    els.breakdownList.innerHTML = '<li class="muted">Run TextIQ to populate twin output.</li>';
    els.copyBtn.disabled = true;
    els.sendBtn.disabled = true;
    els.portBLive.textContent = "IDLE";
    els.portBLive.classList.add("dim");
    updateStreamMeta();
    if (tg && tg.MainButton) {
      tg.MainButton.setText("Run TextIQ");
      tg.MainButton.onClick(analyze);
    }
  }

  function loadDemo() {
    const d = DEMOS[demoIndex % DEMOS.length];
    demoIndex += 1;
    els.message.value = d.text;
    els.sender.value = d.sender;
    els.region.value = d.region;
    updateStreamMeta();
    analyze();
  }

  async function copyOtp() {
    if (!lastResult || !lastResult.otp) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(lastResult.otp);
      } else {
        const t = document.createElement("textarea");
        t.value = lastResult.otp;
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        document.body.removeChild(t);
      }
      els.copyBtn.textContent = "Copied";
      setTimeout(() => (els.copyBtn.textContent = "Copy"), 1100);
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    } catch {
      els.verdictSub.textContent = "Copy failed — select the code manually.";
    }
  }

  function sendToBot() {
    if (!lastResult || !lastResult.otp) return;
    const payload = JSON.stringify({
      type: "textiq_result",
      product: "TextIQ Twin Display",
      otp: lastResult.otp,
      score: lastResult.score,
      verdict: lastResult.verdict,
      sender: lastResult.sender || "",
      region: lastResult.region || "ANY",
      ts: Date.now(),
    });

    if (tg && typeof tg.sendData === "function") {
      try {
        tg.sendData(payload);
        els.verdictSub.textContent = "Result sent to bot via twin port.";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        return;
      } catch (_) {}
    }

    if (tg && tg.showAlert) {
      tg.showAlert("TextIQ " + lastResult.score + "% · OTP " + lastResult.otp);
    } else {
      alert("TextIQ " + lastResult.score + "% · OTP " + lastResult.otp);
    }
  }

  function renderFilters() {
    if (!filters.length) {
      els.filterList.innerHTML = '<li class="muted">No filters — all senders score neutrally.</li>';
      return;
    }
    els.filterList.innerHTML = filters
      .map(
        (f, idx) =>
          "<li><div><strong>" +
          escapeHtml(f) +
          '</strong> <span class="tag">name</span></div>' +
          '<button type="button" class="btn small danger" data-del="' +
          idx +
          '">Remove</button></li>'
      )
      .join("");

    els.filterList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filters.splice(Number(btn.getAttribute("data-del")), 1);
        saveFilters();
        renderFilters();
        updateStreamMeta();
      });
    });
  }

  function addFilter() {
    const v = (els.newFilter.value || "").trim();
    if (!v) return;
    if (!filters.some((f) => f.toLowerCase() === v.toLowerCase())) {
      filters.unshift(v);
      saveFilters();
      renderFilters();
    }
    els.newFilter.value = "";
    updateStreamMeta();
  }

  function renderHistory() {
    if (!history.length) {
      els.historyList.innerHTML = '<div class="hist"><p>No runs yet. Analyze a message on Twin Display.</p></div>';
      return;
    }
    els.historyList.innerHTML = history
      .slice(0, 20)
      .map((h) => {
        const when = new Date(h.ts).toLocaleString();
        return (
          '<div class="hist"><div class="hist-top"><strong>' +
          escapeHtml(h.otp) +
          "</strong><span>" +
          h.score +
          "% · " +
          escapeHtml(when) +
          "</span></div><p>" +
          escapeHtml(h.verdict) +
          " · " +
          escapeHtml(h.sender) +
          "<br>" +
          escapeHtml(h.preview) +
          "</p></div>"
        );
      })
      .join("");
  }

  async function copyPitch() {
    const text = els.pitchLine.textContent;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      els.copyPitchBtn.textContent = "Copied";
      setTimeout(() => (els.copyPitchBtn.textContent = "Copy pitch"), 1100);
    } catch {
      els.copyPitchBtn.textContent = "Copy failed";
    }
  }

  // wire
  els.analyzeBtn.addEventListener("click", analyze);
  els.clearBtn.addEventListener("click", clearAll);
  els.demoBtn.addEventListener("click", loadDemo);
  els.copyBtn.addEventListener("click", copyOtp);
  els.sendBtn.addEventListener("click", sendToBot);
  els.saveFilterBtn.addEventListener("click", addFilter);
  els.addFilterBtn.addEventListener("click", () => {
    document.querySelector('.tab[data-tab="filters"]').click();
    els.newFilter.focus();
  });
  els.newFilter.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addFilter();
  });
  els.wipeHistoryBtn.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });
  els.copyPitchBtn.addEventListener("click", copyPitch);
  els.message.addEventListener("input", updateStreamMeta);
  els.sender.addEventListener("input", updateStreamMeta);

  setTabs();
  initTelegram();
  renderFilters();
  renderHistory();
  updateStreamMeta();
  setRing(0, "none");
  els.scoreRing.style.strokeDasharray = String(CIRC);
  els.scoreRing.style.strokeDashoffset = String(CIRC);
})();

const payload = window.COURSE_MARKET_DATA || { meta: {}, courses: [] };
const liveUpdates = window.COURSE_MARKET_UPDATES || { meta: {}, extraCourses: [], insightRules: [] };
const audiencePayload = window.COURSE_AUDIENCE_RULES || {
  meta: {},
  audienceRules: [],
  categoryRules: {},
  defaultAudience: {},
  feedbackFramework: {},
};
const recommendationPayload = window.COURSE_RECOMMENDATIONS || {
  meta: {},
  emergingCategories: [],
  courses: [],
};
const courses = mergeCourses(payload.courses || [], liveUpdates.extraCourses || []);
const meta = payload.meta || {};
const updateMeta = liveUpdates.meta || {};
const competitorProfiles = liveUpdates.competitorProfiles || [];
const insightRules = liveUpdates.insightRules || [];
const audienceRules = audiencePayload.audienceRules || [];
const categoryRules = audiencePayload.categoryRules || {};
const defaultAudience = audiencePayload.defaultAudience || {};
const feedbackFramework = audiencePayload.feedbackFramework || {};
const recommendedCourses = recommendationPayload.courses || [];
const emergingCategories = recommendationPayload.emergingCategories || [];

const state = {
  search: "",
  category: "",
  provider: "",
  quality: "",
  sort: "rank",
};

const els = {
  scopeText: document.querySelector("#scopeText"),
  insightText: document.querySelector("#insightText"),
  courseCount: document.querySelector("#courseCount"),
  categoryCount: document.querySelector("#categoryCount"),
  sourceCount: document.querySelector("#sourceCount"),
  rawCount: document.querySelector("#rawCount"),
  detailCount: document.querySelector("#detailCount"),
  generatedAt: document.querySelector("#generatedAt"),
  nextReview: document.querySelector("#nextReview"),
  searchInput: document.querySelector("#searchInput"),
  categorySelect: document.querySelector("#categorySelect"),
  providerSelect: document.querySelector("#providerSelect"),
  qualitySelect: document.querySelector("#qualitySelect"),
  sortSelect: document.querySelector("#sortSelect"),
  recommendationSummary: document.querySelector("#recommendationSummary"),
  recommendationUpdated: document.querySelector("#recommendationUpdated"),
  recommendationGrid: document.querySelector("#recommendationGrid"),
  emergingCategoryCount: document.querySelector("#emergingCategoryCount"),
  emergingCategoryList: document.querySelector("#emergingCategoryList"),
  competitorProfileCount: document.querySelector("#competitorProfileCount"),
  competitorProfileGrid: document.querySelector("#competitorProfileGrid"),
  categoryBars: document.querySelector("#categoryBars"),
  courseGrid: document.querySelector("#courseGrid"),
  visibleCount: document.querySelector("#visibleCount"),
  resultLabel: document.querySelector("#resultLabel"),
  detailPanel: document.querySelector("#detailPanel"),
  detailContent: document.querySelector("#detailContent"),
};

function mergeCourses(baseRows, extraRows) {
  const byKey = new Map();
  [...baseRows, ...extraRows].forEach((item) => {
    const key = item.id || `${item.provider || ""}::${item.title || ""}`;
    byKey.set(key, item);
  });
  return [...byKey.values()].sort((a, b) => Number(a.rank ?? 9999) - Number(b.rank ?? 9999));
}

function uniqueValues(key) {
  return [...new Set(courses.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hant")
  );
}

function countBy(key, rows = courses) {
  return rows.reduce((acc, item) => {
    const value = item[key] || "未分類";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function qualityClass(value) {
  return `quality-${String(value || "c").toLowerCase()}`;
}

function includesAny(value, terms) {
  if (!terms) return true;
  const list = Array.isArray(terms) ? terms : [terms];
  if (!list.length) return true;
  const target = String(value || "").toLowerCase();
  return list.some((term) => target.includes(String(term).toLowerCase()));
}

function matchesInsightRule(course, rule) {
  const match = rule.match || {};
  if (match.id && !includesAny(course.id, match.id)) return false;
  if (match.titleIncludes && !includesAny(course.title, match.titleIncludes)) return false;
  if (match.providerIncludes && !includesAny(course.provider, match.providerIncludes)) return false;
  if (match.categoryIncludes && !includesAny(course.category, match.categoryIncludes)) return false;
  if (match.sourceIncludes && !includesAny(course.source_url, match.sourceIncludes)) return false;
  return true;
}

function getCourseInsight(course) {
  return insightRules.find((rule) => matchesInsightRule(course, rule));
}

function getCourseAudience(course) {
  const directRule = audienceRules.find((rule) => matchesInsightRule(course, rule));
  const categoryRule = categoryRules[course.category] || {};
  const base = { ...defaultAudience, ...categoryRule, ...(directRule || {}) };
  const source = directRule
    ? "第一圈/指定規則"
    : categoryRules[course.category]
      ? "類別規則推論"
      : "預設規則推論";
  return {
    ...base,
    source,
    officialTarget: course.target_company || "未公開/需確認",
    confidence:
      base.confidence ||
      (directRule ? "B+：依官方頁與指定競品規則判讀" : "B-：依課程類別與既有欄位推論"),
  };
}

function flattenInsight(insight) {
  if (!insight) return "";
  return [
    insight.competitor,
    insight.tier,
    insight.updateStatus,
    insight.positioning,
    insight.joyceImplication,
    ...Object.values(insight.language || {}),
    ...(insight.productStructure || []),
    ...(insight.trackFields || []),
  ].join(" ");
}

function flattenAudience(audience) {
  if (!audience) return "";
  return [
    audience.primaryAudience,
    audience.decisionMaker,
    audience.buyerContext,
    audience.bestFit,
    audience.notFit,
    audience.officialTarget,
    audience.confidence,
  ].join(" ");
}

function feedbackCredibility(course) {
  const signal = [course.hotness, course.reputation].join(" ");
  if (!signal.trim()) {
    return {
      grade: "D",
      label: feedbackFramework.levels?.D || "沒有可辨識的學員回饋或熱度訊號。",
      currentEvidence: "目前沒有明確口碑資料。",
      nextStep: "優先補具名學員、額滿/加開紀錄、續報率或主辦方可提供的匿名彙整數據。",
    };
  }
  const hasStrongOfficialSignal = /額滿|完售|加開|好評|見證|學員|營收|產業|負責人|二代|續報|回訓|排名|證書/.test(signal);
  const grade = hasStrongOfficialSignal ? "B" : "C";
  return {
    grade,
    label: feedbackFramework.levels?.[grade] || "以目前公開資訊判讀。",
    currentEvidence: signal,
    nextStep:
      grade === "B"
        ? "下一步要找第三方交叉驗證：具名學員公開貼文、媒體訪談、公司職稱驗證、NPS/續報率或歷屆學員訪談。"
        : "目前多半仍是官方文案或弱訊號，需補具名學員、外部貼文、獨立媒體或實際訪談。",
  };
}

function initMeta() {
  const providers = uniqueValues("provider");
  const categories = uniqueValues("category");
  const emergingNames = new Set(emergingCategories.map((item) => item.name).filter(Boolean));
  const existingNames = new Set(categories);
  const newCategoryCount = [...emergingNames].filter((name) => !existingNames.has(name)).length;
  els.scopeText.textContent = meta.scope || "";
  els.insightText.textContent =
    updateMeta.dashboard_note ||
    "高階經理人課程市場正在從單純領導技巧，轉向 AI決策、組織變革、人才接班、績效落地與EMBA社群五條主線。價格帶分化明顯：媒體型單日課多在數千元，顧問式工作坊常見數萬到十萬級，高階CEO學程可達百萬級。";
  els.courseCount.textContent = courses.length.toLocaleString("zh-Hant");
  els.categoryCount.textContent = newCategoryCount ? `${categories.length}+${newCategoryCount}` : categories.length.toLocaleString("zh-Hant");
  els.sourceCount.textContent = providers.length.toLocaleString("zh-Hant");
  els.rawCount.textContent = Number(meta.raw_observations || 0).toLocaleString("zh-Hant");
  els.detailCount.textContent = Number(meta.detail_pages_read || 0).toLocaleString("zh-Hant");
  els.generatedAt.textContent = updateMeta.last_updated || meta.generated_at || "-";
  els.nextReview.textContent = updateMeta.next_review || "-";
  els.recommendationSummary.textContent = recommendationPayload.meta?.summary || "";
  els.recommendationUpdated.textContent = recommendationPayload.meta?.last_updated
    ? `更新 ${recommendationPayload.meta.last_updated}`
    : "-";
  els.emergingCategoryCount.textContent = `${emergingCategories.length} 類`;
  if (els.competitorProfileCount) {
    els.competitorProfileCount.textContent = `${competitorProfiles.length} 家`;
  }
}

function fillSelect(select, values, firstLabel) {
  select.innerHTML = `<option value="">${firstLabel}</option>${values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
}

function initControls() {
  fillSelect(els.categorySelect, uniqueValues("category"), "全部類別");
  fillSelect(els.providerSelect, uniqueValues("provider"), "全部主辦");

  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });
  els.categorySelect.addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });
  els.providerSelect.addEventListener("change", (event) => {
    state.provider = event.target.value;
    render();
  });
  els.qualitySelect.addEventListener("change", (event) => {
    state.quality = event.target.value;
    render();
  });
  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
}

function matchesSearch(course) {
  if (!state.search) return true;
  const haystack = [
    course.title,
    course.category,
    course.provider,
    course.teacher,
    course.teacher_background,
    course.target_company,
    course.management_implication,
    course.hotness,
    course.reputation,
    flattenInsight(getCourseInsight(course)),
    flattenAudience(getCourseAudience(course)),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(state.search.toLowerCase());
}

function filteredCourses() {
  const rows = courses.filter((course) => {
    if (state.category && course.category !== state.category) return false;
    if (state.provider && course.provider !== state.provider) return false;
    if (state.quality && course.data_quality !== state.quality) return false;
    return matchesSearch(course);
  });

  rows.sort((a, b) => {
    if (state.sort === "category") {
      return a.category.localeCompare(b.category, "zh-Hant") || a.rank - b.rank;
    }
    if (state.sort === "provider") {
      return a.provider.localeCompare(b.provider, "zh-Hant") || a.rank - b.rank;
    }
    if (state.sort === "quality") {
      return String(a.data_quality).localeCompare(String(b.data_quality)) || a.rank - b.rank;
    }
    return a.rank - b.rank;
  });

  return rows;
}

function renderCategoryBars(rows) {
  const counts = countBy("category", rows);
  const allCounts = countBy("category", courses);
  const max = Math.max(...Object.values(allCounts), 1);
  const sorted = Object.entries(allCounts).sort((a, b) => b[1] - a[1]);
  els.categoryBars.innerHTML = sorted
    .map(([category, total]) => {
      const visible = counts[category] || 0;
      const active = state.category === category ? "active" : "";
      const width = Math.max(4, Math.round((visible || total) / max * 100));
      return `
        <button class="category-button ${active}" type="button" data-category="${escapeHtml(category)}">
          <span class="category-name">${escapeHtml(category)}</span>
          <strong>${visible}/${total}</strong>
          <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
        </button>
      `;
    })
    .join("");

  els.categoryBars.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.category;
      state.category = state.category === value ? "" : value;
      els.categorySelect.value = state.category;
      render();
    });
  });
}

function cardTemplate(course) {
  const insight = getCourseInsight(course);
  const audience = getCourseAudience(course);
  return `
    <article class="course-card" data-id="${course.id}" tabindex="0">
      <div class="card-top">
        <span class="tag">${escapeHtml(course.category)}</span>
        <span class="tag ${qualityClass(course.data_quality)}">信心 ${escapeHtml(course.data_quality)}</span>
        ${insight ? `<span class="tag live-tag">${escapeHtml(insight.tier || "競品洞察")}</span>` : ""}
      </div>
      <h3>${escapeHtml(course.title)}</h3>
      <div class="provider">${escapeHtml(course.provider)}</div>
      ${insight ? `<div class="card-insight">${escapeHtml(insight.positioning || insight.updateStatus || "")}</div>` : ""}
      <div class="audience-chip"><b>客群</b> ${escapeHtml(audience.primaryAudience || "未公開/需確認")}</div>
      <div class="mini-grid">
        <span><b>時間</b> ${escapeHtml(course.date)}</span>
        <span><b>價格</b> ${escapeHtml(course.price)}</span>
        <span><b>老師</b> ${escapeHtml(course.teacher)}</span>
        <span><b>熱度</b> ${escapeHtml(course.hotness)}</span>
      </div>
    </article>
  `;
}

function renderCards(rows) {
  if (!rows.length) {
    els.courseGrid.innerHTML = '<div class="empty">目前篩選沒有符合的課程。</div>';
    return;
  }
  els.courseGrid.innerHTML = rows.map(cardTemplate).join("");
  els.courseGrid.querySelectorAll(".course-card").forEach((card) => {
    const open = () => openDetail(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function recommendationCardTemplate(item) {
  return `
    <article class="recommendation-card" data-rec-id="${escapeHtml(item.id)}" tabindex="0">
      <div class="card-top">
        <span class="tag live-tag">建議開課 ${escapeHtml(item.rank)}</span>
        <span class="tag">${escapeHtml(item.category)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.rewrittenCopy?.headline || "")}</p>
      <div class="mini-grid">
        <span><b>建議老師</b> ${escapeHtml(item.teacher)}</span>
        <span><b>客群</b> ${escapeHtml(item.targetAudience)}</span>
        <span><b>產品型態</b> ${escapeHtml(item.recommendedFormat)}</span>
      </div>
    </article>
  `;
}

function renderRecommendations() {
  if (!els.recommendationGrid) return;
  els.recommendationGrid.innerHTML = recommendedCourses.map(recommendationCardTemplate).join("");
  els.recommendationGrid.querySelectorAll("[data-rec-id]").forEach((card) => {
    const open = () => openRecommendation(card.dataset.recId);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  els.emergingCategoryList.innerHTML = emergingCategories
    .map(
      (item) => `
        <div class="emerging-category-item">
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.why)}</p>
          <span>${escapeHtml(item.evidence)}</span>
        </div>
      `
    )
    .join("");
}

function competitorProfileTemplate(profile) {
  const language = profile.recruitingLanguage || {};
  return `
    <article class="competitor-profile-card">
      <div class="competitor-profile-head">
        <div>
          <span class="tag live-tag">${escapeHtml(profile.tier)}</span>
          <span class="tag">${escapeHtml(profile.strategicRole)}</span>
        </div>
        <h3>${escapeHtml(profile.provider)}</h3>
        <p>${escapeHtml(profile.headline)}</p>
      </div>
      <div class="profile-two-col">
        <div>
          <span>品牌定位</span>
          <p>${escapeHtml(profile.brandPosition)}</p>
        </div>
        <div>
          <span>價格帶/產品梯隊</span>
          <p>${escapeHtml(profile.priceArchitecture)}</p>
        </div>
      </div>
      <div class="profile-framework-grid">
        ${profileMiniList("目標客群", profile.targetSegments)}
        ${profileMiniList("產品梯隊", profile.productLadder)}
        ${profileMiniList("證據與口碑", profile.evidenceSignals)}
        ${profileMiniList("盲點/風險", profile.blindSpots)}
      </div>
      <div class="profile-language-grid">
        ${profileLanguage("痛點", language.pain)}
        ${profileLanguage("承諾", language.promise)}
        ${profileLanguage("權威", language.authority)}
        ${profileLanguage("稀缺", language.scarcity)}
      </div>
      <div class="profile-two-col">
        <div>
          <span>師資策略</span>
          <p>${escapeHtml(profile.teacherStrategy)}</p>
        </div>
        <div>
          <span>對領導影響力學院的啟示</span>
          <p>${escapeHtml(profile.implicationForJoyce)}</p>
        </div>
      </div>
      ${profileMiniList("建議回應", profile.recommendedResponse, "profile-response-list")}
      <div class="profile-actions">
        <button type="button" class="profile-filter-button" data-provider="${escapeHtml(profile.provider)}">看此機構旗下課程</button>
        ${(profile.evidenceUrls || [])
          .slice(0, 3)
          .map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">來源</a>`)
          .join("")}
      </div>
    </article>
  `;
}

function profileMiniList(title, items, className = "") {
  const rows = items || [];
  if (!rows.length) return "";
  return `
    <div class="profile-mini-list ${className}">
      <span>${escapeHtml(title)}</span>
      <ul>
        ${rows.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function profileLanguage(title, value) {
  return `
    <div>
      <span>${escapeHtml(title)}</span>
      <p>${escapeHtml(value || "待補")}</p>
    </div>
  `;
}

function renderCompetitorProfiles() {
  if (!els.competitorProfileGrid) return;
  els.competitorProfileGrid.innerHTML = competitorProfiles.map(competitorProfileTemplate).join("");
  els.competitorProfileGrid.querySelectorAll("[data-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      state.provider = button.dataset.provider || "";
      els.providerSelect.value = state.provider;
      document.querySelector(".controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
      render();
    });
  });
}

function field(label, value, wide = false) {
  return `
    <div class="detail-field ${wide ? "wide" : ""}">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value || "未公開/需確認")}</p>
    </div>
  `;
}

function insightField(label, value) {
  return `
    <div class="insight-field">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value || "未公開/需確認")}</p>
    </div>
  `;
}

function insightList(title, items) {
  if (!items || !items.length) return "";
  return `
    <div class="insight-list">
      <h4>${escapeHtml(title)}</h4>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function insightTemplate(insight) {
  if (!insight) return "";
  const language = insight.language || {};
  return `
    <section class="insight-section" aria-label="競品洞察">
      <div class="insight-heading">
        <h3>競品洞察</h3>
        <span>${escapeHtml(insight.updateStatus || "")}</span>
      </div>
      <div class="insight-grid">
        ${insightField("競品層級", insight.tier)}
        ${insightField("定位判斷", insight.positioning)}
        ${insightField("痛點語言", language.pain)}
        ${insightField("價值承諾", language.promise)}
        ${insightField("權威背書", language.authority)}
        ${insightField("稀缺/轉換設計", language.scarcity)}
      </div>
      ${insightList("課程產品結構拆解", insight.productStructure)}
      ${insightList("後續追蹤欄位", insight.trackFields)}
      <div class="joyce-note">
        <span>對 Joyce 的管理意義</span>
        <p>${escapeHtml(insight.joyceImplication || "待補")}</p>
      </div>
    </section>
  `;
}

function audienceTemplate(audience, credibility) {
  const strongerSources = feedbackFramework.strongerSources || [];
  return `
    <section class="audience-section" aria-label="目標客群與口碑可信度">
      <div class="insight-heading">
        <h3>目標客群分析</h3>
        <span>${escapeHtml(audience.confidence || "")}</span>
      </div>
      <div class="insight-grid">
        ${insightField("官方/既有適用對象", audience.officialTarget)}
        ${insightField("主要客群判斷", audience.primaryAudience)}
        ${insightField("購買/決策者", audience.decisionMaker)}
        ${insightField("購買情境", audience.buyerContext)}
        ${insightField("最適合企業/學員", audience.bestFit)}
        ${insightField("不適合對象", audience.notFit)}
      </div>
      <div class="joyce-note">
        <span>客群判斷來源</span>
        <p>${escapeHtml(audience.source || "未標示")}；此欄位若非官方明載，視為研究分析，不當作官方事實。</p>
      </div>
      <div class="feedback-box">
        <div>
          <span>目前口碑資料可信度：${escapeHtml(credibility.grade)}</span>
          <p>${escapeHtml(credibility.label)}</p>
        </div>
        <div>
          <span>目前可用訊號</span>
          <p>${escapeHtml(credibility.currentEvidence)}</p>
        </div>
        <div>
          <span>如何抓回更具公信力的資料</span>
          <p>${escapeHtml(credibility.nextStep)}</p>
        </div>
      </div>
      ${insightList("優先補強來源", strongerSources)}
    </section>
  `;
}

function recommendationTemplate(item) {
  const copy = item.rewrittenCopy || {};
  const evidenceLinks = (item.evidenceUrls || [])
    .map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>`)
    .join("");
  return `
    <h2 id="detailTitle" class="detail-title">${escapeHtml(item.title)}</h2>
    <div class="detail-meta">
      <span class="tag live-tag">領導影響力學院建議開課</span>
      <span class="tag">${escapeHtml(item.category)}</span>
    </div>
    <div class="detail-grid">
      ${field("建議老師/師資組合", item.teacher, true)}
      ${field("為什麼是這組老師", item.teacherReason, true)}
      ${field("目標客群", item.targetAudience)}
      ${field("建議產品型態", item.recommendedFormat)}
      ${field("建議價格定位", item.pricePosition)}
      ${field("市場訊號", item.marketSignal, true)}
    </div>
    <section class="copy-section">
      <div class="insight-heading">
        <h3>課程文案重寫</h3>
        <span>可作為招生頁第一版</span>
      </div>
      <div class="copy-hero">
        <span>主標</span>
        <h3>${escapeHtml(copy.headline || "")}</h3>
        <p>${escapeHtml(copy.subhead || "")}</p>
      </div>
      ${insightList("文案賣點", copy.bullets || [])}
      <div class="joyce-note">
        <span>CTA</span>
        <p>${escapeHtml(copy.cta || "")}</p>
      </div>
    </section>
    <section class="insight-section">
      <div class="insight-heading">
        <h3>課程產品結構</h3>
        <span>建議版</span>
      </div>
      ${insightList("模組設計", item.productStructure || [])}
      <div class="source-list">
        <span>參考來源</span>
        ${evidenceLinks || "<p>待補</p>"}
      </div>
    </section>
  `;
}

function openRecommendation(id) {
  const item = recommendedCourses.find((course) => course.id === id);
  if (!item) return;
  els.detailContent.innerHTML = recommendationTemplate(item);
  els.detailPanel.classList.add("open");
  els.detailPanel.setAttribute("aria-hidden", "false");
}

function openDetail(id) {
  const course = courses.find((item) => item.id === id);
  if (!course) return;
  const insight = getCourseInsight(course);
  const audience = getCourseAudience(course);
  const credibility = feedbackCredibility(course);
  els.detailContent.innerHTML = `
    <h2 id="detailTitle" class="detail-title">${escapeHtml(course.title)}</h2>
    <div class="detail-meta">
      <span class="tag">${escapeHtml(course.category)}</span>
      <span class="tag">${escapeHtml(course.provider)}</span>
      <span class="tag ${qualityClass(course.data_quality)}">資料信心 ${escapeHtml(course.data_quality)}</span>
      ${insight ? `<span class="tag live-tag">${escapeHtml(insight.tier || "競品洞察")}</span>` : ""}
    </div>
    <div class="detail-grid">
      ${field("主題類別", course.category)}
      ${field("主辦/來源", course.provider)}
      ${field("時間", course.date)}
      ${field("地點", course.location)}
      ${field("價格", course.price)}
      ${field("價格型態", course.price_type)}
      ${field("老師名稱", course.teacher)}
      ${field("適用企業", course.target_company)}
      ${field("老師背景", course.teacher_background, true)}
      ${field("熱賣程度/可觀測訊號", course.hotness, true)}
      ${field("口碑/品牌訊號", course.reputation, true)}
      ${field("管理意義", course.management_implication, true)}
      ${field("研究備註", course.recency_status || course.research_note, true)}
    </div>
    ${audienceTemplate(audience, credibility)}
    ${insightTemplate(insight)}
    <a class="source-link" href="${escapeHtml(course.source_url)}" target="_blank" rel="noreferrer">開啟來源頁</a>
  `;
  els.detailPanel.classList.add("open");
  els.detailPanel.setAttribute("aria-hidden", "false");
}

function closeDetail() {
  els.detailPanel.classList.remove("open");
  els.detailPanel.setAttribute("aria-hidden", "true");
}

function render() {
  const rows = filteredCourses();
  els.visibleCount.textContent = `${rows.length} 筆`;
  els.resultLabel.textContent = `顯示 ${rows.length} / ${courses.length}`;
  renderCategoryBars(rows);
  renderCards(rows);
}

document.querySelectorAll("[data-close]").forEach((node) => {
  node.addEventListener("click", closeDetail);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetail();
});

initMeta();
initControls();
renderRecommendations();
renderCompetitorProfiles();
render();

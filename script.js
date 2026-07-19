/* =========================================================
   LANHMAR portfolio — shared script
   - loads content live from the published Google Sheet CSVs (the
     spreadsheet Lan Anh edits herself); falls back to the bundled
     assets/content.json if the Sheet can't be reached (offline,
     Sheet unpublished, network hiccup, etc.)
   - handles VI/EN language toggle (persisted in localStorage)
   - marks the active nav link
   ========================================================= */

const LANHMAR = (() => {
  const LANG_KEY = "lanhmar_lang";
  let currentLang = localStorage.getItem(LANG_KEY) || "vi";
  let renderCallback = null;

  // Published-to-web CSV links for each tab of the "LANHMAR-Nội dung portsite" Google Sheet.
  // To point at a different Sheet, replace these 6 URLs (Phần 2, mục 5-6 trong tài liệu hướng dẫn).
  const SHEET_CSV = {
    profile: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT6Mo8mE0UqHDBl5-A927B1cFsYFTsqtmyPKQ_bkbN6LTIy0VFawzAtuTJTrx_Nag/pub?gid=558172148&single=true&output=csv",
    skills: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT6Mo8mE0UqHDBl5-A927B1cFsYFTsqtmyPKQ_bkbN6LTIy0VFawzAtuTJTrx_Nag/pub?gid=891298050&single=true&output=csv",
    software: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT6Mo8mE0UqHDBl5-A927B1cFsYFTsqtmyPKQ_bkbN6LTIy0VFawzAtuTJTrx_Nag/pub?gid=333299576&single=true&output=csv",
    experience: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT6Mo8mE0UqHDBl5-A927B1cFsYFTsqtmyPKQ_bkbN6LTIy0VFawzAtuTJTrx_Nag/pub?gid=1993896740&single=true&output=csv",
    certificates: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT6Mo8mE0UqHDBl5-A927B1cFsYFTsqtmyPKQ_bkbN6LTIy0VFawzAtuTJTrx_Nag/pub?gid=2002900890&single=true&output=csv",
    projects: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT6Mo8mE0UqHDBl5-A927B1cFsYFTsqtmyPKQ_bkbN6LTIy0VFawzAtuTJTrx_Nag/pub?gid=82281837&single=true&output=csv",
  };

  function getLang() { return currentLang; }

  function applyLangClass() {
    document.body.classList.remove("lang-vi", "lang-en");
    document.body.classList.add(currentLang === "en" ? "lang-en" : "lang-vi");
    document.querySelectorAll(".lang-toggle button").forEach(btn => {
      btn.classList.toggle("is-on", btn.dataset.lang === currentLang);
    });
  }

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    applyLangClass();
    if (renderCallback) renderCallback(currentLang);
  }

  function onRender(cb) {
    renderCallback = cb;
  }

  // ---- security helpers ----
  // All visible content comes from a Google Sheet Lan Anh edits herself, then
  // gets interpolated into template strings and assigned via innerHTML. Any
  // text value MUST be escaped before that, or a stray "<script>"/"<img
  // onerror=...>" typed into a Sheet cell would execute for every visitor.
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Values used as href/src (facebook_url, linkedin_url, video links, images)
  // are attributes, not text — escaping quotes isn't enough on its own,
  // because a "javascript:" URL still runs on click even when properly
  // quoted. Only allow http(s)/mailto/tel links or same-site relative paths
  // (e.g. "assets/img/..."); anything else (javascript:, data:, vbscript:...)
  // is stripped to "#".
  function safeUrl(s) {
    // Strip C0 control characters (tab, CR, LF, ...) BEFORE checking the
    // scheme. Browsers ignore these when parsing a URL, so a Sheet cell
    // containing "java\tscript:alert(1)" would sail past the scheme regex
    // below (it doesn't look like "javascript:" with the tab still in it)
    // and get returned as a harmless-looking "relative path" — while the
    // browser that later loads it strips the tab itself and happily runs it
    // as javascript:. Stripping here first closes that gap.
    const v = String(s ?? "").replace(/[\x00-\x1f]/g, "").trim();
    if (!v) return "";
    if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
    if (/^\/\//.test(v)) return "#"; // protocol-relative ("//evil.com/x") — would navigate off-site
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return "#"; // some other scheme (javascript:, data:, ...) — block it
    return v; // relative path like "assets/img/x.jpg"
  }

  // ---- broken-image fallback ----
  // Every image whose URL comes from the Sheet (project/certificate photos,
  // video thumbnails, experience company logos) can 404 — a bad pasted
  // Drive link, a since-deleted YouTube video, a typo'd filename. Without
  // this, visitors see the browser's default "broken image" icon. Swap in a
  // plain neutral placeholder instead. Exposed on `window` (not inside the
  // LANHMAR closure) because it's wired up via inline onerror="" attributes
  // in HTML built through innerHTML, which can only reach globally-scoped
  // functions.
  window.LANHMAR_imgFallback = function (img) {
    if (img.dataset.fallbackApplied) return; // avoid a loop if the placeholder itself ever fails
    img.dataset.fallbackApplied = "1";
    img.onerror = null;
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23ece7f7'/%3E%3Cpath d='M150 190l35-45 30 35 25-30 45 55z' fill='%23c9c0e8'/%3E%3Ccircle cx='150' cy='115' r='18' fill='%23c9c0e8'/%3E%3C/svg%3E";
    img.classList.add("img-fallback");
  };

  // Minimal RFC4180-ish CSV parser (handles quoted fields, embedded commas/
  // newlines, and "" escaped quotes) — avoids depending on an external CDN
  // library just to read a published Google Sheet CSV.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
      } else if (c === "\r") {
        // skip, \n (or end) handles the row break
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }

    const nonEmpty = rows.filter(r => r.some(v => v.trim() !== ""));
    if (!nonEmpty.length) return [];
    const header = nonEmpty[0].map(h => h.trim());
    return nonEmpty.slice(1).map(r => {
      const obj = {};
      header.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ""; });
      return obj;
    });
  }

  async function fetchRows(url) {
    // priority:"low" (Chrome's Fetch Priority API; harmlessly ignored by
    // browsers that don't support it) — these 6 cross-origin CSV requests
    // otherwise compete for bandwidth/connections with the page's own CSS,
    // JS and hero image on every load, even though the fallback content.json
    // almost always wins the race in loadContent() anyway.
    const res = await fetch(url, { cache: "no-store", priority: "low" });
    if (!res.ok) throw new Error("Fetch failed: " + url);
    const text = await res.text();
    return parseCSV(text);
  }

  function splitLines(s) {
    return (s || "").split("\n").map(x => x.trim()).filter(Boolean);
  }

  function buildProfile(rows, skillsRows, softwareRows) {
    const profile = {};
    const education = {};
    rows.forEach(r => {
      const field = (r.field || "").trim();
      if (!field) return;
      const vi = r.value_vi ?? "";
      const en = (r.value_en || vi) ?? "";
      if (field.startsWith("education_")) {
        const sub = field.slice("education_".length);
        education[sub] = vi || en;
        education[sub + "_vi"] = vi;
        education[sub + "_en"] = en;
      } else {
        // Fields read directly (not through t()) — e.g. edu.years, phoneIntl,
        // banner — still need a vi||en fallback, or a row filled in only one
        // column (common when a value doesn't need "translating", like a
        // date) would render blank.
        profile[field] = vi || en;
        profile[field + "_vi"] = vi;
        profile[field + "_en"] = en;
      }
    });
    profile.education = education;
    profile.skills = skillsRows
      .filter(r => (r.skill_vi || "").trim())
      .map(r => ({ vi: r.skill_vi || "", en: r.skill_en || r.skill_vi || "" }));
    profile.software = softwareRows
      .filter(r => (r.group_vi || "").trim())
      .map(r => ({
        group_vi: r.group_vi || "",
        group_en: r.group_en || r.group_vi || "",
        items: (r.items_comma_separated || "").split(",").map(s => s.trim()).filter(Boolean),
      }));
    return profile;
  }

  // Multi-value spreadsheet cells (several image URLs in one column) use
  // " | " as the separator — easy for Lan Anh to type in Sheets/Excel.
  function splitPipe(s) {
    return (s || "").split("|").map(x => x.trim()).filter(Boolean);
  }

  // Same "|" convention, but for per-slide captions — an empty segment
  // between two pipes is meaningful here (it means "no caption for this
  // slide", not "skip this slide"), so unlike splitPipe() this must NOT
  // drop blanks or the caption-to-image index alignment breaks.
  function splitPipeKeepEmpty(s) {
    if (!s) return [];
    return s.split("|").map(x => x.trim());
  }

  // A per-slide caption can itself contain multiple lines (typed with a
  // line break inside the Sheet cell) — when it does, render it as a
  // bullet list instead of one dense paragraph, which is much easier to
  // scan for a step-by-step / multi-point caption. A single-line caption
  // still renders as a plain paragraph.
  function renderCaptionHTML(text) {
    const lines = String(text ?? "").split("\n").map(x => x.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.length === 1) return `<p>${esc(lines[0])}</p>`;
    return `<ul class="carousel-caption__list">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
  }

  // Builds the per-slide caption arrays (one entry per slide, images then
  // videos, matching the slide order buildCarousel() renders in) for BOTH
  // languages at once — unlike an earlier draft of this helper, it does NOT
  // resolve to a single language via the `currentLang` closure. That would
  // work for the live Google-Sheet path (buildProjects()/buildCertificates()
  // re-run fresh on every language toggle) but would break the bundled
  // assets/content.json fallback, which stores both `_vi`/`_en` variants for
  // every bilingual field (same convention as tasks_vi/tasks_en in
  // buildExperience). Returning {vi, en} here keeps both data paths the same
  // shape; the page template picks the right one at render time using its
  // own `lang` variable, exactly like every other bilingual field.
  // Falls back to repeating the single legacy desc/project text for every
  // image slide when no per-slide captions were authored, and to each
  // video's own label for video slides — so older Sheet rows (or a
  // brand-new row Lan Anh adds herself without knowing about the new
  // columns) still work.
  function buildSlideCaptionSet(rawVi, rawEn, legacyVi, legacyEn, imageCount, videos, itemLabel) {
    function forLang(raw, legacy, vidLabelField, langTag) {
      const perSlide = splitPipeKeepEmpty(raw);
      // A caption count that doesn't match the image count almost always
      // means a "|"-separated caption was mistyped in the Sheet — the
      // fallback below silently drops/pads the mismatch so the page never
      // breaks, but that also means Lan Anh would never find out she typed
      // it wrong unless she happens to check the browser console.
      if (perSlide.length && perSlide.length !== imageCount) {
        console.warn(`[LANHMAR] "${itemLabel || "?"}" (${langTag}): số caption (${perSlide.length}) không khớp số ảnh (${imageCount}) — kiểm tra lại cột caption trong Sheet, các dấu "|" có thể bị thiếu/thừa.`);
      }
      const imgCaptions = [];
      for (let i = 0; i < imageCount; i++) {
        const v = perSlide[i];
        imgCaptions.push(v && v.length ? v : (perSlide.length ? "" : (legacy || "")));
      }
      const vidCaptions = (videos || []).map(v => v[vidLabelField] || v.label_vi || "");
      return imgCaptions.concat(vidCaptions);
    }
    return {
      vi: forLang(rawVi, legacyVi, "label_vi", "VI"),
      en: forLang(rawEn || rawVi, legacyEn || legacyVi, "label_en", "EN"),
    };
  }

  function buildExperience(rows) {
    return rows
      .filter(r => (r.title_vi || "").trim())
      .map(r => ({
        title_vi: r.title_vi || "",
        title_en: r.title_en || r.title_vi || "",
        // org_vi/org_en: the older Sheet convention was a single "org" column
        // shown as-is in both languages (never translated). Falls back to it
        // so an existing Sheet row without the new org_vi/org_en columns still
        // renders exactly as before; a row that DOES have them gets a proper
        // EN translation of the company/organization name.
        org_vi: r.org_vi || r.org || "",
        org_en: r.org_en || r.org_vi || r.org || "",
        period: r.period || "",
        logo: r.logo_url || "",
        workImage: r.work_image_url || "",
        context_vi: r.context_vi || "",
        context_en: r.context_en || r.context_vi || "",
        tasks_vi: splitLines(r.tasks_vi),
        tasks_en: splitLines(r.tasks_en),
        achievements_vi: splitLines(r.achievements_vi),
        achievements_en: splitLines(r.achievements_en),
      }));
  }

  function buildCertificates(rows) {
    return rows
      .filter(r => (r.name_vi || "").trim())
      .map(r => {
        const images = splitPipe(r.images_urls);
        if (!images.length && r.image_url) images.push(r.image_url.trim());
        // project_vi/project_en double as the per-slide captions: a single
        // certificate photo just gets one caption (optionally multi-line,
        // rendered as bullets); a multi-image certificate (e.g. the 6-session
        // Canva Academy one) can instead give each image its own "|"-separated
        // segment, shown in sync as the visitor swipes through.
        const slideCaptions = buildSlideCaptionSet(r.project_vi, r.project_en, r.project_vi, r.project_en, images.length, null, r.name_vi || r.org);
        return {
          name_vi: r.name_vi || "",
          name_en: r.name_en || r.name_vi || "",
          org: r.org || "",
          project_vi: r.project_vi || "",
          project_en: r.project_en || r.project_vi || "",
          images,
          slideCaptions_vi: slideCaptions.vi,
          slideCaptions_en: slideCaptions.en,
        };
      });
  }

  function buildProjects(rows) {
    return rows
      .filter(r => (r.key || "").trim())
      .map(r => {
        const images = splitPipe(r.images_urls);
        if (!images.length && r.image_url) images.push(r.image_url.trim());
        const videos = [];
        for (let n = 1; n <= 3; n++) {
          const url = (r["video" + n + "_url"] || "").trim();
          if (!url) continue;
          videos.push({
            url,
            thumb: (r["video" + n + "_thumb"] || images[0] || "").trim(),
            label_vi: r["video" + n + "_label_vi"] || "",
            label_en: r["video" + n + "_label_en"] || r["video" + n + "_label_vi"] || "",
          });
        }
        // slide_captions_vi/en: one "|"-separated caption per image (a project
        // with several distinct works in its carousel — e.g. Planning's BABÉ
        // proposal + Karo Richy IMC plan — gets its own caption per image
        // instead of one blob describing all of them at once). Falls back to
        // the plain desc_vi/desc_en for every slide if left blank.
        const slideCaptions = buildSlideCaptionSet(r.slide_captions_vi, r.slide_captions_en, r.desc_vi, r.desc_en, images.length, videos, r.title_vi || r.key);
        // canva_url: same "|" convention — a per-image link to the full plan
        // on Canva, shown only for the slide(s) that have one. URLs aren't
        // bilingual text, so a single array (aligned to image slides) covers
        // both languages.
        const canvaUrls = splitPipeKeepEmpty(r.canva_url || "");
        return {
          key: r.key || "",
          title_vi: r.title_vi || "",
          title_en: r.title_en || r.title_vi || "",
          image: images[0] || "",
          images,
          videos,
          desc_vi: r.desc_vi || "",
          desc_en: r.desc_en || r.desc_vi || "",
          brief_vi: r.brief_vi || "",
          brief_en: r.brief_en || r.brief_vi || "",
          slideCaptions_vi: slideCaptions.vi,
          slideCaptions_en: slideCaptions.en,
          canvaUrls,
        };
      });
  }

  // ---- reusable swipeable image/video carousel ----
  // Note: deliberately NOT using loading="lazy" here — inside a horizontally
  // scrolling flex track, Chromium's lazy-load intersection check is unreliable
  // (confirmed: images silently never load on first paint even when the slide
  // is visible on screen). These are small compressed JPGs, so eager loading
  // is cheap and guarantees every visitor actually sees the images.
  // overlay: true when the card renders its per-slide caption as a bar
  // overlaid on the image itself (buildCarousel's `opts.overlay`) — in that
  // mode the caption already carries the video's label text, so the
  // slide-baked .carousel__video-label would just duplicate it. Only skip
  // that baked-in label in overlay mode; certificates.html (never passes
  // overlay) keeps the old behavior unchanged.
  function slideHTML(s, altBase, index, overlay) {
    const alt = esc(`${altBase} ${index + 1}`);
    if (s.type === "video") {
      const label = t(s, "label");
      return `<div class="carousel__slide"><a class="carousel__video" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">
        <img src="${esc(safeUrl(s.thumb))}" alt="${alt}" onerror="window.LANHMAR_imgFallback(this)">
        <span class="carousel__play">▶</span>
        ${(label && !overlay) ? `<span class="carousel__video-label">${esc(label)}</span>` : ""}
      </a></div>`;
    }
    return `<div class="carousel__slide"><img src="${esc(safeUrl(s.src))}" alt="${alt}" onerror="window.LANHMAR_imgFallback(this)"></div>`;
  }

  // captions: array of already-language-resolved strings, one per slide
  // (images first, then videos — same order as `slides` below). canvaUrls:
  // array of URLs aligned to the IMAGE slides only (a "view full plan on
  // Canva" link only ever applies to an image, never a video slide).
  // Both are optional — every existing call site that omits them keeps
  // working exactly as before (no caption box, no plan-link button).
  // opts.overlay: when true, the per-slide caption renders INSIDE the
  // carousel as a gradient-scrim bar overlaid on the image/video itself
  // (updated live as the visitor drags/swipes between slides), instead of
  // requiring the page template to provide a separate `.carousel-caption`
  // box below the carousel. Used by projects.html so a card's images/videos
  // stay the visual lead and their (short) captions don't eat extra card
  // height; certificates.html omits opts entirely and keeps the older
  // below-carousel caption box unchanged.
  function buildCarousel(images, videos, altBase, captions, canvaUrls, opts) {
    opts = opts || {};
    images = images || [];
    videos = videos || [];
    const slides = images.map(src => ({ type: "image", src }))
      .concat(videos.map(v => ({ type: "video", ...v })));
    if (!slides.length) return "";
    const prevLabel = currentLang === "en" ? "Previous" : "Trước";
    const nextLabel = currentLang === "en" ? "Next" : "Sau";
    const slideLabel = currentLang === "en" ? "Slide" : "Ảnh";
    const slidesHTML = slides.map((s, i) => slideHTML(s, altBase || "", i, opts.overlay)).join("");
    const nav = slides.length > 1 ? `
      <button type="button" class="carousel__btn carousel__btn--prev" aria-label="${prevLabel}">‹</button>
      <button type="button" class="carousel__btn carousel__btn--next" aria-label="${nextLabel}">›</button>
    ` : "";
    const dotsHTML = slides.length > 1 ? `<div class="carousel__dots">${slides.map((_, i) => `<button type="button" class="carousel__dot${i === 0 ? " is-active" : ""}" aria-label="${slideLabel} ${i + 1}"></button>`).join("")}</div>` : "";
    // Captions/plan-links are read back by wireCarousels() once the markup is
    // actually in the DOM, via this stashed data-* JSON.
    const captionsAttr = esc(JSON.stringify(captions || []));
    const canvaAttr = esc(JSON.stringify(canvaUrls || []));
    // Non-overlay mode keeps dots positioned directly on the carousel (old
    // behavior, still used by certificates.html) — overlay mode nests the
    // caption + dots together inside one bottom gradient-scrim bar so the
    // caption text and the dots read as one unit instead of two overlapping
    // absolutely-positioned layers.
    const bottomHTML = opts.overlay
      ? `<div class="carousel__overlay"><div class="carousel-caption"></div>${dotsHTML}</div>`
      : dotsHTML;
    return `<div class="carousel${opts.overlay ? " carousel--overlay" : ""}" data-carousel data-captions="${captionsAttr}" data-canva-urls="${canvaAttr}">
      <div class="carousel__track">${slidesHTML}</div>
      ${nav}
      ${bottomHTML}
    </div>`;
  }

  function wireCarousels(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-carousel]").forEach(car => {
      if (car.dataset.wired) return;
      car.dataset.wired = "1";
      const track = car.querySelector(".carousel__track");
      const prev = car.querySelector(".carousel__btn--prev");
      const next = car.querySelector(".carousel__btn--next");
      const dots = car.querySelectorAll(".carousel__dot");
      const slideWidth = () => track.clientWidth;

      let captions = [];
      let canvaUrls = [];
      try { captions = JSON.parse(car.dataset.captions || "[]"); } catch (e) { captions = []; }
      try { canvaUrls = JSON.parse(car.dataset.canvaUrls || "[]"); } catch (e) { canvaUrls = []; }
      // The caption box lives either INSIDE the carousel itself (overlay
      // mode — buildCarousel's opts.overlay put it there) or as a sibling
      // element below the carousel, provided by the page template
      // (certificates.html's older pattern) — check both. The plan-link
      // button is always a sibling (it's a real clickable CTA, not a
      // passive caption, so it stays outside the carousel in both modes).
      const wrap = car.parentElement;
      const captionEl = car.querySelector(".carousel-caption") || (wrap ? wrap.querySelector(".carousel-caption") : null);
      const planLink = wrap ? wrap.querySelector(".carousel-plan-link") : null;

      const updateSlideExtras = (idx) => {
        if (captionEl) captionEl.innerHTML = renderCaptionHTML(captions[idx]);
        if (planLink) {
          const url = canvaUrls[idx];
          if (url) {
            planLink.href = safeUrl(url);
            planLink.style.display = "";
          } else {
            planLink.style.display = "none";
          }
        }
      };

      if (prev) prev.addEventListener("click", () => track.scrollBy({ left: -slideWidth(), behavior: "smooth" }));
      if (next) next.addEventListener("click", () => track.scrollBy({ left: slideWidth(), behavior: "smooth" }));
      dots.forEach((d, i) => d.addEventListener("click", () => track.scrollTo({ left: i * slideWidth(), behavior: "smooth" })));
      let timer;
      track.addEventListener("scroll", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const idx = Math.round(track.scrollLeft / slideWidth());
          dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
          updateSlideExtras(idx);
        }, 80);
      });

      updateSlideExtras(0);
    });
  }

  // ---- collapsible accordion (used to group the 4 SEONGON certificates) ----
  // Height is measured in JS (scrollHeight) rather than a fixed CSS max-height,
  // so it stays correct however many cards/carousels end up inside — and once
  // fully open, max-height is released to "none" so it can't clip anything if
  // the content resizes (e.g. window resize reflowing the card grid).
  //
  // The resize handling is ONE listener registered once on `window` (below),
  // not one-per-accordion. Pages like certificates.html rebuild the entire
  // accordion markup from scratch on every re-render (language toggle, Sheet
  // upgrade landing) — a per-accordion `window.addEventListener("resize", …)`
  // would keep accumulating forever, since the old DOM nodes it closed over
  // get discarded but a `window` listener never does. The delegated listener
  // just re-measures whatever accordions are open in the CURRENT document at
  // resize time, so nothing piles up across re-renders.
  let accordionResizeWired = false;
  function wireAccordionResize() {
    if (accordionResizeWired) return;
    accordionResizeWired = true;
    window.addEventListener("resize", () => {
      document.querySelectorAll("[data-accordion].is-open").forEach(acc => {
        const panel = acc.querySelector(".accordion__panel");
        if (panel && panel.style.maxHeight !== "none") {
          panel.style.maxHeight = panel.scrollHeight + "px";
        }
      });
    });
  }

  function wireAccordions(root) {
    const scope = root || document;
    wireAccordionResize();
    scope.querySelectorAll("[data-accordion]").forEach(acc => {
      if (acc.dataset.wired) return;
      acc.dataset.wired = "1";
      const header = acc.querySelector(".accordion__header");
      const panel = acc.querySelector(".accordion__panel");
      if (!header || !panel) return;

      const open = () => {
        acc.classList.add("is-open");
        header.setAttribute("aria-expanded", "true");
        panel.style.maxHeight = panel.scrollHeight + "px";
      };
      const close = () => {
        panel.style.maxHeight = panel.scrollHeight + "px";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { panel.style.maxHeight = "0px"; });
        });
        acc.classList.remove("is-open");
        header.setAttribute("aria-expanded", "false");
      };

      header.addEventListener("click", () => {
        if (acc.classList.contains("is-open")) close(); else open();
      });
      panel.addEventListener("transitionend", (e) => {
        if (e.propertyName === "max-height" && acc.classList.contains("is-open")) {
          panel.style.maxHeight = "none";
        }
      });
    });
  }

  async function loadFromSheet() {
    const [profileRows, skillsRows, softwareRows, expRows, certRows, projRows] = await Promise.all([
      fetchRows(SHEET_CSV.profile),
      fetchRows(SHEET_CSV.skills),
      fetchRows(SHEET_CSV.software),
      fetchRows(SHEET_CSV.experience),
      fetchRows(SHEET_CSV.certificates),
      fetchRows(SHEET_CSV.projects),
    ]);
    return {
      profile: buildProfile(profileRows, skillsRows, softwareRows),
      experience: buildExperience(expRows),
      certificates: buildCertificates(certRows),
      projects: buildProjects(projRows),
    };
  }

  // Check the fields visitors would actually notice missing — not just
  // "is this object truthy" (buildProfile/buildExperience/etc. always
  // return an object/array, even when the underlying Sheet tab is empty,
  // so a truthy check alone never catches a wiped-out tab). Broken out
  // per-section (rather than one big all-or-nothing check) so a problem in
  // just one Sheet tab (e.g. Certificates accidentally cleared) doesn't
  // force the whole site — Profile, Experience, Projects and all — back to
  // the old bundled content.json snapshot. See mergeWithFallback() below.
  const CONTENT_SECTIONS = ["profile", "experience", "projects", "certificates"];
  function sectionOk(data, section) {
    if (!data) return false;
    switch (section) {
      case "profile":
        return !!(data.profile && data.profile.name && data.profile.email &&
          data.profile.skills && data.profile.skills.length &&
          data.profile.software && data.profile.software.length);
      case "experience": return !!(data.experience && data.experience.length);
      case "projects": return !!(data.projects && data.projects.length);
      case "certificates": return !!(data.certificates && data.certificates.length);
      default: return false;
    }
  }
  function isContentComplete(data) {
    return CONTENT_SECTIONS.every(section => sectionOk(data, section));
  }

  // Take each section from the live Sheet data if it looks valid; otherwise
  // patch in the bundled fallback's version of just that section (and say
  // so in the console) instead of throwing away everything the Sheet DID
  // get right.
  function mergeWithFallback(sheetData, fallbackData) {
    const merged = Object.assign({}, fallbackData, sheetData);
    CONTENT_SECTIONS.forEach(section => {
      if (!sectionOk(sheetData, section)) {
        console.warn(`[LANHMAR] Mục "${section}" trên Google Sheet trống hoặc thiếu dữ liệu — tạm dùng bản dự phòng cho riêng mục này.`);
        merged[section] = fallbackData ? fallbackData[section] : undefined;
      }
    });
    return merged;
  }

  let fallbackDataPromise = null;
  async function fetchLocalFallback() {
    if (!fallbackDataPromise) {
      fallbackDataPromise = fetch("assets/content.json").then(res => res.json());
      fallbackDataPromise.catch(() => { fallbackDataPromise = null; }); // allow retry if this failed
    }
    return fallbackDataPromise;
  }

  // The Sheet fetch is memoized per page-load: loadContent() may end up
  // calling this more than once (the initial race below, and again from
  // scheduleSheetUpgrade()'s background check), and this guarantees all of
  // them share the exact same in-flight/resolved request instead of firing
  // six duplicate CSV fetches at Google. Only a SUCCESSFUL fetch is kept
  // memoized — if the Sheet genuinely failed to load (network hiccup,
  // Sheet unpublished, etc.), the failure is NOT cached, so the next call
  // (e.g. the next page visited, or scheduleSheetUpgrade's background
  // retry) gets a fresh attempt instead of being stuck on the first error
  // for the rest of the visit.
  let sheetDataPromise = null;
  function getSheetData() {
    if (!sheetDataPromise) {
      sheetDataPromise = loadFromSheet();
      sheetDataPromise.catch(() => { sheetDataPromise = null; });
    }
    return sheetDataPromise;
  }

  let sheetUpgradeScheduled = false;
  // Called only when the very first paint had to use the bundled fallback
  // because the Sheet was too slow. The Sheet fetch is still in flight (it
  // was never cancelled, just outraced) — once it resolves, quietly
  // re-render the page with the fresher live data so a visitor never sees
  // stale/placeholder content for longer than necessary, without ever
  // blocking the first paint on Google's network.
  function scheduleSheetUpgrade() {
    if (sheetUpgradeScheduled) return;
    sheetUpgradeScheduled = true;
    getSheetData()
      .then(() => { if (renderCallback) renderCallback(currentLang); })
      .catch(() => { /* Sheet never came through this page-load — the bundled fallback is already on screen */ });
  }

  async function loadContent() {
    // Race the (slower, cross-origin) Google Sheet fetch against a short
    // timeout instead of always waiting on it. assets/content.json ships
    // bundled with the site (same-origin, effectively instant), so if the
    // Sheet hasn't answered within the window below, paint immediately with
    // that bundled snapshot rather than leaving visitors looking at a blank
    // page — then upgrade to the live Sheet data in the background as soon
    // as it lands (see scheduleSheetUpgrade above).
    // 300ms (not the original 900ms): measured against the live Sheet, the
    // CSV fetch chain (docs.google.com -> a redirect to
    // doc-XX-sheets.googleusercontent.com) consistently takes well over a
    // second end-to-end, so the Sheet essentially never wins this race
    // either way — the only effect of a longer timeout was ~600ms of dead
    // time on every single page load before the (already-ready) bundled
    // snapshot got to paint. Shortening it doesn't change when the
    // Sheet-driven background upgrade lands (that's tracked from when the
    // fetch started, not from this timeout), it just gets the first paint
    // on screen sooner.
    const SLOW = Symbol("slow");
    const timeout = new Promise(resolve => setTimeout(() => resolve(SLOW), 300));
    let fast;
    try {
      fast = await Promise.race([getSheetData(), timeout]);
    } catch (e) {
      console.warn("[LANHMAR] Không tải được dữ liệu từ Google Sheet, dùng bản dữ liệu dự phòng.", e);
      fast = SLOW;
    }
    if (fast !== SLOW) {
      if (isContentComplete(fast)) return fast;
      // The Sheet answered in time, but one (or more) tab looks empty/
      // broken — patch just that section from the bundled fallback instead
      // of throwing away every section the Sheet DID return correctly.
      try {
        return mergeWithFallback(fast, await fetchLocalFallback());
      } catch (eFallback) {
        return fast; // no bundled fallback available either — show what the Sheet DID give us
      }
    }

    scheduleSheetUpgrade();
    try {
      return await fetchLocalFallback();
    } catch (e2) {
      console.warn("[LANHMAR] Không tải được bản dữ liệu dự phòng — chờ Google Sheet.", e2);
      try {
        return await getSheetData();
      } catch (e3) {
        console.error("[LANHMAR] Cả Google Sheet lẫn assets/content.json đều không tải được — trang sẽ trống.", e3);
        throw e3;
      }
    }
  }

  function t(obj, field) {
    // reads e.g. t(item, 'title') -> item.title_vi or item.title_en
    const key = field + "_" + (currentLang === "en" ? "en" : "vi");
    return obj[key] ?? obj[field] ?? "";
  }

  // ---- project "brief" parsing ----
  // A project's brief_vi/brief_en Sheet cell is one free-text field Lan Anh
  // types as "Đề bài: ... Cách làm: ... Sản phẩm: ..." (a couple of rows use
  // "Kết quả:" instead of "Sản phẩm:"; English rows use "Brief: ...
  // Approach: ... Output:"/"Result:"). Splitting it into {problem, approach,
  // result} lets the page show Đề bài+Cách làm above the image carousel and
  // Kết quả as its own line below it, without asking her to maintain 3
  // separate Sheet columns for something she can type as one paragraph.
  const BRIEF_LABEL_RE = /(Đề bài|Brief|Cách làm|Approach|Sản phẩm|Kết quả|Output|Result)\s*:\s*/g;
  function parseBriefSections(text) {
    const sections = { problem: "", approach: "", result: "" };
    if (!text) return sections;
    const matches = [];
    let m;
    BRIEF_LABEL_RE.lastIndex = 0;
    while ((m = BRIEF_LABEL_RE.exec(text))) {
      matches.push({ label: m[1].toLowerCase(), start: m.index, contentStart: BRIEF_LABEL_RE.lastIndex });
    }
    if (!matches.length) {
      // No recognized label — an older/hand-typed row without the
      // "Đề bài:" convention. Show the whole thing above the carousel
      // rather than silently dropping it.
      sections.problem = text.trim();
      return sections;
    }
    matches.forEach((mt, i) => {
      const end = i + 1 < matches.length ? matches[i + 1].start : text.length;
      const content = text.slice(mt.contentStart, end).trim();
      if (mt.label === "đề bài" || mt.label === "brief") sections.problem = content;
      else if (mt.label === "cách làm" || mt.label === "approach") sections.approach = content;
      else sections.result = content; // sản phẩm / kết quả / output / result
    });
    return sections;
  }

  // ---- expand/collapse for the (possibly long) brief text above a
  // project's carousel — clamped to a few lines by CSS; the "Xem thêm"/
  // "See more" toggle is only shown when the text actually overflows that
  // clamp (measured after layout), and its label swaps on click instead of
  // just yanking the extra text into view with no way back.
  function wireBriefToggles(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-brief]").forEach(box => {
      const textEl = box.querySelector(".folder-card__brief-text");
      const btn = box.querySelector(".folder-card__brief-toggle");
      if (!textEl || !btn) return;
      box.classList.remove("is-expanded");
      btn.textContent = btn.dataset.moreLabel || btn.textContent;
      requestAnimationFrame(() => {
        const overflowing = textEl.scrollHeight > textEl.clientHeight + 1;
        btn.style.display = overflowing ? "" : "none";
      });
      if (btn.dataset.wired) return;
      btn.dataset.wired = "1";
      btn.addEventListener("click", () => {
        const expanded = box.classList.toggle("is-expanded");
        btn.textContent = expanded ? (btn.dataset.lessLabel || btn.textContent) : (btn.dataset.moreLabel || btn.textContent);
      });
    });
  }

  // Real header height (not a guessed constant), exposed as --header-h —
  // kept as a general utility for any page that needs to offset something
  // exactly below the sticky header (its height isn't fixed: .nav__links
  // wraps to an extra row on narrow widths).
  function syncHeaderHeight() {
    const header = document.querySelector("header.site");
    if (!header) return;
    document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }

  // Fade/slide an element in the first time it scrolls into view (used by
  // the project cards on projects.html). Uses IntersectionObserver rather
  // than a scroll listener — cheaper, and naturally handles elements that
  // are already in view on page load (no flash of invisible content).
  // Each observed element is only ever revealed once: the observer
  // unobserves it right after adding .is-visible, so scrolling back up
  // never re-hides a card the visitor already saw. Safe to call again on
  // every re-render (language toggle rebuilds this markup from scratch) —
  // matching elements just get a fresh observer on the fresh DOM nodes.
  //
  // rootMargin: "0px 0px -20% 0px" shrinks the viewport's bottom edge
  // upward by 20% before intersection is computed, so a card only counts
  // as "intersecting" once it has crossed roughly 80% down the screen —
  // matching the requested trigger point without needing a scroll listener
  // to measure position by hand.
  //
  // Staggered reveal: entries arrive in one batch whenever several cards
  // cross the trigger at once (most commonly several already sit above the
  // 80% line on first paint). Each entry in that same batch gets a small
  // extra transition-delay (STAGGER_STEP per index) set as inline style
  // right before .is-visible is added, so they animate in as a short
  // ripple instead of all at once. Cards revealed individually while
  // scrolling just get index 0 (no perceptible delay).
  function wireReveal(root, selector) {
    const scope = root || document;
    const els = scope.querySelectorAll(selector);
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("is-visible")); // no IO support — just show everything
      return;
    }
    const STAGGER_STEP = 0.12; // seconds between cards revealed in the same batch
    const io = new IntersectionObserver((entries) => {
      entries.filter(entry => entry.isIntersecting).forEach((entry, i) => {
        entry.target.style.transitionDelay = (i * STAGGER_STEP) + "s";
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -20% 0px" });
    els.forEach(el => io.observe(el));
  }

  // Pinned card-stack scroll effect (projects.html), modeled on the
  // "Hoạt động kinh doanh" section on yeah1group.com's homepage. Each card
  // is already `position: sticky` at the same `top` (see .proj-card in
  // style.css), which is what makes a card pin in place while the next
  // one scrolls up over it. This function layers a GSAP ScrollTrigger on
  // top of that: as a card's own (unpinned, in-flow) top edge reaches the
  // sticky line, it scrubs from a hidden pose (opacity 0, tilted back
  // via rotateX, scaled down) to fully shown (opacity 1, flat, full
  // scale) — then, as that same card's own bottom edge reaches the sticky
  // line (the point where it would naturally unstick and hand off to the
  // next card), it scrubs back to the hidden pose again. `scrub: true`
  // ties the whole thing directly to scroll position (not a timer), so
  // it's exactly as reversible as the sticky pin itself — scroll up and
  // the previous card fades back in while the current one fades back out.
  //
  // The FIRST card is already what a visitor lands on — nothing above it
  // triggers a reveal — so it starts fully shown (no hidden pose) and only
  // gets the fade-OUT half as the second card takes over. Symmetrically,
  // the LAST card only gets the fade-IN half, since nothing follows it.
  //
  // The last card also gets its scroll window clamped to the page's real
  // scroll ceiling (documentHeight - viewportHeight). Reason: its "end"
  // would normally be its own natural bottom edge, same as every other
  // card — but with no card after it, there's nothing forcing enough
  // trailing space to exist below it, so on taller viewports that natural
  // end point can fall past what the page can actually scroll to, leaving
  // the card stuck mid-fade forever. Clamping guarantees its reveal always
  // finishes by the time a visitor hits true max scroll, on any screen.
  //
  // Trigger positions are measured from each card's natural (untransformed)
  // bounding box, captured in one pass BEFORE any gsap.set() below touches
  // opacity/rotateX/scale — reading getBoundingClientRect after that set()
  // would return the already-shrunk/rotated box and throw the math off.
  //
  // Requires GSAP + ScrollTrigger (loaded via CDN in projects.html) —
  // no-ops if either didn't load, so the page still renders normally
  // (cards just stay plain, fully-visible sticky cards with no fade/tilt).
  // Deliberately does NOT skip under prefers-reduced-motion (unlike
  // wireReveal() above) — per explicit request, this effect should always
  // play regardless of the visitor's OS/browser motion-reduction setting.
  //
  // Safe to call again on every re-render (language toggle rebuilds this
  // markup from scratch): kills every ScrollTrigger this function created
  // last time first, since those would otherwise keep pointing at DOM
  // nodes the re-render just threw away.
  let cardStackTriggers = [];
  function wireCardStack(root, selector) {
    cardStackTriggers.forEach(st => st.kill());
    cardStackTriggers = [];
    const scope = root || document;
    const cards = [...scope.querySelectorAll(selector)];
    if (!cards.length) return;
    if (!window.gsap || !window.ScrollTrigger) return; // CDN unreachable
    gsap.registerPlugin(ScrollTrigger);
    const header = document.querySelector("header.site");
    const offset = (header ? header.offsetHeight : 64) + 16; // matches .proj-card's sticky `top` in style.css

    const scrollYAtMeasure = window.scrollY;
    const naturalRects = cards.map(card => {
      const r = card.getBoundingClientRect();
      return { top: r.top + scrollYAtMeasure, bottom: r.bottom + scrollYAtMeasure };
    });
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    cards.forEach((card, i) => {
      const isFirst = i === 0;
      const isLast = i === cards.length - 1;
      gsap.set(card, {
        transformPerspective: 900, transformOrigin: "top center",
        opacity: isFirst ? 1 : 0, rotateX: isFirst ? 0 : -10, scale: isFirst ? 1 : 0.8,
      });
      const tl = gsap.timeline();
      if (!isFirst) tl.to(card, { opacity: 1, rotateX: 0, scale: 1, duration: 1, ease: "power1.out" });
      if (!isLast) tl.to(card, { opacity: 0, rotateX: -10, scale: 0.8, duration: 1, ease: "power1.in" });

      let start = naturalRects[i].top - offset;
      let end = naturalRects[i].bottom - offset;
      if (isLast) {
        end = Math.min(end, maxScroll);
        start = Math.min(start, end - 260);
      }

      cardStackTriggers.push(ScrollTrigger.create({
        trigger: card,
        start,
        end,
        scrub: true,
        animation: tl,
      }));
    });
  }

  function initChrome() {
    applyLangClass();
    document.querySelectorAll(".lang-toggle button").forEach(btn => {
      btn.addEventListener("click", () => setLang(btn.dataset.lang));
    });
    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav__links a").forEach(a => {
      const href = a.getAttribute("href");
      a.classList.toggle("is-active", href === path);
    });
    syncHeaderHeight();
    window.addEventListener("resize", syncHeaderHeight);
  }

  return { getLang, setLang, onRender, loadContent, t, initChrome, buildCarousel, wireCarousels, wireAccordions, esc, safeUrl, parseBriefSections, wireBriefToggles, syncHeaderHeight, wireReveal, wireCardStack };
})();

document.addEventListener("DOMContentLoaded", () => LANHMAR.initChrome());

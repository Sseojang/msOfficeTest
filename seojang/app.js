(() => {
  "use strict";

  const app = document.getElementById("solution-app");
  const examData = window.COMHWA_EXAM_DATA;
  const STORE_PREFIX = "comhwa-2026-subject-v1:";
  const LABELS = ["①", "②", "③", "④"];
  let activeRound = 0;
  let activeSubject = 0;
  let filter = "all";
  let directQuestion = null;

  if (!examData || !Array.isArray(examData.rounds)) {
    app.innerHTML = `<section class="loading-state"><p>정답 데이터를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p></section>`;
    return;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function displayText(value) {
    return escapeHtml(value)
      .replace(/\bALT\b/gi, "Alt")
      .replace(/\bCTRL\b/gi, "Ctrl")
      .replace(/\bENTER\b/gi, "Enter")
      .replace(/\bTAB\b/gi, "Tab")
      .replace(/\b(Alt|Ctrl|Shift|Enter|Tab|Esc|F\d+)\s*\+\s*/g, "$1 + ")
      .replace(/윈도우\s*(?:로고\s*)?키/g, "Windows 키");
  }

  function needsSourceImage(question) {
    return question.requiresImage === true;
  }

  function sourceImages(question) {
    if (Array.isArray(question.images) && question.images.length) return question.images;
    return question.image ? [question.image] : [];
  }

  function optionList(question) {
    return `<ol class="answer-options">${question.options.map((option, index) =>
      `<li class="${index === question.answer ? "correct" : ""}"><span>${LABELS[index]}</span><p>${displayText(option)}</p></li>`
    ).join("")}</ol>`;
  }

  function round() { return examData.rounds[activeRound]; }
  function subject() { return round().subjects[activeSubject]; }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(`${STORE_PREFIX}${round().id}:${subject().id}`)) || null;
    } catch (_) {
      return null;
    }
  }

  function questionId(question) {
    return `${round().id}-${subject().id}-q${String(question.number).padStart(2, "0")}`;
  }

  function filteredQuestions() {
    if (filter === "all") return subject().questions;
    const session = getSession();
    if (!session || !session.submitted || !Array.isArray(session.answers)) return [];
    return subject().questions.filter((question, index) => session.answers[index] !== question.answer);
  }

  function render() {
    const session = getSession();
    const questions = filteredQuestions();
    const totalQuestions = examData.rounds.reduce((roundSum, item) =>
      roundSum + item.subjects.reduce((subjectSum, current) => subjectSum + current.questions.length, 0), 0);
    const score = session?.submitted
      ? subject().questions.reduce((sum, question, index) => sum + (session.answers[index] === question.answer ? 1 : 0), 0) * 5
      : null;

    app.innerHTML = `
      <section class="solution-hero">
        <div>
          <p class="eyebrow">Answer & Explanation</p>
          <h1>정답을 넘어,<br>이유까지 확실하게.</h1>
          <p>회차와 과목을 선택하면 원문 문제, 정답 보기, 상세 해설을 한 자리에서 확인할 수 있습니다.</p>
        </div>
        <div class="solution-count"><strong>${totalQuestions}</strong><span>전체 해설 문항</span></div>
      </section>

      <nav class="solution-toolbar" aria-label="정답 및 해설 범위 선택">
        <div class="toolbar-row">
          <div class="segmented" aria-label="회차">
            ${examData.rounds.map((item, index) => `<button class="segment-button ${index === activeRound ? "active" : ""}" type="button" data-action="round" data-round="${index}">${String(item.number).padStart(2, "0")}회</button>`).join("")}
          </div>
          <div class="filter-controls">
            <button class="filter-button ${filter === "all" ? "active" : ""}" type="button" data-action="filter" data-filter="all">전체 해설</button>
            <button class="filter-button ${filter === "wrong" ? "active" : ""}" type="button" data-action="filter" data-filter="wrong">내 오답만</button>
          </div>
        </div>
        <div class="segmented subject-row" aria-label="과목">
          ${round().subjects.map((item, index) => `<button class="segment-button ${index === activeSubject ? "active" : ""}" type="button" data-action="subject" data-subject="${index}">${escapeHtml(item.label)} · ${escapeHtml(item.name)}</button>`).join("")}
        </div>
      </nav>

      <section class="solution-summary">
        <div>
          <h2>${escapeHtml(round().title)} · ${escapeHtml(subject().name)}</h2>
          <p>${filter === "all" ? "20문항 전체 정답 및 상세 해설" : "제출한 답안 중 틀렸거나 답하지 않은 문항"}</p>
        </div>
        <span class="summary-score">${score === null ? "아직 채점 기록이 없습니다" : `내 점수 ${score}점`}</span>
      </section>

      <div class="answer-list">
        ${questions.length ? questions.map(question => {
          const id = questionId(question);
          const sourceImage = needsSourceImage(question);
          const showOptionText = !sourceImage || question.imageHasOptions === false || question.sourceSide === "right";
          const correctOption = question.options[question.answer] || `${question.answer + 1}번`;
          return `<article class="answer-card ${directQuestion === question.number ? "highlight" : ""}" id="${id}">
            <header class="answer-head">
              <div class="answer-number"><strong>Q${String(question.number).padStart(2, "0")}</strong><span>${escapeHtml(subject().label)} · 원문 ${question.sourcePage}쪽</span></div>
              <div class="correct-pill"><b>${LABELS[question.answer]}</b><span>정답</span></div>
            </header>
            <div class="answer-content">
              <div class="answer-question">
                <div class="answer-stem"><span>${String(question.number).padStart(2, "0")}</span><p>${displayText(question.stem)}</p></div>
                ${sourceImage ? `<div class="answer-source-images">${sourceImages(question).map((image, imageIndex) =>
                  `<div class="source-image-item">${question.imageLabels?.[imageIndex] ? `<strong class="source-image-label">${escapeHtml(question.imageLabels[imageIndex])}</strong>` : ""}<img src="../${escapeHtml(image)}" alt="${escapeHtml(question.stem)}${sourceImages(question).length > 1 ? ` 자료 ${imageIndex + 1}` : ""}" loading="lazy"></div>`
                ).join("")}</div><div class="source-caption">표·그림 확인용 PDF 원문</div>` : ""}
                ${showOptionText ? optionList(question) : ""}
              </div>
              <div class="answer-explanation">
                <h3>Why this answer?</h3>
                <p>${displayText(question.explanation)}</p>
                <div class="correct-option"><strong>${LABELS[question.answer]} ${displayText(correctOption)}</strong></div>
              </div>
            </div>
          </article>`;
        }).join("") : `<div class="empty-solutions"><strong>표시할 오답이 없습니다.</strong><span>${session?.submitted ? "이 과목을 모두 맞혔습니다." : "먼저 문제를 풀고 답안을 제출해 주세요."}</span></div>`}
      </div>
      <a class="back-to-top" href="#main" aria-label="맨 위로">↑</a>`;

    if (directQuestion !== null) {
      requestAnimationFrame(() => document.getElementById(questionId({ number: directQuestion }))?.scrollIntoView({ block: "start" }));
      directQuestion = null;
    }
  }

  function updateHash() {
    history.replaceState(null, "", `#${round().id}-${subject().id}`);
  }

  app.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "round") {
      activeRound = Number(target.dataset.round);
      activeSubject = 0;
      filter = "all";
      updateHash();
      render();
    }
    if (action === "subject") {
      activeSubject = Number(target.dataset.subject);
      filter = "all";
      updateHash();
      render();
    }
    if (action === "filter") {
      filter = target.dataset.filter;
      render();
    }
  });

  function restoreRoute() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    const match = hash.match(/^(round-\d{2})-(computer|spreadsheet|database)(?:-q(\d{2}))?$/);
    if (!match) return;
    const roundIndex = examData.rounds.findIndex(item => item.id === match[1]);
    if (roundIndex < 0) return;
    activeRound = roundIndex;
    const subjectIndex = round().subjects.findIndex(item => item.id === match[2]);
    if (subjectIndex >= 0) activeSubject = subjectIndex;
    if (match[3]) directQuestion = Number(match[3]);
  }

  restoreRoute();
  render();
})();

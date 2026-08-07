(() => {
  "use strict";

  const app = document.getElementById("app");
  const examData = window.COMHWA_EXAM_DATA;
  const STORE_PREFIX = "comhwa-2026-subject-v1:";
  const CHOICE_LABELS = ["①", "②", "③", "④"];
  const SUBJECT_STYLES = [
    { color: "#0f8fb8", soft: "#e2f6fb" },
    { color: "#7858c7", soft: "#f0ebff" },
    { color: "#e16a3c", soft: "#fff0e9" },
  ];

  let view = "home";
  let activeRound = 0;
  let activeSubject = 0;
  let timerId = null;

  if (!examData || !Array.isArray(examData.rounds)) {
    app.innerHTML = `<section class="loading-state"><p>문제 데이터를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p></section>`;
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
      .replace(/윈도우\s*(?:로고\s*)?키/g, "Windows 키");
  }

  function needsSourceImage(question) {
    return question.requiresImage === true;
  }

  function sessionKey(roundIndex = activeRound, subjectIndex = activeSubject) {
    const round = examData.rounds[roundIndex];
    const subject = round.subjects[subjectIndex];
    return `${STORE_PREFIX}${round.id}:${subject.id}`;
  }

  function emptySession() {
    return { answers: Array(20).fill(null), current: 0, submitted: false, startedAt: null };
  }

  function getSession(roundIndex = activeRound, subjectIndex = activeSubject) {
    try {
      const parsed = JSON.parse(localStorage.getItem(sessionKey(roundIndex, subjectIndex)));
      if (parsed && Array.isArray(parsed.answers) && parsed.answers.length === 20) {
        return {
          answers: parsed.answers.map(value => Number.isInteger(value) && value >= 0 && value < 4 ? value : null),
          current: Math.max(0, Math.min(19, Number(parsed.current) || 0)),
          submitted: Boolean(parsed.submitted),
          startedAt: Number(parsed.startedAt) || null,
        };
      }
    } catch (_) {}
    return emptySession();
  }

  function saveSession(session) {
    localStorage.setItem(sessionKey(), JSON.stringify(session));
  }

  function currentRound() { return examData.rounds[activeRound]; }
  function currentSubject() { return currentRound().subjects[activeSubject]; }
  function currentQuestions() { return currentSubject().questions; }

  function sessionScore(session, questions = currentQuestions()) {
    const correct = questions.reduce((total, question, index) => total + (session.answers[index] === question.answer ? 1 : 0), 0);
    return { correct, score: correct * 5 };
  }

  function subjectProgress(roundIndex, subjectIndex) {
    const session = getSession(roundIndex, subjectIndex);
    const answered = session.answers.filter(Number.isInteger).length;
    const questions = examData.rounds[roundIndex].subjects[subjectIndex].questions;
    return { session, answered, ...sessionScore(session, questions) };
  }

  function clearTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function setHash(value) {
    history.replaceState(null, "", value ? `#${value}` : location.pathname);
  }

  function goHome() {
    clearTimer();
    view = "home";
    setHash("");
    render();
  }

  function openRound(roundIndex) {
    clearTimer();
    activeRound = roundIndex;
    view = "round";
    setHash(currentRound().id);
    render();
  }

  function startSubject(subjectIndex) {
    activeSubject = subjectIndex;
    const session = getSession();
    if (!session.startedAt && !session.submitted) {
      session.startedAt = Date.now();
      saveSession(session);
    }
    view = session.submitted ? "results" : "exam";
    setHash(`${currentRound().id}/${currentSubject().id}`);
    render();
  }

  function renderHome() {
    const completedSubjects = examData.rounds.reduce((sum, round, roundIndex) =>
      sum + round.subjects.filter((_, subjectIndex) => getSession(roundIndex, subjectIndex).submitted).length, 0);

    app.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">2026 Computer Literacy Level 1</p>
          <h1>회차는 실전처럼,<br><span>과목은 집중해서.</span></h1>
          <p class="hero-description">5회분 300문제를 1·2·3과목으로 나눠 연습하세요. 원문 표와 그림을 그대로 보며 풀고, 과목별 점수를 즉시 확인할 수 있습니다.</p>
        </div>
        <div class="hero-stats" aria-label="문제 구성">
          <div class="hero-stat"><strong>5</strong><span>실전 모의고사</span></div>
          <div class="hero-stat"><strong>300</strong><span>전체 문항</span></div>
          <div class="hero-rule"><span class="rule-icon">✓</span><span>합격 기준 · 과목별 40점 이상, 전 과목 평균 60점 이상</span></div>
        </div>
      </section>

      <section class="section-block" aria-labelledby="round-heading">
        <div class="section-heading">
          <div>
            <h2 id="round-heading">실전 모의고사 선택</h2>
            <p>회차를 고른 뒤 원하는 과목만 따로 시작할 수 있습니다.</p>
          </div>
          <span class="completion-summary">완료 ${completedSubjects} / 15과목</span>
        </div>
        <div class="round-grid">
          ${examData.rounds.map((round, roundIndex) => {
            const states = round.subjects.map((_, subjectIndex) => subjectProgress(roundIndex, subjectIndex));
            const done = states.filter(item => item.session.submitted).length;
            const answered = states.reduce((sum, item) => sum + item.answered, 0);
            const progress = Math.round((answered / 60) * 100);
            return `<button class="round-card" type="button" data-action="round" data-round="${roundIndex}" aria-label="${round.number}회 모의고사, ${done}과목 완료">
              <span class="round-watermark" aria-hidden="true">${round.number}</span>
              <span class="round-index">PRACTICE SET</span>
              <span class="round-number">${String(round.number).padStart(2, "0")}<small>회</small></span>
              <span class="round-meta">3과목 · 60문항</span>
              <span class="round-progress"><span style="width:${progress}%"></span></span>
              <span class="round-state"><span>${done ? `${done}/3과목 완료` : answered ? `${answered}문항 풀이 중` : "시작 전"}</span><span class="round-arrow">→</span></span>
            </button>`;
          }).join("")}
        </div>
      </section>

      <section class="ox-bank-banner" aria-labelledby="ox-bank-heading">
        <div class="ox-bank-copy">
          <span class="ox-bank-kicker">NEW · SPACED REPETITION</span>
          <h2 id="ox-bank-heading">틀린 문장은 맞을 때까지.<br>OX 반복 문제은행 100제</h2>
          <p>O 50 · X 50 · 오답 정정 문장 · 당일/1일/3일/7일 복습 · 3회 연속 정답 졸업</p>
        </div>
        <div class="ox-bank-stats" aria-label="OX 문제은행 구성">
          <span><strong>33</strong> 컴퓨터 일반</span>
          <span><strong>34</strong> 스프레드시트</span>
          <span><strong>33</strong> 데이터베이스</span>
          <a href="ox/">OX 문제은행 시작 →</a>
        </div>
      </section>`;
  }

  function renderRound() {
    const round = currentRound();
    app.innerHTML = `
      <button class="back-button" type="button" data-action="home">← 전체 회차</button>
      <section class="round-hero">
        <div>
          <p class="eyebrow">Select a subject</p>
          <h1>${escapeHtml(round.title)}</h1>
          <p>각 과목은 20문항이며 제한 시간은 20분입니다.</p>
        </div>
        <span class="round-chip">과목을 따로 선택해 집중 연습</span>
      </section>
      <section class="subject-grid" aria-label="과목 선택">
        ${round.subjects.map((subject, subjectIndex) => {
          const style = SUBJECT_STYLES[subjectIndex];
          const progress = subjectProgress(activeRound, subjectIndex);
          const status = progress.session.submitted ? "채점 완료" : progress.answered ? `${progress.answered}/20 풀이 중` : "시작 전";
          const action = progress.session.submitted ? "결과 다시 보기" : progress.answered ? "이어 풀기" : "시험 시작";
          return `<article class="subject-card" data-number="${subjectIndex + 1}" style="--subject-color:${style.color};--subject-soft:${style.soft}">
            <div class="subject-top"><span class="subject-label">${escapeHtml(subject.label)}</span><span class="subject-status">${status}</span></div>
            <h2>${escapeHtml(subject.name)}</h2>
            <p>${subject.range}번 · 객관식 20문항</p>
            ${progress.session.submitted ? `<div class="subject-score">${progress.score}점</div>` : ""}
            <button class="subject-action" type="button" data-action="subject" data-subject="${subjectIndex}"><span>${action}</span><span>→</span></button>
          </article>`;
        }).join("")}
      </section>`;
  }

  function solutionLink(question) {
    return `seojang/#${currentRound().id}-${currentSubject().id}-q${String(question.number).padStart(2, "0")}`;
  }

  function renderExam() {
    const session = getSession();
    const questions = currentQuestions();
    const question = questions[session.current];
    const sourceImage = needsSourceImage(question);
    const compactChoices = sourceImage && question.imageHasOptions !== false && question.sourceSide !== "right";
    const answered = session.answers.filter(Number.isInteger).length;
    const subject = currentSubject();
    const round = currentRound();

    app.innerHTML = `
      <button class="back-button" type="button" data-action="round-back">← ${round.number}회 과목 선택</button>
      <div class="exam-layout">
        <aside class="exam-sidebar" aria-label="문제 이동">
          <span class="exam-kicker">${escapeHtml(round.title)}</span>
          <h1>${escapeHtml(subject.name)}</h1>
          <div class="exam-sidebar-sub">${subject.range}번 · 20문항</div>
          <div class="timer" id="timer"><span>연습 타이머</span><strong id="timer-value">20:00</strong></div>
          <div class="question-map">
            ${questions.map((item, index) => {
              const selected = session.answers[index];
              const resultClass = session.submitted ? (selected === item.answer ? "correct" : "wrong") : (Number.isInteger(selected) ? "answered" : "");
              return `<button class="map-button ${resultClass} ${index === session.current ? "current" : ""}" type="button" data-action="question" data-question="${index}" aria-label="${index + 1}번 문제${Number.isInteger(selected) ? ", 답안 선택됨" : ""}">${index + 1}</button>`;
            }).join("")}
          </div>
          <div class="sidebar-progress">
            <div class="sidebar-progress-line"><span>${session.submitted ? "채점 완료" : "답안 작성"}</span><span>${answered}/20</span></div>
            <div class="mini-progress"><span style="width:${answered * 5}%"></span></div>
          </div>
          <a class="sidebar-link" href="${solutionLink(question)}">이 문제 해설 보기 ↗</a>
        </aside>

        <section class="exam-main">
          <div class="exam-toolbar">
            <div class="breadcrumb">${round.number}회 <span aria-hidden="true">/</span> <strong>${escapeHtml(subject.name)}</strong></div>
            ${session.submitted ? `<button class="toolbar-button" type="button" data-action="results">채점 결과로</button>` : `<button class="toolbar-button" type="button" data-action="round-back">저장하고 나가기</button>`}
          </div>
          <article class="question-card">
            <header class="question-card-head">
              <div class="question-count"><strong>Q${String(session.current + 1).padStart(2, "0")}</strong><span>/ 20</span></div>
              <span class="question-topic">원문 ${question.number}번</span>
            </header>
            <section class="question-text-source ${sourceImage ? "has-visual" : ""}">
              <h2><span class="question-original-number">${String(question.number).padStart(2, "0")}</span><span>${displayText(question.stem)}</span></h2>
            </section>
            ${sourceImage ? `<figure class="question-source">
              <img src="${escapeHtml(question.image)}" alt="${escapeHtml(question.stem)}" data-fallback="${escapeHtml(question.stem)}">
              <figcaption>표·그림 확인용 PDF 원문 · 문제는 위에 텍스트로 제공</figcaption>
            </figure>` : ""}
            <div class="choice-panel">
              <p class="choice-guide">${compactChoices ? "원문 보기를 확인하고 정답 번호를 선택하세요." : "정답이라고 생각하는 보기를 선택하세요."}</p>
              <div class="choices ${compactChoices ? "compact" : ""}">
                ${question.options.map((option, optionIndex) => {
                  const selected = session.answers[session.current] === optionIndex;
                  let resultClass = selected ? "selected" : "";
                  if (session.submitted && optionIndex === question.answer) resultClass = "correct";
                  if (session.submitted && selected && optionIndex !== question.answer) resultClass = "wrong";
                  return `<button class="choice-button ${resultClass}" type="button" data-action="choice" data-choice="${optionIndex}" ${session.submitted ? "disabled" : ""} aria-pressed="${selected}" aria-label="${CHOICE_LABELS[optionIndex]} ${escapeHtml(option)}">
                    <span class="choice-index">${CHOICE_LABELS[optionIndex]}</span>
                    ${compactChoices ? "" : `<span class="choice-text">${displayText(option)}</span>`}
                  </button>`;
                }).join("")}
              </div>
              ${session.submitted ? `<div class="review-note"><span>${session.answers[session.current] === question.answer ? "정답입니다." : `정답은 ${CHOICE_LABELS[question.answer]}번입니다.`}</span><a href="${solutionLink(question)}">상세 해설 보기 →</a></div>` : ""}
            </div>
          </article>
          <div class="exam-actions">
            <button class="action-button" type="button" data-action="previous" ${session.current === 0 ? "disabled" : ""}>← 이전 문제</button>
            ${session.submitted ? `<button class="action-button action-submit" type="button" data-action="results">채점 결과 보기</button>` : `<button class="action-button action-submit" type="button" data-action="submit">답안 제출 · ${answered}/20</button>`}
            <button class="action-button action-primary" type="button" data-action="next" ${session.current === 19 ? "disabled" : ""}>다음 문제 →</button>
          </div>
        </section>
      </div>
      <dialog id="submit-dialog">
        <div class="dialog-body">
          <span class="dialog-icon">!</span>
          <h2>답안을 제출할까요?</h2>
          <p>${20 - answered ? `아직 답하지 않은 문제가 ${20 - answered}개 있습니다. ` : ""}제출하면 답안을 수정할 수 없습니다.</p>
          <div class="dialog-actions">
            <button class="action-button" type="button" data-action="cancel-submit">계속 풀기</button>
            <button class="action-button action-submit" type="button" data-action="confirm-submit">제출하고 채점</button>
          </div>
        </div>
      </dialog>`;

    const image = app.querySelector(".question-source img");
    image?.addEventListener("error", () => {
      const replacement = document.createElement("div");
      replacement.className = "image-fallback";
      replacement.textContent = image.dataset.fallback;
      image.replaceWith(replacement);
    }, { once: true });
    startTimer(session);
  }

  function startTimer(session) {
    clearTimer();
    if (session.submitted || !session.startedAt) return;
    const update = () => {
      const timer = document.getElementById("timer");
      const value = document.getElementById("timer-value");
      if (!timer || !value) return;
      const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
      const remaining = Math.max(0, 20 * 60 - elapsed);
      value.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
      timer.classList.toggle("expired", remaining === 0);
      if (remaining === 0) value.textContent = "시간 종료";
    };
    update();
    timerId = window.setInterval(update, 1000);
  }

  function renderResults() {
    clearTimer();
    const session = getSession();
    const questions = currentQuestions();
    const { correct, score } = sessionScore(session);
    const pass = score >= 40;
    const answered = session.answers.filter(Number.isInteger).length;
    const round = currentRound();
    const subject = currentSubject();

    app.innerHTML = `
      <button class="back-button" type="button" data-action="round-back">← ${round.number}회 과목 선택</button>
      <section class="result-hero">
        <div class="score-ring" style="--score:${score}"><div class="score-value"><strong>${score}</strong><span>100점 만점</span></div></div>
        <div class="result-copy">
          <p class="eyebrow">${escapeHtml(round.title)} · ${escapeHtml(subject.label)}</p>
          <h1>${pass ? "과목 합격 기준을 넘었어요." : "조금만 더 다듬으면 돼요."}</h1>
          <p>${escapeHtml(subject.name)} 20문항 채점 결과입니다.</p>
          <div class="result-badges">
            <span class="result-badge ${pass ? "pass" : "fail"}">${pass ? "과목 합격" : "40점 미만"}</span>
            <span class="result-badge">정답 ${correct}개</span>
            <span class="result-badge">오답 ${answered - correct}개</span>
            ${answered < 20 ? `<span class="result-badge">미응답 ${20 - answered}개</span>` : ""}
          </div>
          <div class="result-actions">
            <button class="bright" type="button" data-action="review-wrong">오답 다시 보기</button>
            <a href="seojang/#${round.id}-${subject.id}">정답·해설 열기 ↗</a>
            <button type="button" data-action="restart">처음부터 다시</button>
          </div>
        </div>
      </section>
      <section class="review-section" aria-labelledby="review-title">
        <div class="section-heading">
          <div><h2 id="review-title">문항별 결과</h2><p>문제를 다시 열거나 상세 해설로 이동할 수 있습니다.</p></div>
        </div>
        <div class="review-grid">
          ${questions.map((question, index) => {
            const selected = session.answers[index];
            const isCorrect = selected === question.answer;
            const cls = !Number.isInteger(selected) ? "unanswered" : isCorrect ? "" : "wrong";
            return `<article class="review-item ${cls}">
              <span class="review-number">${index + 1}</span>
              <div><div class="review-title">${escapeHtml(question.stem)}</div><div class="review-answer">내 답 ${Number.isInteger(selected) ? CHOICE_LABELS[selected] : "미응답"} · 정답 ${CHOICE_LABELS[question.answer]}</div></div>
              <button class="review-open" type="button" data-action="review" data-question="${index}">문제 보기</button>
            </article>`;
          }).join("")}
        </div>
      </section>`;
  }

  function render() {
    clearTimer();
    if (view === "home") renderHome();
    if (view === "round") renderRound();
    if (view === "exam") renderExam();
    if (view === "results") renderResults();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function updateSelection(choice) {
    const session = getSession();
    if (session.submitted) return;
    session.answers[session.current] = choice;
    saveSession(session);
    app.querySelectorAll(".choice-button").forEach((button, index) => {
      button.classList.toggle("selected", index === choice);
      button.setAttribute("aria-pressed", index === choice ? "true" : "false");
    });
    const mapButton = app.querySelector(`.map-button[data-question="${session.current}"]`);
    mapButton?.classList.add("answered");
    const answered = session.answers.filter(Number.isInteger).length;
    const progressText = app.querySelector(".sidebar-progress-line span:last-child");
    const progressBar = app.querySelector(".mini-progress span");
    const submitButton = app.querySelector('[data-action="submit"]');
    if (progressText) progressText.textContent = `${answered}/20`;
    if (progressBar) progressBar.style.width = `${answered * 5}%`;
    if (submitButton) submitButton.textContent = `답안 제출 · ${answered}/20`;
  }

  function goQuestion(index) {
    const session = getSession();
    session.current = Math.max(0, Math.min(19, index));
    saveSession(session);
    renderExam();
    app.querySelector(".question-card")?.focus?.();
  }

  app.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "home") goHome();
    if (action === "round") openRound(Number(target.dataset.round));
    if (action === "round-back") openRound(activeRound);
    if (action === "subject") startSubject(Number(target.dataset.subject));
    if (action === "question") goQuestion(Number(target.dataset.question));
    if (action === "choice") updateSelection(Number(target.dataset.choice));
    if (action === "previous") goQuestion(getSession().current - 1);
    if (action === "next") goQuestion(getSession().current + 1);
    if (action === "submit") document.getElementById("submit-dialog")?.showModal();
    if (action === "cancel-submit") document.getElementById("submit-dialog")?.close();
    if (action === "confirm-submit") {
      const session = getSession();
      session.submitted = true;
      saveSession(session);
      view = "results";
      render();
    }
    if (action === "results") { view = "results"; render(); }
    if (action === "review") {
      const session = getSession();
      session.current = Number(target.dataset.question);
      saveSession(session);
      view = "exam";
      render();
    }
    if (action === "review-wrong") {
      const session = getSession();
      const firstWrong = currentQuestions().findIndex((question, index) => session.answers[index] !== question.answer);
      session.current = firstWrong >= 0 ? firstWrong : 0;
      saveSession(session);
      view = "exam";
      render();
    }
    if (action === "restart") {
      if (!window.confirm("이 과목의 기존 답안과 점수를 지우고 다시 시작할까요?")) return;
      const session = emptySession();
      session.startedAt = Date.now();
      saveSession(session);
      view = "exam";
      render();
    }
  });

  document.addEventListener("keydown", event => {
    if (view !== "exam" || event.target.closest("dialog")) return;
    if (["1", "2", "3", "4"].includes(event.key) && !getSession().submitted) updateSelection(Number(event.key) - 1);
    if (event.key === "ArrowLeft" && getSession().current > 0) goQuestion(getSession().current - 1);
    if (event.key === "ArrowRight" && getSession().current < 19) goQuestion(getSession().current + 1);
  });

  function restoreRoute() {
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return;
    const [roundId, subjectId] = hash.split("/");
    const roundIndex = examData.rounds.findIndex(round => round.id === roundId);
    if (roundIndex < 0) return;
    activeRound = roundIndex;
    if (!subjectId) { view = "round"; return; }
    const subjectIndex = currentRound().subjects.findIndex(subject => subject.id === subjectId);
    if (subjectIndex < 0) { view = "round"; return; }
    activeSubject = subjectIndex;
    view = getSession().submitted ? "results" : "exam";
  }

  restoreRoute();
  render();
})();

(() => {
  "use strict";

  const app = document.getElementById("app");
  const data = window.COMHWA_OX_DATA;
  const STORE_KEY = "comhwa-ox-bank-v1";
  const DAY = 24 * 60 * 60 * 1000;
  let view = "home";
  let activeMode = null;
  let activeValue = null;
  let queue = [];
  let index = 0;
  let sessionResults = [];
  let answered = null;

  if (!data?.questions?.length) {
    app.innerHTML = `<section class="empty"><strong>문제 데이터를 불러오지 못했습니다.</strong><p>페이지를 새로고침해 주세요.</p></section>`;
    return;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (_) { return {}; }
  }

  function saveProgress(progress) { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); }

  function stateFor(question, progress = loadProgress()) {
    return { attempts: 0, correct: 0, wrong: 0, streak: 0, graduated: false, dueAt: 0, lastResult: null, ...(progress[question.id] || {}) };
  }

  function bankStats() {
    const progress = loadProgress();
    const now = Date.now();
    let attempted = 0, due = 0, wrong = 0, graduated = 0;
    data.questions.forEach(question => {
      const state = stateFor(question, progress);
      if (state.attempts) attempted += 1;
      if (!state.graduated && state.attempts && state.dueAt <= now) due += 1;
      if (state.lastResult === false) wrong += 1;
      if (state.graduated) graduated += 1;
    });
    return { attempted, due, wrong, graduated };
  }

  function weakest(items, limit = items.length) {
    const progress = loadProgress();
    return [...items].sort((a, b) => {
      const as = stateFor(a, progress), bs = stateFor(b, progress);
      return Number(as.graduated) - Number(bs.graduated) || as.streak - bs.streak || as.attempts - bs.attempts || a.number - b.number;
    }).slice(0, limit);
  }

  function shuffled(items) {
    return [...items].map(item => ({ item, key: Math.random() })).sort((a, b) => a.key - b.key).map(({ item }) => item);
  }

  function modeLabel(mode, value) {
    if (mode === "round") return `OX ${String(value).padStart(2, "0")}회`;
    if (mode === "subject") return data.subjects[value].name;
    if (mode === "wrong") return "이전 오답 5문제";
    if (mode === "due") return "오늘의 복습";
    return "혼합 20문제";
  }

  function buildQueue(mode, value) {
    const progress = loadProgress();
    const now = Date.now();
    if (mode === "round") return data.questions.filter(q => q.round === Number(value));
    if (mode === "subject") return weakest(data.questions.filter(q => q.subject === value), 20);
    if (mode === "wrong") return weakest(data.questions.filter(q => stateFor(q, progress).lastResult === false), 5);
    if (mode === "due") return weakest(data.questions.filter(q => { const s = stateFor(q, progress); return s.attempts && !s.graduated && s.dueAt <= now; }), 20);
    return shuffled(weakest(data.questions, 50)).slice(0, 20);
  }

  function start(mode, value = null) {
    activeMode = mode; activeValue = value; queue = buildQueue(mode, value); index = 0; sessionResults = []; answered = null;
    if (!queue.length) { view = "empty"; } else { view = "quiz"; }
    history.replaceState(null, "", `#${mode}${value !== null ? `-${value}` : ""}`);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goHome() { view = "home"; queue = []; answered = null; history.replaceState(null, "", location.pathname); render(); }

  function answerQuestion(choice) {
    if (answered !== null) return;
    const question = queue[index];
    const correct = choice === question.answer;
    const progress = loadProgress();
    const previous = stateFor(question, progress);
    const next = { ...previous, attempts: previous.attempts + 1, lastResult: correct, lastSeenAt: Date.now() };
    if (correct) {
      next.correct = previous.correct + 1;
      next.streak = previous.streak + 1;
      next.graduated = next.streak >= 3;
      next.dueAt = next.graduated ? 0 : Date.now() + (next.streak === 1 ? DAY : 3 * DAY);
    } else {
      next.wrong = previous.wrong + 1;
      next.streak = 0;
      next.graduated = false;
      next.dueAt = Date.now();
    }
    progress[question.id] = next;
    saveProgress(progress);
    answered = { choice, correct, state: next };
    sessionResults.push({ id: question.id, correct });
    renderQuiz();
  }

  function nextQuestion() {
    if (index >= queue.length - 1) { view = "result"; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    index += 1; answered = null; renderQuiz(); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderHome() {
    const stats = bankStats();
    app.innerHTML = `
      <section class="hero">
        <div class="hero-copy"><p class="eyebrow">Spaced repetition OX bank</p><h1>틀린 문장은,<br><span>맞을 때까지 다시.</span></h1><p>핵심 정의·함정·적용 100문제를 OX로 반복하세요. X 문장은 틀린 부분과 올바른 문장을 바로 확인할 수 있습니다.</p></div>
        <div class="hero-stats">
          <div class="hero-stat"><strong>100</strong><span>전체 OX</span></div>
          <div class="hero-stat"><strong>${stats.due}</strong><span>오늘 복습</span></div>
          <div class="hero-stat"><strong>${stats.graduated}</strong><span>졸업 문제</span></div>
          <div class="hero-progress"><div><span>전체 학습 진행</span><span>${stats.attempted}/100</span></div><span class="progress-track"><i style="width:${stats.attempted}%"></i></span></div>
        </div>
      </section>
      <section class="section"><div class="section-head"><div><h2>오늘의 학습 루틴</h2><p>오답 복습부터 시작하고 혼합 문제로 마무리하세요.</p></div><span>3회 연속 정답 시 졸업</span></div>
        <div class="study-grid">
          <button class="study-card" data-mode="wrong"><span class="icon">↺</span><strong>이전 오답 5문제</strong><p>수업 시작 전 직전에 틀린 문제를 먼저 다시 풀어요.</p><b>${stats.wrong}문제 대기 중 →</b></button>
          <button class="study-card" data-mode="due"><span class="icon">◷</span><strong>오늘의 복습</strong><p>당일 → 1일 → 3일 → 7일 복습 원칙으로 돌아온 문제입니다.</p><b>${stats.due}문제 복습 →</b></button>
          <button class="study-card" data-mode="mix"><span class="icon">≋</span><strong>혼합 20문제</strong><p>세 과목과 난이도를 섞어 만든 일일 마무리 세트입니다.</p><b>랜덤 시작 →</b></button>
          <button class="study-card" data-mode="round" data-value="1"><span class="icon">01</span><strong>첫 OX 회차</strong><p>10문제씩 짧게 풀며 문제은행 사용법을 익혀요.</p><b>OX 01회 시작 →</b></button>
        </div>
      </section>
      <section class="section"><div class="section-head"><div><h2>과목별 집중 20문제</h2><p>각 과목에서 졸업하지 못한 문제를 우선 출제합니다.</p></div><span>33 · 34 · 33문제</span></div><div class="subject-grid">
        ${Object.entries(data.subjects).map(([id, subject], subjectIndex) => { const attempted = data.questions.filter(q => q.subject === id && stateFor(q).attempts).length; return `<article class="subject-card" data-no="${subjectIndex + 1}"><small>${subject.label}</small><h3>${subject.name}</h3><p>${attempted}/${subject.target}문제 학습 · 취약 문제 우선</p><button data-mode="subject" data-value="${id}"><span>과목 집중 시작</span><span>→</span></button></article>`; }).join("")}
      </div></section>
      <section class="section"><div class="section-head"><div><h2>OX 문제은행 회차</h2><p>10문제씩 10회로 나누어 반복 학습할 수 있습니다.</p></div><span>O 50 · X 50</span></div><div class="round-grid">
        ${Array.from({ length: 10 }, (_, roundIndex) => { const items = data.questions.filter(q => q.round === roundIndex + 1); const done = items.filter(q => stateFor(q).attempts).length; return `<button class="round-card" data-mode="round" data-value="${roundIndex + 1}"><span class="round-no">OX PRACTICE SET</span><strong>${String(roundIndex + 1).padStart(2, "0")}</strong><p>3과목 혼합 · 10문제</p><span class="mini"><i style="width:${done * 10}%"></i></span><span><span>${done ? `${done}/10 학습` : "시작 전"}</span><span>→</span></span></button>`; }).join("")}
      </div></section>`;
  }

  function renderQuiz() {
    if (!queue.length) { view = "empty"; render(); return; }
    const question = queue[index];
    const selected = answered?.choice;
    const nextReview = answered ? (answered.state.graduated ? "3회 연속 정답 · 졸업 · 7일 뒤 최종 점검 권장" : answered.correct ? `${answered.state.streak === 1 ? "1일" : "3일"} 후 다시 출제` : "오늘 다시 복습") : "";
    app.innerHTML = `<button class="back" data-action="home">← OX 문제은행</button><div class="quiz-layout">
      <aside class="quiz-side"><small>REPEAT TRAINING</small><h1>${escapeHtml(modeLabel(activeMode, activeValue))}</h1><p>${queue.length}문제 · 정답 즉시 확인</p><div class="side-progress"><div><span>진행률</span><span>${index + 1}/${queue.length}</span></div><span class="progress-track"><i style="width:${((index + (answered ? 1 : 0)) / queue.length) * 100}%"></i></span></div><div class="dot-map">${queue.map((_, qIndex) => `<span class="dot ${qIndex < index || (qIndex === index && answered) ? "done" : ""} ${qIndex === index ? "current" : ""}">${qIndex + 1}</span>`).join("")}</div></aside>
      <section><article class="quiz-card"><header class="quiz-head"><div class="quiz-count"><strong>Q${String(index + 1).padStart(2, "0")}</strong><span>/ ${queue.length}</span></div><div class="meta-chips"><span class="chip core">핵심 ${String(question.core).padStart(3, "0")}</span><span class="chip">${escapeHtml(question.subjectName)}</span><span class="chip">난이도 ${question.difficulty}</span></div></header>
      <div class="statement"><span class="question-id">${escapeHtml(question.id)} · ${escapeHtml(question.topic)}</span><h2>${escapeHtml(question.statement)}</h2></div>
      <div class="ox-actions"><button class="ox-button o ${selected === true ? `selected ${answered.correct ? "correct" : "wrong"}` : ""} ${answered && question.answer === true ? "answer" : ""}" data-answer="true" ${answered ? "disabled" : ""}><strong>O</strong><span>맞는 문장</span></button><button class="ox-button x ${selected === false ? `selected ${answered.correct ? "correct" : "wrong"}` : ""} ${answered && question.answer === false ? "answer" : ""}" data-answer="false" ${answered ? "disabled" : ""}><strong>X</strong><span>틀린 문장</span></button></div>
      ${answered ? `<div class="feedback ${answered.correct ? "good" : "bad"}"><div class="feedback-top"><strong>${answered.correct ? "정답입니다." : `오답입니다. 정답은 ${question.answer ? "O" : "X"}입니다.`}</strong><span>${escapeHtml(question.trapType)}</span></div><p class="correction"><b>${question.answer ? "핵심 문장" : "X 문장 정정"}</b><br>${escapeHtml(question.correction)}</p><div class="next-row"><small>${nextReview}</small><button class="next-button" data-action="next">${index === queue.length - 1 ? "학습 결과 보기" : "다음 문제 →"}</button></div></div>` : ""}
      </article></section></div>`;
  }

  function renderResult() {
    const correct = sessionResults.filter(result => result.correct).length;
    const wrong = sessionResults.length - correct;
    const stats = bankStats();
    app.innerHTML = `<section class="result"><span class="result-mark">✓</span><h1>${escapeHtml(modeLabel(activeMode, activeValue))} 완료</h1><p>틀린 문제는 오늘의 복습 목록에 즉시 추가되었습니다.</p><div class="result-stats"><div class="result-stat"><strong>${correct}</strong><span>정답</span></div><div class="result-stat"><strong>${wrong}</strong><span>오답</span></div><div class="result-stat"><strong>${stats.graduated}</strong><span>누적 졸업</span></div></div><div class="result-actions">${wrong ? `<button data-mode="wrong">오답 5문제 복습</button>` : ""}<button data-action="restart">다시 풀기</button><button class="primary" data-action="home">문제은행 홈</button></div></section>`;
  }

  function renderEmpty() {
    app.innerHTML = `<button class="back" data-action="home">← OX 문제은행</button><section class="empty"><strong>지금 풀 문제가 없습니다.</strong><p>${activeMode === "due" ? "예정된 복습을 모두 마쳤습니다." : "먼저 회차나 혼합 문제를 풀어 학습 기록을 만들어 주세요."}</p><button data-action="home">다른 학습 선택</button></section>`;
  }

  function render() { if (view === "home") renderHome(); else if (view === "quiz") renderQuiz(); else if (view === "result") renderResult(); else renderEmpty(); }

  app.addEventListener("click", event => {
    const answerButton = event.target.closest("[data-answer]");
    if (answerButton) { answerQuestion(answerButton.dataset.answer === "true"); return; }
    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) { start(modeButton.dataset.mode, modeButton.dataset.value ?? null); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    if (actionButton.dataset.action === "home") goHome();
    if (actionButton.dataset.action === "next") nextQuestion();
    if (actionButton.dataset.action === "restart") start(activeMode, activeValue);
  });

  render();
})();

(() => {
  'use strict';
  const STORAGE_KEY = 'wordQuestBibleQuiz.v1';
  const TOTAL_QUESTIONS = 50;
  const TIME_PER_QUESTION = 60;
  const MODE_INFO = {
    1: { title: 'Little Lights', emoji: '🌱', ages: 'AGES 5–10' },
    2: { title: 'Faith Explorers', emoji: '🧭', ages: 'AGES 11–15' },
    3: { title: 'Word Masters', emoji: '🦁', ages: 'AGES 16–20' }
  };
  const LEVEL_TITLES = ['WARM-UP', 'GETTING STARTED', 'GROWING IN WISDOM', 'BIBLE DETECTIVE', 'FAITH BUILDER', 'DEEPER DISCOVERY', 'SCRIPTURE SEEKER', 'WISE WARRIOR', 'WORD SCHOLAR', 'MASTER CHALLENGE'];
  const BADGES = [
    { id: 'first', icon: '🌟', name: 'First Steps', detail: 'Complete your first quest', test: d => d.attempts.length >= 1 },
    { id: 'perfect', icon: '👑', name: 'Perfect Quest', detail: 'Score 50 out of 50', test: d => d.attempts.some(a => a.marks === 50) },
    { id: 'streak', icon: '🔥', name: 'On Fire', detail: 'Reach a streak of 10', test: d => d.attempts.some(a => a.bestStreak >= 10) },
    { id: 'champion', icon: '🏆', name: 'Word Warrior', detail: 'Score at least 40 out of 50', test: d => d.attempts.some(a => a.marks >= 40) },
    { id: 'explorer', icon: '📚', name: 'Book Explorer', detail: 'Answer questions from 10 Bible books', test: d => Object.keys(d.bookStats).filter(k => d.bookStats[k].seen > 0).length >= 10 },
    { id: 'regular', icon: '🗓️', name: 'Faithful Learner', detail: 'Complete 5 quests', test: d => d.attempts.length >= 5 },
    { id: 'quick', icon: '⚡', name: 'Quick Thinker', detail: 'Average 15 seconds per answer or less', test: d => d.attempts.some(a => a.avgSeconds <= 15) },
    { id: 'hundred', icon: '💎', name: 'Century Club', detail: 'Answer 100 questions across quests', test: d => d.totalAnswered >= 100 }
  ];
  const $ = id => document.getElementById(id);
  const safeDefault = () => ({ lastName: '', totalAnswered: 0, totalCorrect: 0, bestStreak: 0, bookStats: {}, attempts: [] });
  const loadData = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return safeDefault();
      return { ...safeDefault(), ...parsed, bookStats: parsed.bookStats || {}, attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [] };
    } catch (_) { return safeDefault(); }
  };
  let profile = loadData();
  let selectedMode = 1;
  let game = null;
  let timerId = null;
  let remainingSeconds = TIME_PER_QUESTION;
  let toastTimeout = null;
  let latestAttemptId = null;
  const viewIds = { home: 'homeView', quiz: 'quizView', results: 'resultsView', progress: 'progressView', leaderboard: 'leaderboardView' };

  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
    catch (_) { showToast('Browser storage is full or unavailable. Your current quest will still work.'); }
  }
  function showToast(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => node.classList.remove('show'), 2700);
  }
  function showView(name) {
    if (!viewIds[name]) return;
    if (name !== 'quiz' && game && !game.isFinished && viewIds[name] !== 'quizView' && $('quizView').classList.contains('active-view')) {
      const leave = window.confirm('Leave this quest? Your unfinished score will not be saved.');
      if (!leave) return;
      clearTimer();
      game = null;
    }
    Object.entries(viewIds).forEach(([key, id]) => $(id).classList.toggle('active-view', key === name));
    document.querySelectorAll('[data-view]').forEach(btn => btn.classList.toggle('active', btn.classList.contains('nav-link') && btn.dataset.view === name));
    if (name === 'home') renderHomeStats();
    if (name === 'progress') renderProgress();
    if (name === 'leaderboard') renderLeaderboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function shuffled(input) {
    const a = input.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function questionFromRow(row, level) {
    const originalOptions = row[1].split('|');
    const correctText = originalOptions[row[2]];
    const options = shuffled(originalOptions);
    return { prompt: row[0], options, correctIndex: options.indexOf(correctText), book: row[3], reference: row[4], explanation: row[5], level };
  }
  function buildQuestions(mode) {
    const bank = QUESTION_BANKS[mode];
    if (!Array.isArray(bank) || bank.length < TOTAL_QUESTIONS) throw new Error(`The ${MODE_INFO[mode].title} question bank must contain at least 50 questions.`);
    const questions = [];
    // Split the full bank into ten progressively harder stages. Select five unique
    // questions from each stage so every run contains 50 questions without repeats.
    for (let level = 1; level <= 10; level++) {
      const start = Math.floor((level - 1) * bank.length / 10);
      const end = Math.floor(level * bank.length / 10);
      const group = bank.slice(start, end);
      shuffled(group).slice(0, 5).forEach(row => questions.push(questionFromRow(row, level)));
    }
    return questions;
  }
  function selectMode(mode) {
    selectedMode = Number(mode) || 1;
    document.querySelectorAll('.mode-card').forEach(card => {
      const active = Number(card.dataset.mode) === selectedMode;
      card.classList.toggle('selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
  }
  function startGame(mode = selectedMode) {
    try {
      const playerName = ($('playerName').value || profile.lastName || '').trim().slice(0, 20) || 'Bible Explorer';
      profile.lastName = playerName;
      saveData();
      game = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: playerName,
        mode: Number(mode),
        questions: buildQuestions(Number(mode)),
        index: 0,
        points: 0,
        correct: 0,
        streak: 0,
        bestStreak: 0,
        lifelineUsed: false,
        answered: [],
        totalTime: 0,
        isFinished: false
      };
      latestAttemptId = null;
      $('quizModeLabel').textContent = `${MODE_INFO[game.mode].emoji} ${MODE_INFO[game.mode].title.toUpperCase()}`;
      $('topStreak').textContent = '0';
      $('topScore').textContent = '0';
      $('sideScore').textContent = '0';
      $('sideStreak').innerHTML = '0 <em>in a row</em>';
      $('sideCorrect').innerHTML = '0 <em>/ 50</em>';
      $('lifelineButton').disabled = false;
      $('lifelineNote').textContent = '💡 One 50:50 lifeline per quest';
      showView('quiz');
      startQuestion();
    } catch (error) {
      console.error(error);
      showToast('Something went wrong loading the questions. Please refresh the page.');
    }
  }
  function clearTimer() {
    if (timerId !== null) clearInterval(timerId);
    timerId = null;
  }
  function updateTimerVisual() {
    const timerCard = document.querySelector('.timer-card');
    const orbit = $('timerOrbit');
    $('timerNumber').textContent = remainingSeconds;
    orbit.style.setProperty('--timer-angle', `${(remainingSeconds / TIME_PER_QUESTION) * 360}deg`);
    timerCard.classList.toggle('low-time', remainingSeconds <= 10);
    $('timerMessage').textContent = remainingSeconds > 40 ? 'Take a breath. You’ve got this!' : remainingSeconds > 15 ? 'Think it through!' : remainingSeconds > 5 ? 'Trust what you know!' : 'Quick, choose wisely!';
  }
  function startQuestion() {
    clearTimer();
    const q = game.questions[game.index];
    remainingSeconds = TIME_PER_QUESTION;
    $('questionProgressText').textContent = `QUESTION ${game.index + 1} OF ${TOTAL_QUESTIONS}`;
    $('levelLabel').textContent = `LEVEL ${q.level} · ${LEVEL_TITLES[q.level - 1]}`;
    $('quizProgressFill').style.width = `${(game.index / TOTAL_QUESTIONS) * 100}%`;
    $('questionBook').textContent = q.book.toUpperCase();
    $('questionNumber').textContent = `QUESTION ${String(game.index + 1).padStart(2, '0')}`;
    $('questionText').textContent = q.prompt;
    $('questionFeedback').className = 'question-feedback hidden';
    $('nextButton').classList.add('hidden');
    $('nextButton').innerHTML = game.index === TOTAL_QUESTIONS - 1 ? 'See my results <span>→</span>' : 'Next question <span>→</span>';
    $('answersGrid').innerHTML = '';
    q.options.forEach((answer, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'answer-option';
      btn.dataset.answerIndex = String(i);
      const letter = document.createElement('span');
      letter.className = 'option-letter';
      letter.textContent = String.fromCharCode(65 + i);
      const text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = answer;
      btn.append(letter, text);
      btn.addEventListener('click', () => chooseAnswer(i, false));
      $('answersGrid').appendChild(btn);
    });
    updateTimerVisual();
    timerId = setInterval(() => {
      if (!game || game.isFinished || game.answered.length > game.index) return;
      remainingSeconds = Math.max(0, remainingSeconds - 1);
      updateTimerVisual();
      if (remainingSeconds <= 0) chooseAnswer(-1, true);
    }, 1000);
  }
  function chooseAnswer(selectedIndex, timedOut = false) {
    if (!game || game.isFinished || game.answered.length > game.index) return;
    clearTimer();
    const q = game.questions[game.index];
    const correct = selectedIndex === q.correctIndex;
    const elapsed = TIME_PER_QUESTION - remainingSeconds;
    let earned = 0;
    if (correct) {
      game.streak += 1;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      game.correct += 1;
      earned = 100 + q.level * 12 + remainingSeconds * 2 + game.streak * 10;
      game.points += earned;
    } else {
      game.streak = 0;
    }
    game.totalTime += elapsed;
    game.answered.push({ prompt: q.prompt, options: q.options.slice(), correctIndex: q.correctIndex, selectedIndex, wasCorrect: correct, timedOut, book: q.book, reference: q.reference, explanation: q.explanation, level: q.level, elapsed, pointsEarned: earned });

    document.querySelectorAll('.answer-option').forEach((btn, i) => {
      btn.disabled = true;
      btn.classList.remove('eliminated');
      if (i === q.correctIndex) btn.classList.add('correct');
      if (i === selectedIndex && !correct) btn.classList.add('wrong');
    });
    const feedback = $('questionFeedback');
    feedback.className = `question-feedback${correct ? '' : ' incorrect'}`;
    $('feedbackMark').textContent = correct ? '✓' : timedOut ? '⌛' : '×';
    $('feedbackTitle').textContent = correct ? `Correct! +${earned} XP` : timedOut ? 'Time’s up!' : 'Not quite — keep learning!';
    const correctText = q.options[q.correctIndex];
    $('feedbackText').textContent = correct ? q.explanation : `The correct answer is “${correctText}.” ${q.explanation}`;
    $('feedbackReference').textContent = `📖 ${q.reference.toUpperCase()}`;
    $('nextButton').classList.remove('hidden');
    $('lifelineNote').textContent = game.lifelineUsed ? '✨ Nice effort—keep going!' : '💡 Need help? Use your 50:50 lifeline';
    $('topStreak').textContent = game.streak;
    $('topScore').textContent = game.points.toLocaleString();
    $('sideScore').textContent = game.points.toLocaleString();
    $('sideStreak').innerHTML = `${game.streak} <em>in a row</em>`;
    $('sideCorrect').innerHTML = `${game.correct} <em>/ 50</em>`;
  }
  function useLifeline() {
    if (!game || game.isFinished || game.lifelineUsed || game.answered.length > game.index) return;
    const q = game.questions[game.index];
    const wrong = shuffled(q.options.map((_, i) => i).filter(i => i !== q.correctIndex)).slice(0, 2);
    wrong.forEach(i => {
      const btn = document.querySelector(`.answer-option[data-answer-index="${i}"]`);
      if (btn) { btn.classList.add('eliminated'); btn.disabled = true; }
    });
    game.lifelineUsed = true;
    $('lifelineButton').disabled = true;
    $('lifelineNote').textContent = '✨ 50:50 used — two wrong choices removed';
    showToast('50:50 activated. Two wrong answers removed!');
  }
  function rankFor(marks) {
    if (marks === 50) return { title: 'Bible Master', icon: '👑', subtitle: 'A perfect quest! Outstanding knowledge.' };
    if (marks >= 45) return { title: 'Crown of Wisdom', icon: '♛', subtitle: 'Incredible work—your Bible knowledge is shining.' };
    if (marks >= 40) return { title: 'Wisdom Champion', icon: '🏆', subtitle: 'Excellent progress across your Bible adventure.' };
    if (marks >= 30) return { title: 'Word Warrior', icon: '🦁', subtitle: 'Strong effort. Keep learning and keep growing.' };
    if (marks >= 20) return { title: 'Bible Explorer', icon: '🧭', subtitle: 'You are discovering more with every question.' };
    return { title: 'Scripture Starter', icon: '🌱', subtitle: 'Every great explorer begins with a first step.' };
  }
  function finishGame() {
    if (!game || game.isFinished) return;
    clearTimer();
    game.isFinished = true;
    $('quizProgressFill').style.width = '100%';
    const marks = game.correct;
    const rank = rankFor(marks);
    const attempt = {
      id: game.id,
      name: game.name,
      mode: game.mode,
      marks,
      points: game.points,
      accuracy: Math.round((marks / TOTAL_QUESTIONS) * 100),
      bestStreak: game.bestStreak,
      avgSeconds: Math.round(game.totalTime / TOTAL_QUESTIONS),
      rank: rank.title,
      date: new Date().toISOString()
    };
    latestAttemptId = attempt.id;
    profile.totalAnswered += game.answered.length;
    profile.totalCorrect += marks;
    profile.bestStreak = Math.max(profile.bestStreak, game.bestStreak);
    game.answered.forEach(a => {
      if (!profile.bookStats[a.book]) profile.bookStats[a.book] = { seen: 0, correct: 0 };
      profile.bookStats[a.book].seen += 1;
      if (a.wasCorrect) profile.bookStats[a.book].correct += 1;
    });
    profile.attempts.unshift(attempt);
    profile.attempts = profile.attempts.slice(0, 100);
    saveData();
    $('resultsHeading').textContent = marks >= 40 ? `Brilliant work, ${game.name}!` : `Quest complete, ${game.name}!`;
    $('resultsSubheading').textContent = `${rank.subtitle} You answered ${marks} of ${TOTAL_QUESTIONS} questions correctly in ${MODE_INFO[game.mode].title}.`;
    $('rankBadge').innerHTML = `<span>${rank.icon}</span><div><small>YOUR NEW RANK</small><strong>${rank.title.toUpperCase()}</strong></div>`;
    $('resultMarks').innerHTML = `${marks}<span>/50</span>`;
    $('resultAccuracy').textContent = `${attempt.accuracy}% accuracy`;
    $('resultPoints').textContent = game.points.toLocaleString();
    $('resultStreak').textContent = game.bestStreak;
    $('resultAverage').textContent = `${attempt.avgSeconds}s`;
    renderRunBooks(game.answered);
    renderBadges($('earnedBadges'), profile, true);
    const ranking = sortedAttempts();
    const localPosition = ranking.findIndex(a => a.id === latestAttemptId) + 1;
    $('localRank').textContent = localPosition > 0 ? `#${localPosition} of ${ranking.length}` : 'Saved!';
    $('answerReview').classList.add('hidden');
    $('toggleReviewButton').textContent = 'Review answers ↓';
    renderReview(game.answered);
    showView('results');
  }
  function percent(seen, correct) { return seen ? Math.round(correct / seen * 100) : 0; }
  function renderBookRow(book, stats) {
    const p = percent(stats.seen, stats.correct);
    const row = document.createElement('div');
    row.className = 'book-stat-row';
    const left = document.createElement('div');
    const top = document.createElement('div');
    top.className = 'book-stat-top';
    const name = document.createElement('span'); name.textContent = book;
    const sample = document.createElement('span'); sample.textContent = `${stats.correct}/${stats.seen} correct`;
    top.append(name, sample);
    const track = document.createElement('div'); track.className = 'book-stat-track';
    const fill = document.createElement('div'); fill.className = 'book-stat-fill'; fill.style.width = `${p}%`;
    track.appendChild(fill); left.append(top, track);
    const percentNode = document.createElement('div'); percentNode.className = 'book-stat-percent'; percentNode.textContent = `${p}%`;
    row.append(left, percentNode);
    return row;
  }
  function renderRunBooks(answers) {
    const container = $('resultBookStats');
    container.innerHTML = '';
    const stats = {};
    answers.forEach(a => {
      if (!stats[a.book]) stats[a.book] = { seen: 0, correct: 0 };
      stats[a.book].seen += 1;
      if (a.wasCorrect) stats[a.book].correct += 1;
    });
    const entries = Object.entries(stats).map(([book, s]) => ({ book, ...s, pct: percent(s.seen, s.correct) }));
    if (!entries.length) { container.innerHTML = '<p class="empty-book-stats">Your book insights will appear here after a quest.</p>'; return; }
    const strongest = entries.slice().sort((a, b) => (b.pct - a.pct) || (b.seen - a.seen)).slice(0, 5);
    const review = entries.slice().sort((a, b) => (a.pct - b.pct) || (b.seen - a.seen)).slice(0, 5);
    const addGroup = (title, list) => {
      const heading = document.createElement('div'); heading.className = 'book-group-heading';
      heading.style.cssText = 'font-size:9px;font-weight:800;letter-spacing:.1em;color:var(--muted);margin:4px 0 2px'; heading.textContent = title;
      container.appendChild(heading);
      list.forEach(item => container.appendChild(renderBookRow(item.book, item)));
    };
    addGroup('✨ BOOKS YOU SHINED IN', strongest);
    addGroup('🧭 BOOKS TO EXPLORE NEXT', review);
  }
  function renderAllBooks() {
    const container = $('allBookStats');
    const entries = Object.entries(profile.bookStats).filter(([, s]) => s.seen > 0).map(([book, s]) => ({ book, ...s, pct: percent(s.seen, s.correct) }));
    entries.sort((a, b) => (b.seen - a.seen) || (b.pct - a.pct));
    container.innerHTML = '';
    if (!entries.length) { container.innerHTML = '<div class="empty-state">📖 Your book insights are waiting.<br />Complete a quest to start building your Bible-book profile.</div>'; return; }
    entries.forEach(item => container.appendChild(renderBookRow(item.book, item)));
  }
  function renderBadges(container, data, resultMode = false) {
    container.innerHTML = '';
    BADGES.forEach(badge => {
      const unlocked = badge.test(data);
      const tile = document.createElement('div'); tile.className = `badge-tile${unlocked ? '' : ' locked'}`;
      const art = document.createElement('span'); art.className = 'badge-art'; art.textContent = badge.icon;
      const words = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = badge.name;
      const detail = document.createElement('small'); detail.textContent = unlocked ? (resultMode ? 'UNLOCKED' : 'Earned') : badge.detail;
      words.append(name, detail); tile.append(art, words); container.appendChild(tile);
    });
  }
  function renderReview(answers) {
    const container = $('answerReview');
    container.innerHTML = '';
    answers.forEach((a, i) => {
      const row = document.createElement('div'); row.className = 'review-item';
      const top = document.createElement('div'); top.className = 'review-item-top';
      const prompt = document.createElement('span'); prompt.textContent = `${String(i + 1).padStart(2, '0')}. ${a.prompt}`;
      const status = document.createElement('span'); status.className = `review-status ${a.wasCorrect ? 'ok' : 'no'}`; status.textContent = a.wasCorrect ? 'CORRECT' : 'REVIEW';
      top.append(prompt, status);
      const p = document.createElement('p');
      const chosen = a.selectedIndex >= 0 ? a.options[a.selectedIndex] : 'No answer (time ran out)';
      p.textContent = `Your answer: ${chosen}. Correct answer: ${a.options[a.correctIndex]}. ${a.explanation}`;
      const ref = document.createElement('small'); ref.textContent = `${a.book.toUpperCase()} · ${a.reference.toUpperCase()}`;
      row.append(top, p, ref); container.appendChild(row);
    });
  }
  function sortedAttempts() {
    return profile.attempts.slice().sort((a, b) => (b.points - a.points) || (b.marks - a.marks) || (new Date(b.date) - new Date(a.date)));
  }
  function renderHomeStats() {
    const best = profile.attempts.length ? Math.max(...profile.attempts.map(a => a.marks)) : 0;
    const nodes = [
      { label: 'BEST MARKS', value: profile.attempts.length ? `${best}/50` : '—' },
      { label: 'QUESTS PLAYED', value: profile.attempts.length },
      { label: 'BEST STREAK', value: profile.bestStreak ? `🔥 ${profile.bestStreak}` : '—' }
    ];
    $('homeStats').innerHTML = '';
    nodes.forEach(item => { const el = document.createElement('div'); el.className = 'home-stat'; el.innerHTML = `<small>${item.label}</small><strong>${item.value}</strong>`; $('homeStats').appendChild(el); });
    if (profile.lastName && !$('playerName').value) $('playerName').value = profile.lastName;
  }
  function renderProgress() {
    $('totalQuizzes').textContent = profile.attempts.length;
    $('totalAnswered').textContent = profile.totalAnswered.toLocaleString();
    $('totalAccuracy').textContent = profile.totalAnswered ? `${Math.round(profile.totalCorrect / profile.totalAnswered * 100)}%` : '—';
    $('careerBestStreak').textContent = profile.bestStreak ? `${profile.bestStreak} 🔥` : '0 🔥';
    renderAllBooks();
    renderBadges($('allBadges'), profile);
    const recent = $('recentQuests');
    recent.innerHTML = '';
    if (!profile.attempts.length) recent.innerHTML = '<div class="empty-state">Your recent quests will appear here after your first completed game.</div>';
    profile.attempts.slice(0, 6).forEach(attempt => {
      const row = document.createElement('div'); row.className = 'recent-quest-row';
      const left = document.createElement('div'); const name = document.createElement('strong'); name.textContent = attempt.rank; const date = document.createElement('small'); date.textContent = new Date(attempt.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); left.append(name, date);
      const mode = document.createElement('div'); mode.className = 'recent-quest-mode'; mode.textContent = MODE_INFO[attempt.mode]?.title || 'Bible Quest';
      const score = document.createElement('div'); score.className = 'recent-quest-score'; score.textContent = `${attempt.marks}/50`;
      row.append(left, mode, score); recent.appendChild(row);
    });
  }
  function renderLeaderboard() {
    const container = $('leaderboardRows');
    container.innerHTML = '';
    const ranked = sortedAttempts().slice(0, 10);
    if (!ranked.length) { container.innerHTML = '<div class="empty-state">🏆 Your name could be right here.<br />Play your first quest to enter the hall of fame.</div>'; return; }
    ranked.forEach((attempt, i) => {
      const row = document.createElement('div'); row.className = 'leaderboard-row';
      const position = document.createElement('div'); position.className = 'leaderboard-position'; position.textContent = ['①', '②', '③'][i] || `#${i + 1}`;
      const player = document.createElement('div'); player.className = 'leaderboard-player';
      const avatar = document.createElement('span'); avatar.className = 'player-avatar'; avatar.textContent = attempt.name.trim().charAt(0).toUpperCase() || 'W';
      const words = document.createElement('span'); const name = document.createElement('strong'); name.textContent = attempt.name; const date = document.createElement('small'); date.textContent = new Date(attempt.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); words.append(name, date); player.append(avatar, words);
      const mode = document.createElement('div'); mode.className = 'leaderboard-mode'; mode.textContent = MODE_INFO[attempt.mode]?.title || 'Bible Quest';
      const score = document.createElement('div'); score.className = 'leaderboard-score'; score.textContent = `${attempt.points.toLocaleString()} XP`; const marks = document.createElement('small'); marks.textContent = `${attempt.marks}/50 · ${attempt.rank}`; score.appendChild(marks);
      row.append(position, player, mode, score); container.appendChild(row);
    });
  }
  function toggleReview() {
    const panel = $('answerReview');
    const show = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    $('toggleReviewButton').textContent = show ? 'Hide review ↑' : 'Review answers ↓';
  }
  async function shareResults() {
    if (!game || !game.isFinished) return;
    const rank = rankFor(game.correct);
    const text = `📖 Word Quest Bible Quiz\nPlayer: ${game.name}\nMode: ${MODE_INFO[game.mode].title} (${MODE_INFO[game.mode].ages})\nMarks: ${game.correct}/50\nRank: ${rank.title}\nPoints: ${game.points.toLocaleString()} XP\nBest streak: ${game.bestStreak}\n“Seek, and you will find.” — Matthew 7:7`;
    try {
      if (navigator.share) await navigator.share({ title: 'My Word Quest Bible Quiz results', text });
      else if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); showToast('Results copied. Share your Bible quiz achievement!'); }
      else { window.prompt('Copy your quiz results:', text); }
    } catch (error) {
      if (error && error.name !== 'AbortError') showToast('Sharing was not available on this device.');
    }
  }

  document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => selectMode(card.dataset.mode)));
  $('startButton').addEventListener('click', () => startGame(selectedMode));
  $('playerName').addEventListener('keydown', event => { if (event.key === 'Enter') startGame(selectedMode); });
  $('nextButton').addEventListener('click', () => {
    if (!game || !game.answered[game.index]) return;
    if (game.index >= TOTAL_QUESTIONS - 1) finishGame();
    else { game.index += 1; startQuestion(); }
  });
  $('lifelineButton').addEventListener('click', useLifeline);
  $('quitButton').addEventListener('click', () => {
    if (window.confirm('Leave this quest? Your unfinished score will not be saved.')) {
      clearTimer(); game = null; showView('home');
    }
  });
  $('playAgainButton').addEventListener('click', () => { showView('home'); startGame(selectedMode); });
  $('toggleReviewButton').addEventListener('click', toggleReview);
  $('shareResultsButton').addEventListener('click', shareResults);
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('brandHome').addEventListener('click', event => { event.preventDefault(); showView('home'); });
  $('helpButton').addEventListener('click', () => $('helpDialog').showModal());
  $('closeHelp').addEventListener('click', () => $('helpDialog').close());
  $('helpDone').addEventListener('click', () => $('helpDialog').close());
  $('helpDialog').addEventListener('click', event => { if (event.target === $('helpDialog')) $('helpDialog').close(); });

  if (profile.lastName) $('playerName').value = profile.lastName;
  selectMode(1);
  renderHomeStats();
})();

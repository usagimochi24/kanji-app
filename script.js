// --- State Management ---
let state = {
    cards: [],
    mode: 'list', // 'list', 'test', 'result', 'dashboard'
    testType: 'normal', // 'normal', 'incorrect'
    currentIndex: 0,
    testQueue: [],
    showAnswer: false,
    dailyCount: 0,
    dailyGoal: 30,
    editingId: null,
    showAddForm: false,
    showList: false
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    render();
    lucide.createIcons();
});

// --- Data Persistence ---
function loadData() {
    const savedCards = localStorage.getItem('kanji-cards');
    if (savedCards) {
        try {
            state.cards = JSON.parse(savedCards);
        } catch (e) {
            console.error('Failed to parse saved cards', e);
        }
    }

    const today = new Date().toLocaleDateString();
    const savedDate = localStorage.getItem('kanji-daily-date');
    const savedCount = localStorage.getItem('kanji-daily-count');

    if (savedDate === today) {
        state.dailyCount = Number(savedCount) || 0;
    } else {
        localStorage.setItem('kanji-daily-date', today);
        localStorage.setItem('kanji-daily-count', '0');
        state.dailyCount = 0;
    }

    // Load test state
    const savedMode = localStorage.getItem('kanji-test-mode');
    const savedType = localStorage.getItem('kanji-test-type');
    const savedQueue = localStorage.getItem('kanji-test-queue');
    const savedIndex = localStorage.getItem('kanji-test-index');

    if (savedMode === 'test' && savedQueue) {
        try {
            const parsedQueue = JSON.parse(savedQueue);
            if (parsedQueue.length > 0) {
                state.testQueue = parsedQueue;
                state.currentIndex = Number(savedIndex) || 0;
                state.testType = savedType || 'normal';
                state.mode = 'test';
            }
        } catch (e) {
            console.error('Failed to parse saved test queue', e);
        }
    }
}

function saveData() {
    try {
        localStorage.setItem('kanji-cards', JSON.stringify(state.cards));
        localStorage.setItem('kanji-daily-count', String(state.dailyCount));
        
        if (state.mode === 'test' && state.testQueue.length > 0) {
            localStorage.setItem('kanji-test-mode', 'test');
            localStorage.setItem('kanji-test-queue', JSON.stringify(state.testQueue));
            localStorage.setItem('kanji-test-index', String(state.currentIndex));
            localStorage.setItem('kanji-test-type', state.testType);
        } else {
            localStorage.removeItem('kanji-test-mode');
            localStorage.removeItem('kanji-test-queue');
            localStorage.removeItem('kanji-test-index');
            localStorage.removeItem('kanji-test-type');
        }
    } catch (e) {
        console.error('Failed to save data', e);
    }
}

// --- Actions ---
function setState(newState) {
    state = { ...state, ...newState };
    saveData();
    render();
}

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function addCard(kanji, reading) {
    const newCard = {
        id: generateId(),
        kanji: kanji.trim(),
        reading: reading.trim(),
        isIncorrect: false,
        mistakeCount: 0,
        correctCount: 0
    };
    setState({ cards: [...state.cards, newCard], showAddForm: false });
}

function updateCard(id, kanji, reading) {
    const updatedCards = state.cards.map(c => 
        c.id === id ? { ...c, kanji: kanji.trim(), reading: reading.trim() } : c
    );
    setState({ cards: updatedCards, editingId: null, showAddForm: false });
}

function deleteCard(id) {
    showConfirmModal('漢字の削除', 'この漢字を削除してもよろしいですか？', () => {
        setState({ cards: state.cards.filter(c => c.id !== id) });
    });
}

function resetStats() {
    showConfirmModal('統計のリセット', 'すべての学習記録をリセットします。よろしいですか？', () => {
        const updated = state.cards.map(c => ({ ...c, isIncorrect: false, mistakeCount: 0, correctCount: 0 }));
        setState({ cards: updated });
    });
}

function startTest(onlyIncorrect = false) {
    const type = onlyIncorrect ? 'incorrect' : 'normal';

    // Resume check
    if (state.testType === type && state.testQueue.length > 0 && state.currentIndex < state.testQueue.length) {
        setState({ mode: 'test', showAnswer: false });
        return;
    }

    let queue = [];
    if (onlyIncorrect) {
        queue = state.cards.filter(c => c.isIncorrect || c.mistakeCount > 0);
        if (queue.length === 0) return;
        queue = [...queue].sort((a, b) => b.mistakeCount - a.mistakeCount).slice(0, 30);
    } else {
        queue = [...state.cards].sort(() => Math.random() - 0.5).slice(0, 30);
    }

    setState({
        mode: 'test',
        testType: type,
        testQueue: queue,
        currentIndex: 0,
        showAnswer: false
    });
}

function handleAnswer(correct) {
    const currentCard = state.testQueue[state.currentIndex];
    const updatedCards = state.cards.map(c => {
        if (c.id === currentCard.id) {
            return {
                ...c,
                isIncorrect: !correct,
                mistakeCount: correct ? c.mistakeCount : c.mistakeCount + 1,
                correctCount: correct ? c.correctCount + 1 : c.correctCount
            };
        }
        return c;
    });

    const isFinished = state.currentIndex >= state.testQueue.length - 1;
    setState({
        cards: updatedCards,
        dailyCount: state.dailyCount + 1,
        currentIndex: isFinished ? state.currentIndex : state.currentIndex + 1,
        showAnswer: false,
        mode: isFinished ? 'result' : 'test'
    });
}

// --- Rendering ---
function render() {
    const main = document.getElementById('main-content');
    main.innerHTML = '';

    const dashboardBtn = document.getElementById('toggle-dashboard');
    if (state.mode === 'dashboard') {
        dashboardBtn.classList.add('active');
        dashboardBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
    } else {
        dashboardBtn.classList.remove('active');
        dashboardBtn.innerHTML = '<i data-lucide="bar-chart-3"></i>';
    }

    switch (state.mode) {
        case 'list':
            renderList(main);
            break;
        case 'test':
            renderTest(main);
            break;
        case 'result':
            renderResult(main);
            break;
        case 'dashboard':
            renderDashboard(main);
            break;
    }
    lucide.createIcons();
}

function renderList(container) {
    const stats = calculateStats();
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-label">登録数</div>
                <div class="stat-value">${stats.total}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">苦手</div>
                <div class="stat-value text-rose">${stats.incorrect}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">正解率</div>
                <div class="stat-value text-sky">${stats.accuracy}%</div>
            </div>
        </div>

        <div class="test-controls">
            <button id="start-normal-test" class="btn-primary-large">
                <i data-lucide="play"></i>
                ${state.testType === 'normal' && state.testQueue.length > 0 && state.currentIndex < state.testQueue.length ? 'テストを再開' : '30問テスト'}
            </button>
            <button id="start-incorrect-test" class="btn-secondary-large" style="margin-top: 0.75rem;">
                <i data-lucide="rotate-ccw"></i>
                ${state.testType === 'incorrect' && state.testQueue.length > 0 && state.currentIndex < state.testQueue.length ? '苦手30問を再開' : '苦手30問復習'}
            </button>
        </div>

        <div class="card">
            <div class="progress-header">
                <h2 style="font-size: 1rem; font-weight: 800; color: var(--slate-700);">
                    <i data-lucide="trending-up" class="icon-sky" style="vertical-align: middle;"></i>
                    今日の目標達成
                </h2>
                <span style="font-size: 0.875rem; font-weight: 800; color: var(--sky-600);">${state.dailyCount} / ${state.dailyGoal}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${Math.min((state.dailyCount / state.dailyGoal) * 100, 100)}%;"></div>
            </div>
            <p style="font-size: 0.75rem; color: var(--slate-400); text-align: center; margin-top: 0.5rem; font-weight: 500;">
                ${state.dailyCount >= state.dailyGoal ? '目標達成！お疲れ様でした。✨' : `あと ${state.dailyGoal - state.dailyCount} 問で目標達成です。`}
            </p>
        </div>

        <button id="toggle-add-form" class="btn-outline">
            <i data-lucide="${state.showAddForm ? 'chevron-up' : 'plus'}"></i>
            ${state.editingId ? '編集をキャンセル' : '漢字登録'}
        </button>

        ${state.showAddForm ? `
            <div class="card form-section">
                <h2 style="font-size: 1.125rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="${state.editingId ? 'edit-2' : 'plus'}" class="icon-sky"></i>
                    ${state.editingId ? '漢字編集' : '漢字登録'}
                </h2>
                <div class="form-group">
                    <label class="form-label">読み・例文</label>
                    <input type="text" id="input-reading" placeholder="例: [びょうき]がなおる" value="${state.editingId ? state.cards.find(c => c.id === state.editingId).reading : ''}">
                    <p style="font-size: 0.625rem; color: var(--slate-400);">※漢字にする部分を [ ] で囲むか、漢字欄と同じ文字を含めてください。</p>
                </div>
                <div class="form-group">
                    <label class="form-label">漢字</label>
                    <input type="text" id="input-kanji" placeholder="例: 病気" value="${state.editingId ? state.cards.find(c => c.id === state.editingId).kanji : ''}" style="font-weight: 800; font-size: 1.5rem;">
                </div>
                <button id="submit-card" class="btn-submit">
                    <i data-lucide="save"></i>
                    ${state.editingId ? '更新する' : '保存する'}
                </button>
            </div>
        ` : ''}

        <div style="text-align: center;">
            <button id="toggle-list" class="btn-action" style="font-size: 0.75rem; font-weight: 800; color: var(--slate-400);">
                <i data-lucide="${state.showList ? 'chevron-up' : 'plus'}" style="width: 14px; height: 14px; vertical-align: middle;"></i>
                登録済み漢字を確認・編集
            </button>
        </div>

        ${state.showList ? `
            <div class="kanji-list">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 0.5rem;">
                    <h2 style="font-size: 1rem; font-weight: 800; color: var(--slate-600);">登録済み (${state.cards.length})</h2>
                    <button id="reset-stats" class="btn-action" style="font-size: 0.75rem; color: var(--slate-400);">統計をリセット</button>
                </div>
                ${state.cards.map(card => `
                    <div class="kanji-item ${card.isIncorrect ? 'incorrect' : ''}">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="kanji-main">${card.kanji}</span>
                                <span class="kanji-reading">(${card.reading})</span>
                            </div>
                            <div class="kanji-stats">
                                <span class="stat-mini correct"><i data-lucide="check" style="width: 10px;"></i> ${card.correctCount}</span>
                                <span class="stat-mini mistake"><i data-lucide="x" style="width: 10px;"></i> ${card.mistakeCount}</span>
                            </div>
                        </div>
                        <div class="kanji-actions">
                            ${card.isIncorrect ? '<span style="background: var(--rose-100); color: var(--rose-600); font-size: 0.625rem; font-weight: 800; padding: 0.125rem 0.375rem; border-radius: 1rem; margin-right: 0.5rem;">苦手</span>' : ''}
                            <button class="btn-action edit" onclick="editCard('${card.id}')"><i data-lucide="edit-2"></i></button>
                            <button class="btn-action delete" onclick="deleteCard('${card.id}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                `).join('')}
                ${state.cards.length === 0 ? '<div style="text-align: center; padding: 2rem; color: var(--slate-400); font-style: italic;">漢字が登録されていません</div>' : ''}
            </div>
        ` : ''}
    `;

    // Event Listeners
    document.getElementById('start-normal-test').onclick = () => startTest(false);
    document.getElementById('start-incorrect-test').onclick = () => startTest(true);
    document.getElementById('toggle-dashboard').onclick = () => setState({ mode: state.mode === 'dashboard' ? 'list' : 'dashboard' });
    document.getElementById('toggle-add-form').onclick = () => {
        if (state.editingId) setState({ editingId: null, showAddForm: false });
        else setState({ showAddForm: !state.showAddForm });
    };
    document.getElementById('toggle-list').onclick = () => setState({ showList: !state.showList });
    
    const submitBtn = document.getElementById('submit-card');
    if (submitBtn) {
        submitBtn.onclick = () => {
            const kanji = document.getElementById('input-kanji').value;
            const reading = document.getElementById('input-reading').value;
            if (state.editingId) updateCard(state.editingId, kanji, reading);
            else addCard(kanji, reading);
        };
    }

    const resetBtn = document.getElementById('reset-stats');
    if (resetBtn) resetBtn.onclick = resetStats;
}

function renderTest(container) {
    const currentCard = state.testQueue[state.currentIndex];
    
    container.innerHTML = `
        <div class="test-container">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <button id="back-to-list" class="btn-action" style="color: var(--slate-500); display: flex; align-items: center; gap: 0.25rem;">
                    <i data-lucide="chevron-left"></i> 一覧に戻る
                </button>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="progress-bar-bg" style="width: 100px; height: 0.5rem;">
                        <div class="progress-bar-fill" style="width: ${(state.currentIndex / state.testQueue.length) * 100}%;"></div>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 800; color: var(--slate-400);">${state.currentIndex + 1} / ${state.testQueue.length}</span>
                </div>
            </div>

            <div class="test-card">
                <div class="notebook-lines"></div>
                ${!state.showAnswer ? `
                    <div style="z-index: 1; display: flex; flex-direction: column; gap: 1.5rem; width: 100%;">
                        <div style="color: var(--sky-400); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em;">ノートに書いてください</div>
                        <div class="test-reading">${formatReading(currentCard.reading, currentCard.kanji)}</div>
                        <button id="show-answer" class="btn-submit" style="align-self: center; padding: 1rem 3rem; border-radius: 2rem; font-size: 1.125rem;">答えを表示</button>
                    </div>
                ` : `
                    <div style="z-index: 1; display: flex; flex-direction: column; gap: 1rem; width: 100%;">
                        <div style="color: var(--sky-400); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em;">正解</div>
                        <div class="test-kanji">${currentCard.kanji}</div>
                        <div style="font-size: 1.25rem; color: var(--slate-500); font-weight: 500;">${formatReading(currentCard.reading, currentCard.kanji)}</div>
                        <div class="test-actions">
                            <button id="answer-wrong" class="btn-test-answer wrong">
                                <i data-lucide="x" style="width: 28px; height: 28px;"></i>
                                <span>間違えた</span>
                            </button>
                            <button id="answer-correct" class="btn-test-answer correct">
                                <i data-lucide="check" style="width: 28px; height: 28px;"></i>
                                <span>正解！</span>
                            </button>
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;

    document.getElementById('back-to-list').onclick = () => setState({ mode: 'list' });
    if (!state.showAnswer) {
        document.getElementById('show-answer').onclick = () => setState({ showAnswer: true });
    } else {
        document.getElementById('answer-wrong').onclick = () => handleAnswer(false);
        document.getElementById('answer-correct').onclick = () => handleAnswer(true);
    }
}

function renderResult(container) {
    const incorrects = state.testQueue.filter(q => state.cards.find(c => c.id === q.id)?.isIncorrect);
    
    container.innerHTML = `
        <div style="text-align: center; display: flex; flex-direction: column; gap: 2rem; padding: 3rem 0;">
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="font-size: 4.5rem; animation: bounce 1s infinite;">🌊</div>
                <h2 style="font-size: 2.25rem; font-weight: 800;">素晴らしい挑戦！</h2>
                <p style="color: var(--slate-500); font-size: 1.125rem;">一歩ずつ、着実に。あなたの努力は裏切りません。</p>
            </div>

            <div class="card" style="max-width: 400px; margin: 0 auto; width: 100%;">
                <div style="font-size: 0.75rem; font-weight: 800; color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem;">今回の苦手漢字</div>
                <div class="review-list" style="justify-content: center;">
                    ${incorrects.length > 0 ? incorrects.map(q => `
                        <span class="review-tag" style="font-size: 1.25rem; padding: 0.5rem 1rem;">${q.kanji}</span>
                    `).join('') : `
                        <div style="padding: 1rem 0;">
                            <span style="color: var(--emerald-500); font-weight: 800; font-size: 1.25rem; display: block; margin-bottom: 0.5rem;">パーフェクト！✨</span>
                            <span style="color: var(--slate-400); font-size: 0.875rem;">この調子で頑張りましょう！</span>
                        </div>
                    `}
                </div>
            </div>

            <button id="back-to-list-result" class="btn-submit" style="align-self: center; padding: 1.25rem 4rem; border-radius: 2rem; font-size: 1.125rem;">一覧に戻る</button>
        </div>
    `;

    document.getElementById('back-to-list-result').onclick = () => setState({ mode: 'list', testQueue: [], currentIndex: 0 });
}

function renderDashboard(container) {
    const stats = calculateStats();
    
    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div class="stat-label">総合正解率</div>
                <div class="chart-container" style="width: 120px; height: 120px;">
                    <canvas id="accuracyChart"></canvas>
                    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800;">${stats.accuracy}%</div>
                </div>
            </div>
            <div class="card">
                <div class="stat-label" style="text-align: center; margin-bottom: 1rem;">習得状況</div>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${stats.masteryData.map(d => `
                        <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                            <span style="color: var(--slate-500); display: flex; align-items: center; gap: 0.5rem;">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${d.color};"></div>
                                ${d.name}
                            </span>
                            <span style="font-weight: 800;">${d.value}</span>
                        </div>
                    `).join('')}
                    ${stats.masteryData.length === 0 ? '<div style="text-align: center; color: var(--slate-400); font-size: 0.75rem; font-style: italic;">データがありません</div>' : ''}
                </div>
            </div>
        </div>

        <div class="card">
            <h3 class="stat-label" style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="trending-up" class="icon-sky"></i> 間違いの多い漢字 TOP 5
            </h3>
            <div style="height: 200px;">
                <canvas id="mistakesChart"></canvas>
            </div>
        </div>

        <div class="card" style="background: var(--rose-50); border-color: var(--rose-100);">
            <h3 style="font-size: 0.75rem; font-weight: 800; color: var(--rose-600); text-transform: uppercase; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="alert-circle"></i> 要復習リスト
            </h3>
            <div class="review-list">
                ${state.cards.filter(c => c.isIncorrect || c.mistakeCount > 2).map(c => `
                    <div class="review-tag">
                        <span>${c.kanji}</span>
                        <span class="tag-mistakes">${c.mistakeCount}回ミス</span>
                    </div>
                `).join('')}
                ${state.cards.filter(c => c.isIncorrect || c.mistakeCount > 2).length === 0 ? '<p style="color: var(--slate-400); font-size: 0.875rem; font-style: italic;">現在、復習が必要な漢字はありません。</p>' : ''}
            </div>
        </div>

        <button id="start-daily-test" class="btn-submit" style="padding: 1.25rem; border-radius: 2rem; font-size: 1.125rem;">
            <i data-lucide="play"></i> 今日の30問を始める
        </button>
    `;

    document.getElementById('start-daily-test').onclick = () => startTest(false);

    // Charts
    setTimeout(() => {
        const accCtx = document.getElementById('accuracyChart').getContext('2d');
        new Chart(accCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [stats.totalCorrect, stats.totalMistakes],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '70%', plugins: { tooltip: { enabled: false } } }
        });

        const misCtx = document.getElementById('mistakesChart').getContext('2d');
        new Chart(misCtx, {
            type: 'bar',
            data: {
                labels: stats.topMistakes.map(m => m.name),
                datasets: [{
                    label: '間違い数',
                    data: stats.topMistakes.map(m => m.mistakes),
                    backgroundColor: '#f43f5e',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { grid: { display: false } } }
            }
        });
    }, 0);
}

// --- Helpers ---
function calculateStats() {
    const total = state.cards.length;
    const incorrect = state.cards.filter(c => c.isIncorrect).length;
    const totalCorrect = state.cards.reduce((acc, c) => acc + c.correctCount, 0);
    const totalMistakes = state.cards.reduce((acc, c) => acc + c.mistakeCount, 0);
    const accuracy = totalCorrect + totalMistakes > 0 
        ? Math.round((totalCorrect / (totalCorrect + totalMistakes)) * 100) 
        : 0;

    const masteryData = [
        { name: '習得済み', value: state.cards.filter(c => c.correctCount > 3 && c.mistakeCount === 0).length, color: '#10b981' },
        { name: '学習中', value: state.cards.filter(c => c.correctCount > 0 && c.correctCount <= 3).length, color: '#0ea5e9' },
        { name: '未着手/苦手', value: state.cards.filter(c => c.correctCount === 0 || c.isIncorrect).length, color: '#f43f5e' },
    ].filter(d => d.value > 0);

    const topMistakes = [...state.cards]
        .filter(c => c.mistakeCount > 0)
        .sort((a, b) => b.mistakeCount - a.mistakeCount)
        .slice(0, 5)
        .map(c => ({ name: c.kanji, mistakes: c.mistakeCount }));

    return { total, incorrect, accuracy, masteryData, topMistakes, totalCorrect, totalMistakes };
}

function formatReading(text, kanji) {
    if (text.includes('[') && text.includes(']')) {
        return text.replace(/\[(.*?)\]/g, '<span class="underline-kanji">$1</span>');
    }
    if (kanji && text.includes(kanji)) {
        return text.replace(new RegExp(kanji, 'g'), `<span class="underline-kanji">${kanji}</span>`);
    }
    return `<span class="underline-kanji">${text}</span>`;
}

function editCard(id) {
    const card = state.cards.find(c => c.id === id);
    if (card) {
        setState({ editingId: id, showAddForm: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// --- Modal ---
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove('hidden');

    confirmBtn.onclick = () => {
        onConfirm();
        modal.classList.add('hidden');
    };
    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
    };
}

// CSS Bounce Animation for Result
const style = document.createElement('style');
style.textContent = `
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
}
`;
document.head.appendChild(style);

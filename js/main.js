// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
const API_URL = 'http://127.0.0.1:8000/api';
let tg = window.Telegram?.WebApp;
let currentTab = 'tasks';
let currentWorkspaceTab = 'overview';
let currentProject = null;
let currentCalendarDate = new Date();
let searchTimeout = null;

// Sortable instances
let taskSortable = null;
let milestoneSortable = null;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

if (tg) {
    tg.ready();
    tg.expand();
    
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('userInfo').textContent = `${user.first_name} (ID: ${user.id})`;
    }
} else {
    document.getElementById('userInfo').textContent = 'Локальный режим';
}

function getInitData() {
    return tg?.initData || '';
}

// ========== УТИЛИТЫ ==========

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    if (tg?.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

function hapticFeedback(type) {
    if (tg?.HapticFeedback) {
        if (type === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
        } else if (type === 'light') {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
}

function formatDeadline(deadline, isOverdue) {
    const date = new Date(deadline);
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (isOverdue) return '⏰ Просрочено!';
    if (days === 0) return '⏰ Сегодня';
    if (days === 1) return '⏰ Завтра';
    if (days < 7) return `⏰ Через ${days} дн.`;
    
    return `⏰ ${date.toLocaleDateString('ru-RU')}`;
}

// Закрытие поиска при клике вне
document.addEventListener('click', (e) => {
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');
    
    if (searchInput && searchResults &&
        e.target.tagName !== 'INPUT' && 
        e.target.tagName !== 'TEXTAREA' && 
        !searchInput.contains(e.target) && 
        !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ==========
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('newTaskInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    
    loadTasks();
    loadProjects();
});

// ========== ГОРЯЧИЕ КЛАВИШИ ==========
// Горячие клавиши через Alt
document.addEventListener('keydown', (e) => {
    // Alt + N - Новая задача
    if (e.altKey && e.key === 'n') {
        e.preventDefault();
        switchTab('tasks');
        setTimeout(() => toggleTaskForm(), 100);
    }
    
    // Alt + D - Дашборд
    if (e.altKey && e.key === 'd') {
        e.preventDefault();
        switchTab('dashboard');
    }
    
    // Alt + C - Календарь
    if (e.altKey && e.key === 'c') {
        e.preventDefault();
        switchTab('calendar');
    }
    
    // Alt + P - Проекты
    if (e.altKey && e.key === 'p') {
        e.preventDefault();
        switchTab('projects');
    }
    
    // Alt + K - Канбан
    if (e.altKey && e.key === 'k') {
        e.preventDefault();
        switchTab('kanban');
    }
    
    // Alt + M - Заметки
    if (e.altKey && e.key === 'm') {
        e.preventDefault();
        switchTab('notes');
    }
});
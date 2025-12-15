// ========== ДАШБОРД ==========

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const stats = await response.json();
        renderDashboard(stats);
    } catch (error) {
        console.error('Ошибка загрузки дашборда:', error);
        showError('Не удалось загрузить статистику');
    }
}

function renderDashboard(stats) {
    // Основные метрики
    document.getElementById('dash-total-tasks').textContent = stats.total_tasks;
    document.getElementById('dash-active-tasks').textContent = stats.active_tasks;
    document.getElementById('dash-completed-tasks').textContent = stats.completed_tasks;
    document.getElementById('dash-completion-rate').textContent = `${stats.completion_rate}%`;
    
    // График за неделю
    const chartContainer = document.getElementById('chart-container');
    const maxCount = Math.max(...stats.tasks_by_day.map(d => d.count), 1);
    
    chartContainer.innerHTML = stats.tasks_by_day.map(day => {
        const heightPercent = maxCount > 0 ? Math.round((day.count / maxCount) * 100) : 0;
        
        return `
            <div class="flex flex-col justify-end items-center flex-1 h-full">
                <div class="w-full flex flex-col justify-end items-center" style="height: 100%;">
                    ${day.count > 0 ? `
                        <div class="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer relative group" 
                             style="height: ${Math.max(heightPercent, 8)}%"
                             title="${day.count} задач ${day.date}">
                            <div class="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                ${day.count} задач
                            </div>
                        </div>
                    ` : `
                        <div class="w-full bg-gray-100 rounded" style="height: 4px" title="0 задач ${day.date}"></div>
                    `}
                </div>
                <div class="text-center mt-2">
                    <p class="text-xs text-gray-600">${day.date}</p>
                    <p class="text-xs font-bold text-gray-800">${day.count}</p>
                </div>
            </div>
        `;
    }).join('');
    
    // Приоритеты
    const totalPriority = stats.priority_stats.high + stats.priority_stats.medium + stats.priority_stats.low;
    
    document.getElementById('dash-priority-high').textContent = stats.priority_stats.high;
    document.getElementById('dash-priority-medium').textContent = stats.priority_stats.medium;
    document.getElementById('dash-priority-low').textContent = stats.priority_stats.low;
    
    if (totalPriority > 0) {
        const highPercent = Math.round((stats.priority_stats.high / totalPriority) * 100);
        const mediumPercent = Math.round((stats.priority_stats.medium / totalPriority) * 100);
        const lowPercent = Math.round((stats.priority_stats.low / totalPriority) * 100);
        
        document.getElementById('dash-priority-high-bar').style.width = `${highPercent}%`;
        document.getElementById('dash-priority-medium-bar').style.width = `${mediumPercent}%`;
        document.getElementById('dash-priority-low-bar').style.width = `${lowPercent}%`;
    } else {
        document.getElementById('dash-priority-high-bar').style.width = '0%';
        document.getElementById('dash-priority-medium-bar').style.width = '0%';
        document.getElementById('dash-priority-low-bar').style.width = '0%';
    }
    
    // Дедлайны и проекты
    document.getElementById('dash-overdue').textContent = stats.overdue_tasks;
    document.getElementById('dash-week').textContent = stats.week_tasks;
    document.getElementById('dash-projects').textContent = stats.active_projects;
}
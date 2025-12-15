// Загрузка дашборда
async function loadDashboard() {
    try {
        const tasks = await TaskAPI.getAll();
        const projects = await ProjectAPI.getAll();
        
        updateDashboardStats(tasks, projects);
        updateDashboardChart(tasks);
        updatePriorityStats(tasks);
        updateDeadlineStats(tasks);
    } catch (error) {
        console.error('Ошибка загрузки дашборда:', error);
        showNotification('Ошибка загрузки дашборда', 'error');
    }
}

// Обновить статистику
function updateDashboardStats(tasks, projects) {
    const total = tasks.length;
    const active = tasks.filter(t => !t.completed).length;
    const completed = tasks.filter(t => t.completed).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('dash-total-tasks').textContent = total;
    document.getElementById('dash-active-tasks').textContent = active;
    document.getElementById('dash-completed-tasks').textContent = completed;
    document.getElementById('dash-completion-rate').textContent = `${completionRate}%`;
    document.getElementById('dash-projects').textContent = projects.length;
}

// Обновить график выполнения за неделю
function updateDashboardChart(tasks) {
    const container = document.getElementById('chart-container');
    
    // Последние 7 дней
    const days = [];
    const counts = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const completed = tasks.filter(t => {
            if (!t.completed || !t.completed_at) return false;
            const completedDate = new Date(t.completed_at);
            return completedDate >= date && completedDate < nextDate;
        }).length;
        
        days.push(date.toLocaleDateString('ru-RU', { weekday: 'short' }));
        counts.push(completed);
    }
    
    const maxCount = Math.max(...counts, 5); // Минимум 5 для красивого графика
    
    container.innerHTML = days.map((day, index) => {
        const count = counts[index];
        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
        
        return `
            <div class="flex flex-col items-center gap-1 flex-1">
                <div class="w-full flex items-end justify-center" style="height: 200px;">
                    <div class="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600" style="height: ${Math.max(height, count > 0 ? 10 : 0)}%; min-height: ${count > 0 ? '20px' : '0'}"></div>
                </div>
                <span class="text-xs text-gray-600 font-medium">${day}</span>
                <span class="text-xs font-bold ${count > 0 ? 'text-blue-600' : 'text-gray-400'}">${count}</span>
            </div>
        `;
    }).join('');
}

// Обновить статистику по приоритетам
function updatePriorityStats(tasks) {
    const high = tasks.filter(t => t.priority === 'high' && !t.completed).length;
    const medium = tasks.filter(t => t.priority === 'medium' && !t.completed).length;
    const low = tasks.filter(t => t.priority === 'low' && !t.completed).length;
    
    const total = high + medium + low || 1;
    
    document.getElementById('dash-priority-high').textContent = high;
    document.getElementById('dash-priority-medium').textContent = medium;
    document.getElementById('dash-priority-low').textContent = low;
    
    document.getElementById('dash-priority-high-bar').style.width = `${(high / total) * 100}%`;
    document.getElementById('dash-priority-medium-bar').style.width = `${(medium / total) * 100}%`;
    document.getElementById('dash-priority-low-bar').style.width = `${(low / total) * 100}%`;
}

// Обновить статистику по дедлайнам
function updateDeadlineStats(tasks) {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const overdue = tasks.filter(t => 
        !t.completed && 
        t.deadline && 
        new Date(t.deadline) < now
    ).length;
    
    const thisWeek = tasks.filter(t => 
        !t.completed && 
        t.deadline && 
        new Date(t.deadline) >= now && 
        new Date(t.deadline) <= weekLater
    ).length;
    
    document.getElementById('dash-overdue').textContent = overdue;
    document.getElementById('dash-week').textContent = thisWeek;
}
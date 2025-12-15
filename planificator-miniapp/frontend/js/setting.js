// ========== НАСТРОЙКИ ==========

// Экспорт задач в CSV
async function exportTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tasks = await response.json();
        
        // Создать CSV
        let csv = 'Название,Проект,Приоритет,Статус,Дедлайн,Завершено\n';
        
        tasks.forEach(task => {
            const row = [
                `"${task.title.replace(/"/g, '""')}"`,
                `"${task.project_name || 'Без проекта'}"`,
                task.priority,
                task.status || 'todo',
                task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : '',
                task.completed ? 'Да' : 'Нет'
            ];
            csv += row.join(',') + '\n';
        });
        
        // Скачать файл
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        hapticFeedback('success');
        showError('Задачи экспортированы!');
    } catch (error) {
        console.error('Ошибка экспорта задач:', error);
        showError('Не удалось экспортировать задачи');
    }
}

// Экспорт проектов в CSV
async function exportProjects() {
    try {
        const response = await fetch(`${API_URL}/projects/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const projects = await response.json();
        
        let csv = 'Название,Описание,Задач,Этапов,Документов,Цвет\n';
        
        projects.forEach(project => {
            const row = [
                `"${project.name.replace(/"/g, '""')}"`,
                `"${(project.description || '').replace(/"/g, '""')}"`,
                project.tasks_count,
                project.milestones_count,
                project.documents_count,
                project.color
            ];
            csv += row.join(',') + '\n';
        });
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `projects_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        hapticFeedback('success');
        showError('Проекты экспортированы!');
    } catch (error) {
        console.error('Ошибка экспорта проектов:', error);
        showError('Не удалось экспортировать проекты');
    }
}

// Проверка ближайших дедлайнов
async function checkUpcomingDeadlines() {
    try {
        const response = await fetch(`${API_URL}/tasks/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tasks = await response.json();
        const now = new Date();
        const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        
        const upcoming = tasks.filter(task => {
            if (!task.deadline || task.completed) return false;
            const deadline = new Date(task.deadline);
            return deadline >= now && deadline <= threeDaysLater;
        });
        
        const overdue = tasks.filter(task => {
            if (!task.deadline || task.completed) return false;
            return new Date(task.deadline) < now;
        });
        
        const container = document.getElementById('deadlineNotifications');
        
        if (upcoming.length === 0 && overdue.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-4">Нет срочных задач 🎉</p>';
            return;
        }
        
        let html = '';
        
        if (overdue.length > 0) {
            html += '<div class="bg-red-50 border-l-4 border-red-500 p-3 mb-3">';
            html += `<p class="font-semibold text-red-800 mb-2">⚠️ Просрочено (${overdue.length})</p>`;
            html += '<div class="space-y-1">';
            overdue.forEach(task => {
                html += `<p class="text-sm text-red-700 cursor-pointer hover:underline" onclick="openEditTaskModal(${task.id})">${escapeHtml(task.title)}</p>`;
            });
            html += '</div></div>';
        }
        
        if (upcoming.length > 0) {
            html += '<div class="bg-yellow-50 border-l-4 border-yellow-500 p-3">';
            html += `<p class="font-semibold text-yellow-800 mb-2">🔔 Ближайшие 3 дня (${upcoming.length})</p>`;
            html += '<div class="space-y-1">';
            upcoming.forEach(task => {
                const deadline = new Date(task.deadline);
                html += `<p class="text-sm text-yellow-700 cursor-pointer hover:underline" onclick="openEditTaskModal(${task.id})">${escapeHtml(task.title)} — ${deadline.toLocaleDateString('ru-RU')}</p>`;
            });
            html += '</div></div>';
        }
        
        container.innerHTML = html;
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка проверки дедлайнов:', error);
        showError('Не удалось проверить дедлайны');
    }
}
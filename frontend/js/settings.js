// Экспорт задач
async function exportTasks() {
    try {
        const tasks = await TaskAPI.getAll();
        
        const csv = [
            ['ID', 'Название', 'Описание', 'Приоритет', 'Статус', 'Дедлайн', 'Выполнено'],
            ...tasks.map(t => [
                t.id,
                t.title,
                t.description || '',
                t.priority,
                t.status,
                t.deadline || '',
                t.completed ? 'Да' : 'Нет'
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tasks_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        
        showNotification('Задачи экспортированы', 'success');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showNotification('Ошибка экспорта', 'error');
    }
}

// Экспорт проектов
async function exportProjects() {
    try {
        const projects = await ProjectAPI.getAll();
        
        const csv = [
            ['ID', 'Название', 'Описание', 'Иконка', 'Цвет'],
            ...projects.map(p => [
                p.id,
                p.name,
                p.description || '',
                p.icon,
                p.color
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `projects_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        
        showNotification('Проекты экспортированы', 'success');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showNotification('Ошибка экспорта', 'error');
    }
}

// Проверка дедлайнов
async function checkUpcomingDeadlines() {
    try {
        const tasks = await TaskAPI.getAll();
        const now = new Date();
        const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        
        const upcoming = tasks.filter(t => 
            !t.completed && 
            t.deadline && 
            new Date(t.deadline) <= threeDays
        );
        
        const container = document.getElementById('deadlineNotifications');
        
        if (upcoming.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-600">Нет ближайших дедлайнов</p>';
        } else {
            container.innerHTML = upcoming.map(t => `
                <div class="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-2">
                    <p class="font-medium text-orange-800">${t.title}</p>
                    <p class="text-sm text-orange-600">Дедлайн: ${new Date(t.deadline).toLocaleString('ru-RU')}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Ошибка проверки дедлайнов:', error);
    }
}
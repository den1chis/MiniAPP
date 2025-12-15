// ========== КАНБАН ==========

let kanbanSortables = {};

// ========== КАНБАН ==========

async function loadKanban() {
    try {
        let url = `${API_URL}/tasks/`;
        const params = new URLSearchParams();
        
        const projectFilter = document.getElementById('kanbanFilterProject')?.value;
        const subprojectFilter = document.getElementById('kanbanFilterSubproject')?.value;
        const priorityFilter = document.getElementById('kanbanFilterPriority')?.value;
        
        if (projectFilter) params.append('project', projectFilter);
        if (subprojectFilter) params.append('subproject', subprojectFilter);
        if (priorityFilter) params.append('priority', priorityFilter);
        
        if (params.toString()) url += `?${params.toString()}`;
        
        const response = await fetch(url, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tasks = await response.json();
        renderKanban(tasks);
        updateKanbanProjectFilters();
    } catch (error) {
        console.error('Ошибка загрузки канбана:', error);
        showError('Не удалось загрузить канбан');
    }
}

function renderKanban(tasks) {
    const columns = {
        'todo': [],
        'in_progress': [],
        'done': []
    };
    
    tasks.forEach(task => {
        let status = task.status || 'todo';
        if (task.completed && status !== 'done') {
            status = 'done';
        }
        
        if (columns[status]) {
            columns[status].push(task);
        }
    });
    
    // Обновить счётчики
    document.getElementById('kanban-todo-count').textContent = columns.todo.length;
    document.getElementById('kanban-progress-count').textContent = columns.in_progress.length;
    document.getElementById('kanban-done-count').textContent = columns.done.length;
    
    // Рендер колонок
    Object.keys(columns).forEach(status => {
        const container = document.getElementById(`kanban-${status}`);
        
        if (columns[status].length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Нет задач</p>';
            return;
        }
        
        const priorityColors = {
            high: 'border-l-red-500',
            medium: 'border-l-yellow-500',
            low: 'border-l-green-500'
        };
        
        container.innerHTML = columns[status].map(task => `
            <div class="bg-white rounded-lg p-3 shadow-sm border-l-4 ${priorityColors[task.priority]} cursor-pointer hover:shadow-md transition-shadow" data-task-id="${task.id}">
                <p class="font-medium text-sm text-gray-800 mb-1" onclick="openEditTaskModal(${task.id})">
                    ${escapeHtml(task.title)}
                </p>
                ${task.project_name ? `<p class="text-xs text-gray-500">📁 ${escapeHtml(task.project_name)}</p>` : ''}
                ${task.subproject_name ? `<p class="text-xs text-gray-500">👤 ${escapeHtml(task.subproject_name)}</p>` : ''}
                ${task.deadline ? `<p class="text-xs text-gray-500 mt-1">⏰ ${formatDeadline(task.deadline, task.is_overdue)}</p>` : ''}
            </div>
        `).join('');
    });
    
    initKanbanSortable();
}

function initKanbanSortable() {
    const columns = ['todo', 'in_progress', 'done'];
    
    columns.forEach(status => {
        const container = document.getElementById(`kanban-${status}`);
        
        Sortable.create(container, {
            group: 'kanban',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function(evt) {
                const taskId = evt.item.dataset.taskId;
                const newStatus = evt.to.id.replace('kanban-', '');
                
                try {
                    const response = await fetch(`${API_URL}/tasks/${taskId}/`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Telegram-Init-Data': getInitData()
                        },
                        body: JSON.stringify({ 
                            status: newStatus,
                            completed: newStatus === 'done'
                        })
                    });
                    
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    await loadKanban();
                    hapticFeedback('light');
                } catch (error) {
                    console.error('Ошибка обновления статуса:', error);
                    showError('Не удалось обновить статус');
                    await loadKanban();
                }
            }
        });
    });
}

function toggleKanbanFilters() {
    const container = document.getElementById('kanbanFiltersContainer');
    const icon = document.getElementById('kanbanFilterIcon');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        icon.textContent = 'Скрыть';
    } else {
        container.classList.add('hidden');
        icon.textContent = 'Фильтры';
    }
}

function clearKanbanFilters() {
    document.getElementById('kanbanFilterProject').value = '';
    document.getElementById('kanbanFilterSubproject').value = '';
    document.getElementById('kanbanFilterPriority').value = '';
    loadKanban();
}

async function updateKanbanProjectFilters() {
    try {
        const [projectsRes, subprojectsRes] = await Promise.all([
            fetch(`${API_URL}/projects/`, {
                headers: { 'X-Telegram-Init-Data': getInitData() }
            }),
            // Получить все подпроекты из всех проектов
            fetch(`${API_URL}/projects/`, {
                headers: { 'X-Telegram-Init-Data': getInitData() }
            })
        ]);
        
        const projects = await projectsRes.json();
        
        // Обновить фильтр проектов
        const projectSelect = document.getElementById('kanbanFilterProject');
        if (projectSelect) {
            const currentValue = projectSelect.value;
            projectSelect.innerHTML = '<option value="">📁 Все проекты</option>' + 
                projects.map(p => `<option value="${p.id}">${p.icon} ${escapeHtml(p.name)}</option>`).join('');
            projectSelect.value = currentValue;
        }
        
        // Получить подпроекты выбранного проекта
        const selectedProject = document.getElementById('kanbanFilterProject')?.value;
        if (selectedProject) {
            const subprojectsRes = await fetch(`${API_URL}/projects/${selectedProject}/subprojects/`, {
                headers: { 'X-Telegram-Init-Data': getInitData() }
            });
            const subprojects = await subprojectsRes.json();
            
            const subprojectSelect = document.getElementById('kanbanFilterSubproject');
            if (subprojectSelect) {
                subprojectSelect.innerHTML = '<option value="">👤 Все подпроекты</option>' + 
                    subprojects.map(sp => `<option value="${sp.id}">${sp.icon} ${escapeHtml(sp.name)}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки фильтров:', error);
    }
}
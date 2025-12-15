// ========== ЗАДАЧИ ==========
// В начало файла tasks.js добавьте:

// Показать/скрыть форму создания задачи
function toggleTaskForm() {
    const container = document.getElementById('taskFormContainer');
    const btn = document.getElementById('toggleTaskFormBtn');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span class="hidden sm:inline">Закрыть</span>';
        document.getElementById('newTaskInput').focus();
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span class="hidden sm:inline">Новая задача</span>';
        // Очистка полей
        document.getElementById('newTaskInput').value = '';
        document.getElementById('taskDeadline').value = '';
    }
}

function toggleTaskFilters() {
    const container = document.getElementById('taskFiltersContainer');
    const icon = document.getElementById('filterIcon');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        icon.textContent = '▼';
    } else {
        container.classList.add('hidden');
        icon.textContent = '▶';
    }
}

async function loadTasks() {
    try {
        let url = `${API_URL}/tasks/`;
        const params = new URLSearchParams();
        
        const projectFilter = document.getElementById('filterProject')?.value;
        const priorityFilter = document.getElementById('filterPriority')?.value;
        const completedFilter = document.getElementById('filterCompleted')?.value;
        
        if (projectFilter) params.append('project', projectFilter);
        if (priorityFilter) params.append('priority', priorityFilter);
        if (completedFilter) params.append('completed', completedFilter);
        
        if (params.toString()) url += `?${params.toString()}`;
        
        const response = await fetch(url, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tasks = await response.json();
        renderTasks(tasks);
        updateCounters(tasks);
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        showError('Не удалось загрузить задачи');
    }
}

function updateCounters(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    
    document.getElementById('taskCount').textContent = `Всего: ${total}`;
    document.getElementById('completedCount').textContent = `Выполнено: ${completed}`;
}

function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач</p>';
        return;
    }
    
    const priorityColors = {
        high: 'border-red-500 bg-red-50',
        medium: 'border-yellow-500 bg-yellow-50',
        low: 'border-green-500 bg-green-50'
    };
    
    const priorityLabels = {
        high: '🔴',
        medium: '🟡',
        low: '🟢'
    };
    
    taskList.innerHTML = tasks.map(task => {
        const deadlineText = task.deadline ? formatDeadline(task.deadline, task.is_overdue) : '';
        
        return `
            <div class="flex items-start gap-3 p-3 border-l-4 rounded-lg hover:bg-gray-50 transition-colors ${priorityColors[task.priority]}">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''}
                    onchange="toggleTask(${task.id}, this.checked)"
                    class="w-5 h-5 mt-0.5 text-blue-500 rounded cursor-pointer"
                >
                <div class="flex-1 min-w-0" onclick="openEditTaskModal(${task.id})">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="${task.completed ? 'line-through text-gray-400' : 'text-gray-800'} font-medium break-words cursor-pointer">
                            ${escapeHtml(task.title)}
                        </span>
                        <span class="text-sm">${priorityLabels[task.priority]}</span>
                    </div>
                    ${task.project_name ? `<p class="text-xs text-gray-500 mb-1">📁 ${escapeHtml(task.project_name)}</p>` : ''}
                    ${deadlineText ? `<p class="text-xs ${task.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}">${deadlineText}</p>` : ''}
                </div>
                <button 
                    onclick="deleteTask(${task.id})"
                    class="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-100 transition-colors flex-shrink-0"
                >
                    ✕
                </button>
            </div>
        `;
    }).join('');
}

async function addTask() {
    const title = document.getElementById('newTaskInput').value.trim();
    const project = document.getElementById('taskProject').value || null;
    const priority = document.getElementById('taskPriority').value;
    const deadlineInput = document.getElementById('taskDeadline').value;
    const deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    
    if (!title) {
        document.getElementById('newTaskInput').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/tasks/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ 
                title, 
                project: project ? parseInt(project) : null, 
                priority, 
                deadline 
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        document.getElementById('newTaskInput').value = '';
        document.getElementById('taskDeadline').value = '';
        
        await loadTasks();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showError('Не удалось добавить задачу');
    }
}

async function toggleTask(id, completed) {
    try {
        const response = await fetch(`${API_URL}/tasks/${id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ 
                completed,
                status: completed ? 'done' : 'todo'
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        if (currentProject) {
            await loadWorkspaceTasks();
            await loadWorkspaceOverview();
        } else {
            await loadTasks();
        }
        
        hapticFeedback('light');
    } catch (error) {
        console.error('Ошибка обновления задачи:', error);
        showError('Не удалось обновить задачу');
    }
}

async function deleteTask(id) {
    try {
        const response = await fetch(`${API_URL}/tasks/${id}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        if (currentProject) {
            await loadWorkspaceTasks();
            await loadWorkspaceOverview();
        } else {
            await loadTasks();
        }
        
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления задачи:', error);
        showError('Не удалось удалить задачу');
    }
}

// ========== МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ==========

async function openEditTaskModal(taskId) {
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const task = await response.json();
        
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDescription').value = task.description || '';
        document.getElementById('editTaskPriority').value = task.priority;
        
        if (task.deadline) {
            const deadline = new Date(task.deadline);
            const localDatetime = new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            document.getElementById('editTaskDeadline').value = localDatetime;
        } else {
            document.getElementById('editTaskDeadline').value = '';
        }
        
        document.getElementById('editTaskModal').classList.remove('hidden');
    } catch (error) {
        console.error('Ошибка загрузки задачи:', error);
        showError('Не удалось загрузить задачу');
    }
}

function closeEditTaskModal() {
    document.getElementById('editTaskModal').classList.add('hidden');
}

async function saveTaskEdit() {
    const taskId = document.getElementById('editTaskId').value;
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    const deadlineInput = document.getElementById('editTaskDeadline').value;
    const deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    
    if (!title) {
        document.getElementById('editTaskTitle').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ title, description, priority, deadline })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        closeEditTaskModal();
        
        if (currentProject) {
            await loadWorkspaceTasks();
            await loadWorkspaceOverview();
        } else {
            await loadTasks();
        }
        
        if (currentTab === 'calendar') {
            renderCalendar();
        }
        
        if (currentTab === 'kanban') {
            await loadKanban();
        }
        
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка обновления задачи:', error);
        showError('Не удалось обновить задачу');
    }
}
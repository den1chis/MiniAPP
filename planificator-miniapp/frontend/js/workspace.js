// ========== WORKSPACE ==========

async function loadProjectDetail() {
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const project = await response.json();
        
        document.getElementById('pageTitle').textContent = `${project.icon} ${project.name}`;
        document.getElementById('ws-project-name').textContent = project.name;
        document.getElementById('ws-project-description').textContent = project.description || 'Нет описания';
        
        return project;
    } catch (error) {
        console.error('Ошибка загрузки проекта:', error);
        showError('Не удалось загрузить проект');
    }
}

async function loadWorkspaceOverview() {
    const project = await loadProjectDetail();
    if (!project) return;
    
    // Загружаем статистику задач
    try {
        const tasksResponse = await fetch(`${API_URL}/tasks/?project=${currentProject}`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (tasksResponse.ok) {
            const tasks = await tasksResponse.json();
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.completed).length;
            
            document.getElementById('ws-total-tasks').textContent = totalTasks;
            document.getElementById('ws-completed-tasks').textContent = completedTasks;
            
            const progress = totalTasks > 0 
                ? Math.round((completedTasks / totalTasks) * 100) 
                : 0;
            document.getElementById('ws-progress-text').textContent = `${progress}%`;
            document.getElementById('ws-progress-bar').style.width = `${progress}%`;
        }
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
    }
    
    // Остальная статистика
    document.getElementById('ws-milestones-count').textContent = project.milestones_count || 0;
    
    // Подсчёт заметок вместо документов
    try {
        const notesResponse = await fetch(`${API_URL}/projects/${currentProject}/notes/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (notesResponse.ok) {
            const notes = await notesResponse.json();
            document.getElementById('ws-notes-count').textContent = notes.length;
        } else {
            document.getElementById('ws-notes-count').textContent = '0';
        }
    } catch (error) {
        document.getElementById('ws-notes-count').textContent = '0';
    }
}

async function loadWorkspaceTasks() {
    if (!currentProject) return;
    
    try {
        let url = `${API_URL}/tasks/?project=${currentProject}`;
        
        const milestoneFilter = document.getElementById('wsFilterMilestone')?.value;
        const priorityFilter = document.getElementById('wsFilterPriority')?.value;
        
        if (milestoneFilter) url += `&milestone=${milestoneFilter}`;
        if (priorityFilter) url += `&priority=${priorityFilter}`;
        
        const response = await fetch(url, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tasks = await response.json();
        renderWorkspaceTasks(tasks);
        
        await loadMilestonesForSelect();
        initTaskSortable();
    } catch (error) {
        console.error('Ошибка загрузки задач проекта:', error);
        showError('Не удалось загрузить задачи');
    }
}

async function loadMilestonesForSelect() {
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/milestones/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const milestones = await response.json();
        
        const selects = [
            document.getElementById('wsTaskMilestone'),
            document.getElementById('wsFilterMilestone')
        ];
        
        selects.forEach(select => {
            if (!select) return;
            
            const currentValue = select.value;
            const options = select.id === 'wsFilterMilestone' 
                ? '<option value="">Все этапы</option>'
                : '<option value="">Без этапа</option>';
            
            select.innerHTML = options + milestones.map(m => 
                `<option value="${m.id}">${escapeHtml(m.name)}</option>`
            ).join('');
            
            select.value = currentValue;
        });
    } catch (error) {
        console.error('Ошибка загрузки этапов:', error);
    }
}

function renderWorkspaceTasks(tasks) {
    const taskList = document.getElementById('wsTaskList');
    
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач в проекте</p>';
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
            <div class="flex items-start gap-3 p-3 border-l-4 rounded-lg hover:bg-gray-50 transition-colors draggable-item ${priorityColors[task.priority]}" 
                 data-task-id="${task.id}">
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
                    ${task.milestone_name ? `<p class="text-xs text-gray-500 mb-1">🗺️ ${escapeHtml(task.milestone_name)}</p>` : ''}
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

function initTaskSortable() {
    const taskList = document.getElementById('wsTaskList');
    
    if (taskSortable) {
        taskSortable.destroy();
    }
    
    taskSortable = Sortable.create(taskList, {
        animation: 150,
        handle: '.draggable-item',
        ghostClass: 'sortable-ghost',
        onEnd: async function(evt) {
            const taskId = evt.item.dataset.taskId;
            const newOrder = evt.newIndex;
            
            console.log(`Task ${taskId} moved to position ${newOrder}`);
            hapticFeedback('light');
        }
    });
}

async function addWorkspaceTask() {
    const title = document.getElementById('wsNewTaskInput').value.trim();
    const milestoneValue = document.getElementById('wsTaskMilestone').value;
    const milestone = milestoneValue ? parseInt(milestoneValue) : null;
    const priority = document.getElementById('wsTaskPriority').value;
    const deadlineInput = document.getElementById('wsTaskDeadline').value;
    const deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    
    if (!title) {
        document.getElementById('wsNewTaskInput').focus();
        return;
    }
    
    try {
        const payload = { 
            title, 
            project: parseInt(currentProject),
            priority, 
            deadline 
        };
        
        // Добавляем milestone только если он выбран
        if (milestone) {
            payload.milestone = milestone;
        }
        
        const response = await fetch(`${API_URL}/tasks/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error(`HTTP ${response.status}`);
        }
        
        document.getElementById('wsNewTaskInput').value = '';
        document.getElementById('wsTaskDeadline').value = '';
        document.getElementById('wsTaskMilestone').value = '';
        
        await loadWorkspaceTasks();
        await loadWorkspaceOverview();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showError('Не удалось добавить задачу');
    }
}

// ========== MILESTONES ==========

async function loadMilestones() {
    if (!currentProject) return;
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/milestones/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const milestones = await response.json();
        renderMilestones(milestones);
    } catch (error) {
        console.error('Ошибка загрузки этапов:', error);
        showError('Не удалось загрузить этапы');
    }
}

function renderMilestones(milestones) {
    const milestoneList = document.getElementById('milestoneList');
    
    if (milestones.length === 0) {
        milestoneList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет этапов. Создайте первый!</p>';
        return;
    }
    
    milestoneList.innerHTML = milestones.map(milestone => {
        const dateRange = milestone.start_date && milestone.end_date 
            ? `${new Date(milestone.start_date).toLocaleDateString('ru')} - ${new Date(milestone.end_date).toLocaleDateString('ru')}`
            : 'Даты не указаны';
        
        return `
            <div class="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-800">${escapeHtml(milestone.name)}</h3>
                        ${milestone.description ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(milestone.description)}</p>` : ''}
                    </div>
                    <button 
                        onclick="deleteMilestone(${milestone.id})"
                        class="text-red-500 hover:text-red-700 ml-2"
                    >
                        ✕
                    </button>
                </div>
                
                <div class="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    <span>📅 ${dateRange}</span>
                    <span>📝 ${milestone.tasks_count || 0} задач</span>
                </div>
                
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full" style="width: ${milestone.progress || 0}%"></div>
                    </div>
                    <span class="text-xs font-medium">${milestone.progress || 0}%</span>
                </div>
            </div>
        `;
    }).join('');
}

async function addMilestone() {
    const name = document.getElementById('newMilestoneName').value.trim();
    const description = document.getElementById('newMilestoneDescription').value.trim();
    const startDate = document.getElementById('milestoneStartDate').value || null;
    const endDate = document.getElementById('milestoneEndDate').value || null;
    
    if (!name) {
        document.getElementById('newMilestoneName').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/milestones/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ 
                name, 
                description, 
                start_date: startDate, 
                end_date: endDate 
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        document.getElementById('newMilestoneName').value = '';
        document.getElementById('newMilestoneDescription').value = '';
        document.getElementById('milestoneStartDate').value = '';
        document.getElementById('milestoneEndDate').value = '';
        
        await loadMilestones();
        await loadWorkspaceOverview();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка добавления этапа:', error);
        showError('Не удалось добавить этап');
    }
}

async function deleteMilestone(id) {
    try {
        const response = await fetch(`${API_URL}/milestones/${id}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        await loadMilestones();
        await loadWorkspaceOverview();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления этапа:', error);
        showError('Не удалось удалить этап');
    }
}

// ========== ЗАМЕТКИ ПРОЕКТА (вместо документов) ==========

async function loadProjectNotes() {
    if (!currentProject) return;
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/notes/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const notes = await response.json();
        renderProjectNotes(notes);
    } catch (error) {
        console.error('Ошибка загрузки заметок:', error);
        showError('Не удалось загрузить заметки');
    }
}

function renderProjectNotes(notes) {
    const noteList = document.getElementById('projectNoteList');
    
    if (notes.length === 0) {
        noteList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет заметок</p>';
        return;
    }
    
    noteList.innerHTML = notes.map(note => `
        <div class="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-semibold text-gray-800">${escapeHtml(note.title)}</h3>
                <button 
                    onclick="deleteProjectNote(${note.id})"
                    class="text-red-500 hover:text-red-700"
                >
                    ✕
                </button>
            </div>
            <p class="text-sm text-gray-600 whitespace-pre-wrap">${escapeHtml(note.content)}</p>
            <p class="text-xs text-gray-400 mt-2">${new Date(note.created_at).toLocaleString('ru')}</p>
        </div>
    `).join('');
}

async function addProjectNote() {
    const title = document.getElementById('newProjectNoteTitle').value.trim();
    const content = document.getElementById('newProjectNoteContent').value.trim();
    
    if (!title || !content) {
        showError('Заполните заголовок и текст заметки');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/notes/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ title, content, project: currentProject })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        document.getElementById('newProjectNoteTitle').value = '';
        document.getElementById('newProjectNoteContent').value = '';
        
        await loadProjectNotes();
        await loadWorkspaceOverview();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка добавления заметки:', error);
        showError('Не удалось добавить заметку');
    }
}

async function deleteProjectNote(id) {
    try {
        const response = await fetch(`${API_URL}/notes/${id}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        await loadProjectNotes();
        await loadWorkspaceOverview();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления заметки:', error);
        showError('Не удалось удалить заметку');
    }
}

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК WORKSPACE ==========

function switchWorkspaceTab(tab) {
    document.querySelectorAll('.workspace-content').forEach(el => {
        el.classList.add('hidden');
    });
    
    document.querySelectorAll('.ws-tab-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    document.getElementById(`workspace-${tab}`).classList.remove('hidden');
    document.getElementById(`ws-tab-${tab}`).classList.remove('bg-gray-100', 'text-gray-600');
    document.getElementById(`ws-tab-${tab}`).classList.add('bg-blue-500', 'text-white');
    
    switch(tab) {
        case 'overview':
            loadWorkspaceOverview();
            break;
        case 'tasks':
            loadWorkspaceTasks();
            break;
        case 'subprojects':
            loadSubprojects();
            break;
        case 'roadmap':
            loadMilestones();
            break;
        case 'notes':
            loadProjectNotes();
            break;
    }
}

// Показать/скрыть форму задачи в workspace
function toggleWorkspaceTaskForm() {
    const container = document.getElementById('wsTaskFormContainer');
    const btn = document.querySelector('[onclick="toggleWorkspaceTaskForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Добавить задачу</span>';
        document.getElementById('wsNewTaskInput').value = '';
        document.getElementById('wsTaskDeadline').value = '';
    }
}

// Показать/скрыть форму milestone
function toggleMilestoneForm() {
    const container = document.getElementById('milestoneFormContainer');
    const btn = document.querySelector('[onclick="toggleMilestoneForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Создать этап</span>';
        document.getElementById('newMilestoneName').value = '';
        document.getElementById('newMilestoneDescription').value = '';
        document.getElementById('milestoneStartDate').value = '';
        document.getElementById('milestoneEndDate').value = '';
    }
}

// Показать/скрыть форму заметки проекта
function toggleProjectNoteForm() {
    const container = document.getElementById('projectNoteFormContainer');
    const btn = document.querySelector('[onclick="toggleProjectNoteForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Создать заметку</span>';
        document.getElementById('newProjectNoteTitle').value = '';
        document.getElementById('newProjectNoteContent').value = '';
    }
}
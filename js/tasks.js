// Флаг инициализации realtime
// Флаг инициализации realtime
let tasksRealtimeInitialized = false;

// ========== ОТРИСОВКА ЗАДАЧ ==========
function renderTasks(tasks) {
    const container = document.getElementById('taskList');
    
    if (!container) {
        console.error('Элемент taskList не найден');
        return;
    }
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const isOptimistic = task._optimistic;
        const priorityColors = {
            high: 'text-red-500',
            medium: 'text-yellow-500',
            low: 'text-green-500'
        };
        const priorityEmojis = {
            high: '🔴',
            medium: '🟡',
            low: '🟢'
        };
        
        return `
            <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${isOptimistic ? 'opacity-60' : ''}">
                <div class="flex items-start justify-between">
                    <div class="flex items-start gap-3 flex-1">
                        <input 
                            type="checkbox" 
                            ${task.completed ? 'checked' : ''} 
                            ${isOptimistic ? 'disabled' : ''}
                            onchange="toggleTask(${task.id})"
                            class="mt-1 w-5 h-5 rounded border-gray-300 cursor-pointer"
                        >
                        <div class="flex-1">
                            <h3 class="font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}">
                                ${escapeHtml(task.title)}
                                ${isOptimistic ? '<span class="text-xs text-blue-500 ml-2">⏳ Сохранение...</span>' : ''}
                            </h3>
                            ${task.description ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(task.description)}</p>` : ''}
                            
                            <div class="flex gap-2 mt-2 flex-wrap">
                                ${priorityEmojis[task.priority] ? `<span class="text-sm ${priorityColors[task.priority]}">${priorityEmojis[task.priority]}</span>` : ''}
                                ${task.project_name ? `<span class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">📁 ${escapeHtml(task.project_name)}</span>` : ''}
                                ${task.deadline ? `<span class="text-xs px-2 py-1 ${task.is_overdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'} rounded">${formatDeadline(task.deadline, task.is_overdue)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-2 ml-2">
                        ${!isOptimistic ? `
                            <button onclick="openEditTaskModal(${task.id})" class="text-blue-600 hover:text-blue-800">✏️</button>
                            <button onclick="deleteTask(${task.id})" class="text-red-600 hover:text-red-800">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Уведомление о realtime изменениях
function showRealtimeNotification(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ========== ЗАГРУЗКА ЗАДАЧ С REALTIME ==========
async function loadTasks() {
    try {
        // Инициализировать realtime один раз
        if (!tasksRealtimeInitialized) {
            RealtimeSync.subscribe('tasks', (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload;
                
                if (eventType === 'INSERT') {
                    showRealtimeNotification('📥 Новая задача добавлена');
                    loadTasks();
                } else if (eventType === 'UPDATE') {
                    showRealtimeNotification('✏️ Задача обновлена');
                    loadTasks();
                } else if (eventType === 'DELETE') {
                    showRealtimeNotification('🗑️ Задача удалена');
                    loadTasks();
                }
            });
            tasksRealtimeInitialized = true;
        }
        
        const tasks = await TaskAPI.getAll();
        const projects = await ProjectAPI.getAll();
        
        // Применить фильтры
        const filterProject = document.getElementById('filterProject')?.value || '';
        const filterPriority = document.getElementById('filterPriority')?.value || '';
        const filterCompleted = document.getElementById('filterCompleted')?.value || '';
        const searchQuery = document.getElementById('taskSearch')?.value.toLowerCase() || '';
        
        let filtered = tasks;
        
        // Исключить удаляемые задачи
        const deleting = OptimisticCache.get('tasks_deleting').map(d => d.original_id);
        filtered = filtered.filter(t => !deleting.includes(t.id));
        
        // Фильтр по завершённости (ПЕРВЫМ)
        if (filterCompleted === 'true') {
            filtered = filtered.filter(t => t.completed);
        } else if (filterCompleted === 'false') {
            filtered = filtered.filter(t => !t.completed);
        }
        // Если filterCompleted === '' — не фильтруем, показываем все
        
        if (filterProject) {
            filtered = filtered.filter(t => t.project_id == filterProject);
        }
        if (filterPriority) {
            filtered = filtered.filter(t => t.priority === filterPriority);
        }
        if (searchQuery) {
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(searchQuery) ||
                (t.description && t.description.toLowerCase().includes(searchQuery))
            );
        }
        
        renderTasksGrouped(filtered, projects);
        updateTaskCounts(tasks);
        
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        showNotification('Ошибка загрузки задач', 'error');
    }
}


// Отрисовка задач с группировкой по проектам
// Отрисовка задач с группировкой по проектам и подпроектам
// Отрисовка задач с группировкой по проектам и подпроектам
async function renderTasksGrouped(tasks, projects) {
    const container = document.getElementById('taskList');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач</p>';
        return;
    }
    
    // Загрузить ВСЕ подпроекты для всех проектов
    let allSubprojects = [];
    try {
        for (const project of projects) {
            const subprojects = await SubprojectAPI.getAll(project.id);
            allSubprojects = [...allSubprojects, ...subprojects];
        }
    } catch (error) {
        console.error('Ошибка загрузки подпроектов:', error);
    }
    
    // Группировка задач
    const personalTasks = tasks.filter(t => !t.project_id);
    const projectTasksMap = {};
    
    tasks.filter(t => t.project_id).forEach(task => {
        if (!projectTasksMap[task.project_id]) {
            projectTasksMap[task.project_id] = {
                direct: [],
                subprojects: {}
            };
        }
        
        if (task.subproject_id) {
            if (!projectTasksMap[task.project_id].subprojects[task.subproject_id]) {
                projectTasksMap[task.project_id].subprojects[task.subproject_id] = [];
            }
            projectTasksMap[task.project_id].subprojects[task.subproject_id].push(task);
        } else {
            projectTasksMap[task.project_id].direct.push(task);
        }
    });
    
    let html = '';
    
    // 1. Личные задачи
    if (personalTasks.length > 0) {
        html += renderTaskGroup('personal', 'Личные задачи', '📝', personalTasks, null, 0);
    }
    
    // 2. Задачи по проектам с подпроектами
    projects.forEach(project => {
        const projectData = projectTasksMap[project.id];
        if (!projectData) return;
        
        const totalTasks = projectData.direct.length + 
            Object.values(projectData.subprojects).reduce((sum, tasks) => sum + tasks.length, 0);
        
        if (totalTasks === 0) return;
        
        // Заголовок проекта
        html += renderProjectHeader(project, totalTasks);
        
        // Прямые задачи проекта (без подпроекта)
        if (projectData.direct.length > 0) {
            html += renderTaskGroup(`project-${project.id}-direct`, 'Задачи проекта', '📋', projectData.direct, project, 1);
        }
        
        // Задачи подпроектов
        Object.keys(projectData.subprojects).forEach(subprojectId => {
            const subproject = allSubprojects.find(sp => sp.id == subprojectId);
            if (!subproject) return;
            
            const subprojectTasks = projectData.subprojects[subprojectId];
            html += renderTaskGroup(
                `subproject-${subprojectId}`, 
                subproject.name, 
                subproject.icon || '📁', 
                subprojectTasks, 
                null, 
                1
            );
        });
        
        html += '</div>'; // Закрываем проект
    });
    
    container.innerHTML = html || '<p class="text-center text-gray-400 py-8">Нет задач</p>';
}

// Отрисовка заголовка проекта
function renderProjectHeader(project, totalTasks) {
    const isCollapsed = localStorage.getItem(`project_${project.id}_collapsed`) === 'true';
    
    return `
        <div class="border rounded-lg overflow-hidden mb-4">
            <!-- Заголовок проекта -->
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-colors" onclick="toggleProject(${project.id})">
                <div class="flex items-center gap-2">
                    <span id="projectIcon-${project.id}" class="text-white">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="text-2xl">${project.icon}</span>
                    <h3 class="font-bold text-white">${project.name}</h3>
                    <span class="text-sm text-blue-100">(${totalTasks})</span>
                </div>
                <button onclick="event.stopPropagation(); openWorkspace(${project.id})" class="text-white hover:text-blue-100 text-sm">
                    Открыть →
                </button>
            </div>
            
            <!-- Содержимое проекта -->
            <div id="project-${project.id}" class="${isCollapsed ? 'hidden' : ''} bg-gray-50">
    `;
}

// Отрисовка группы задач
function renderTaskGroup(groupId, groupName, groupIcon, tasks, project, indentLevel = 0) {
    const isCollapsed = localStorage.getItem(`taskGroup_${groupId}_collapsed`) === 'true';
    const indent = indentLevel * 20; // 20px на уровень вложенности
    
    let html = `
        <div class="border-b last:border-b-0">
            <!-- Заголовок группы -->
            <div class="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors" 
                 onclick="toggleTaskGroup('${groupId}')"
                 style="padding-left: ${indent + 16}px">
                <div class="flex items-center gap-2">
                    <span id="taskGroupIcon-${groupId}" class="text-sm text-gray-600">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="text-base">${groupIcon}</span>
                    <h4 class="font-medium text-gray-700 text-sm">${groupName}</h4>
                    <span class="text-xs text-gray-500">(${tasks.length})</span>
                </div>
            </div>
            
            <!-- Список задач группы -->
            <div id="taskGroup-${groupId}" class="${isCollapsed ? 'hidden' : ''} bg-white">
    `;
    
    tasks.forEach(task => {
        html += `
            <div class="flex items-start gap-3 p-3 border-t hover:bg-gray-50 transition-colors" style="padding-left: ${indent + 40}px">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''} 
                    onchange="toggleTask(${task.id})"
                    class="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                <div class="flex-1 min-w-0">
                    <h5 class="font-medium text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'} break-words">
                        ${task.title}
                    </h5>
                    ${task.description ? `<p class="text-xs text-gray-600 mt-1 break-words">${task.description}</p>` : ''}
                    
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${task.priority === 'high' ? '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">🔴</span>' : ''}
                        ${task.priority === 'medium' ? '<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">🟡</span>' : ''}
                        ${task.priority === 'low' ? '<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">🟢</span>' : ''}
                        
                        ${task.deadline ? `<span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}</span>` : ''}
                    </div>
                </div>
                
                <div class="flex gap-1 flex-shrink-0">
                    <button onclick="openEditTaskModal(${task.id})" class="text-blue-600 hover:text-blue-800 p-1">✏️</button>
                    <button onclick="deleteTask(${task.id})" class="text-red-600 hover:text-red-800 p-1">🗑️</button>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

// Свернуть/развернуть проект
function toggleProject(projectId) {
    const project = document.getElementById(`project-${projectId}`);
    const icon = document.getElementById(`projectIcon-${projectId}`);
    
    if (project.classList.contains('hidden')) {
        project.classList.remove('hidden');
        icon.textContent = '▼';
        localStorage.setItem(`project_${projectId}_collapsed`, 'false');
    } else {
        project.classList.add('hidden');
        icon.textContent = '▶';
        localStorage.setItem(`project_${projectId}_collapsed`, 'true');
    }
}

// Свернуть/развернуть группу задач
function toggleTaskGroup(groupId) {
    const group = document.getElementById(`taskGroup-${groupId}`);
    const icon = document.getElementById(`taskGroupIcon-${groupId}`);
    
    if (group.classList.contains('hidden')) {
        group.classList.remove('hidden');
        icon.textContent = '▼';
        localStorage.setItem(`taskGroup_${groupId}_collapsed`, 'false');
    } else {
        group.classList.add('hidden');
        icon.textContent = '▶';
        localStorage.setItem(`taskGroup_${groupId}_collapsed`, 'true');
    }
}

// Отрисовка заголовка проекта
function renderProjectHeader(project, totalTasks) {
    const isCollapsed = localStorage.getItem(`project_${project.id}_collapsed`) === 'true';
    
    return `
        <div class="border rounded-lg overflow-hidden mb-4">
            <!-- Заголовок проекта -->
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-colors" onclick="toggleProject(${project.id})">
                <div class="flex items-center gap-2">
                    <span id="projectIcon-${project.id}" class="text-white">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="text-2xl">${project.icon}</span>
                    <h3 class="font-bold text-white">${project.name}</h3>
                    <span class="text-sm text-blue-100">(${totalTasks})</span>
                </div>
                <button onclick="event.stopPropagation(); openWorkspace(${project.id})" class="text-white hover:text-blue-100 text-sm">
                    Открыть →
                </button>
            </div>
            
            <!-- Содержимое проекта -->
            <div id="project-${project.id}" class="${isCollapsed ? 'hidden' : ''} bg-gray-50">
    `;
}

// Отрисовка группы задач
function renderTaskGroup(groupId, groupName, groupIcon, tasks, project, indentLevel = 0) {
    const isCollapsed = localStorage.getItem(`taskGroup_${groupId}_collapsed`) === 'true';
    const indent = indentLevel * 20; // 20px на уровень вложенности
    
    let html = `
        <div class="border-b last:border-b-0">
            <!-- Заголовок группы -->
            <div class="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors" 
                 onclick="toggleTaskGroup('${groupId}')"
                 style="padding-left: ${indent + 16}px">
                <div class="flex items-center gap-2">
                    <span id="taskGroupIcon-${groupId}" class="text-sm text-gray-600">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="text-base">${groupIcon}</span>
                    <h4 class="font-medium text-gray-700 text-sm">${groupName}</h4>
                    <span class="text-xs text-gray-500">(${tasks.length})</span>
                </div>
            </div>
            
            <!-- Список задач группы -->
            <div id="taskGroup-${groupId}" class="${isCollapsed ? 'hidden' : ''} bg-white">
    `;
    
    tasks.forEach(task => {
        html += `
            <div class="flex items-start gap-3 p-3 border-t hover:bg-gray-50 transition-colors" style="padding-left: ${indent + 40}px">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''} 
                    onchange="toggleTask(${task.id})"
                    class="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                <div class="flex-1 min-w-0">
                    <h5 class="font-medium text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'} break-words">
                        ${task.title}
                    </h5>
                    ${task.description ? `<p class="text-xs text-gray-600 mt-1 break-words">${task.description}</p>` : ''}
                    
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${task.priority === 'high' ? '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">🔴</span>' : ''}
                        ${task.priority === 'medium' ? '<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">🟡</span>' : ''}
                        ${task.priority === 'low' ? '<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">🟢</span>' : ''}
                        
                        ${task.deadline ? `<span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}</span>` : ''}
                    </div>
                </div>
                
                <div class="flex gap-1 flex-shrink-0">
                    <button onclick="openEditTaskModal(${task.id})" class="text-blue-600 hover:text-blue-800 p-1">✏️</button>
                    <button onclick="deleteTask(${task.id})" class="text-red-600 hover:text-red-800 p-1">🗑️</button>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

// Свернуть/развернуть проект
function toggleProject(projectId) {
    const project = document.getElementById(`project-${projectId}`);
    const icon = document.getElementById(`projectIcon-${projectId}`);
    
    if (project.classList.contains('hidden')) {
        project.classList.remove('hidden');
        icon.textContent = '▼';
        localStorage.setItem(`project_${projectId}_collapsed`, 'false');
    } else {
        project.classList.add('hidden');
        icon.textContent = '▶';
        localStorage.setItem(`project_${projectId}_collapsed`, 'true');
    }
}

// Свернуть/развернуть группу задач
function toggleTaskGroup(groupId) {
    const group = document.getElementById(`taskGroup-${groupId}`);
    const icon = document.getElementById(`taskGroupIcon-${groupId}`);
    
    if (group.classList.contains('hidden')) {
        group.classList.remove('hidden');
        icon.textContent = '▼';
        localStorage.setItem(`taskGroup_${groupId}_collapsed`, 'false');
    } else {
        group.classList.add('hidden');
        icon.textContent = '▶';
        localStorage.setItem(`taskGroup_${groupId}_collapsed`, 'true');
    }
}

// Добавить задачу
// Добавить задачу
async function addTask() {
    const input = document.getElementById('newTaskInput');
    const title = input.value.trim();
    
    if (!title) {
        showNotification('Введите название задачи', 'error');
        return;
    }
    
    const projectId = document.getElementById('taskProject')?.value || null;
    const priority = document.getElementById('taskPriority')?.value || 'medium';
    let deadline = document.getElementById('taskDeadline')?.value || null;
    
    // Установить время 23:59:59 для дедлайна
    if (deadline) {
        deadline = setEndOfDay(deadline);
    }
    
    try {
        await TaskAPI.create({
            title,
            project_id: projectId ? parseInt(projectId) : null,
            priority,
            deadline,
            status: 'todo',
            completed: false
        });
        
        input.value = '';
        document.getElementById('taskDeadline').value = '';
        
        showNotification('Задача добавлена', 'success');
        await loadTasks();
        
        toggleTaskForm();
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showNotification('Ошибка добавления задачи', 'error');
    }
}

// Функция установки времени на конец дня
function setEndOfDay(dateString) {
    const date = new Date(dateString);
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
}

// Кнопки быстрого выбора даты
function setTaskDeadlineToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskDeadline').value = today;
}

function setTaskDeadlineTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('taskDeadline').value = tomorrow.toISOString().split('T')[0];
}

function clearTaskDeadline() {
    document.getElementById('taskDeadline').value = '';
}

// Переключить статус задачи
// Отметить задачу выполненной
async function toggleTask(id) {
    try {
        const tasks = await TaskAPI.getAll();
        const task = tasks.find(t => t.id === id);
        
        if (!task) return;
        
        await TaskAPI.update(id, { 
            completed: !task.completed,
            completed_at: !task.completed ? new Date().toISOString() : null
        });
        
        hapticFeedback('light');
        await loadTasks();
    } catch (error) {
        console.error('Ошибка переключения задачи:', error);
        if (error.type !== 'CONFLICT') {
            showNotification('Ошибка обновления задачи', 'error');
        }
    }
}

// Удалить задачу
async function deleteTask(id) {
    if (!confirm('Удалить задачу?')) return;
    
    try {
        await TaskAPI.delete(id);
        hapticFeedback('success');
        showNotification('Задача удалена', 'success');
    } catch (error) {
        console.error('Ошибка удаления:', error);
    }
}

// Открыть модальное окно редактирования
async function openEditTaskModal(id) {
    try {
        const tasks = await TaskAPI.getAll();
        const task = tasks.find(t => t.id === id);
        
        if (!task) return;
        
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDescription').value = task.description || '';
        document.getElementById('editTaskPriority').value = task.priority;
        
        // Только дата без времени
        if (task.deadline) {
            const date = new Date(task.deadline).toISOString().split('T')[0];
            document.getElementById('editTaskDeadline').value = date;
        } else {
            document.getElementById('editTaskDeadline').value = '';
        }
        
        document.getElementById('editTaskModal').classList.remove('hidden');
    } catch (error) {
        console.error('Ошибка открытия модального окна:', error);
    }
}

// Сохранить изменения задачи
// Сохранить изменения задачи
async function saveTaskEdit() {
    const id = parseInt(document.getElementById('editTaskId').value);
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    let deadline = document.getElementById('editTaskDeadline').value || null;
    
    if (!title) {
        showNotification('Введите название задачи', 'error');
        return;
    }
    
    // Установить время 23:59:59 для дедлайна
    if (deadline) {
        deadline = setEndOfDay(deadline);
    }
    
    try {
        await TaskAPI.update(id, {
            title,
            description,
            priority,
            deadline
        });
        
        closeEditTaskModal();
        showNotification('Задача обновлена', 'success');
        await loadTasks();
    } catch (error) {
        console.error('Ошибка сохранения задачи:', error);
        showNotification('Ошибка сохранения задачи', 'error');
    }
}

// Закрыть модальное окно
function closeEditTaskModal() {
    document.getElementById('editTaskModal').classList.add('hidden');
}

// Обновить счётчики
function updateTaskCounts(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    
    document.getElementById('taskCount').textContent = `Всего: ${total}`;
    document.getElementById('completedCount').textContent = `Выполнено: ${completed}`;
}

// Показать/скрыть фильтры
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

// Показать/скрыть форму
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
        document.getElementById('newTaskInput').value = '';
        document.getElementById('taskDeadline').value = '';
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Быстрый выбор даты в модальном окне редактирования
function setEditDeadlineToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('editTaskDeadline').value = today;
}

function setEditDeadlineTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('editTaskDeadline').value = tomorrow.toISOString().split('T')[0];
}

function clearEditDeadline() {
    document.getElementById('editTaskDeadline').value = '';
}

// ========== РАЗРЕШЕНИЕ КОНФЛИКТОВ ==========
let currentConflict = null;

window.handleTaskConflict = async function(taskId, latest, attempted) {
    currentConflict = { taskId, latest, attempted };
    
    // Заполнить данные
    document.getElementById('conflictYourVersion').innerHTML = `
        <p><strong>Название:</strong> ${attempted.title || latest.title}</p>
        ${attempted.description ? `<p><strong>Описание:</strong> ${attempted.description}</p>` : ''}
        ${attempted.priority ? `<p><strong>Приоритет:</strong> ${attempted.priority}</p>` : ''}
    `;
    
    document.getElementById('conflictTheirVersion').innerHTML = `
        <p><strong>Название:</strong> ${latest.title}</p>
        ${latest.description ? `<p><strong>Описание:</strong> ${latest.description}</p>` : ''}
        <p><strong>Приоритет:</strong> ${latest.priority}</p>
        <p class="text-xs text-gray-500 mt-2">Изменено: ${new Date(latest.updated_at).toLocaleString('ru-RU')}</p>
    `;
    
    // Показать модальное окно
    document.getElementById('conflictModal').classList.remove('hidden');
};

window.resolveConflict = async function(resolution) {
    if (!currentConflict) return;
    
    const { taskId, latest, attempted } = currentConflict;
    
    if (resolution === 'cancel') {
        // Ничего не делать
        document.getElementById('conflictModal').classList.add('hidden');
        currentConflict = null;
        await loadTasks(); // Обновить UI
        return;
    }
    
    if (resolution === 'theirs') {
        // Принять их версию
        document.getElementById('conflictModal').classList.add('hidden');
        currentConflict = null;
        await loadTasks(); // Просто обновить UI
        showNotification('Принята версия другого пользователя', 'info');
        return;
    }
    
    if (resolution === 'mine') {
        // Принудительно сохранить свою версию
        try {
            const { data, error } = await supabaseClient
                .from('tasks')
                .update({ ...attempted, version: latest.version + 1 })
                .eq('id', taskId)
                .select()
                .single();
            
            if (error) throw error;
            
            document.getElementById('conflictModal').classList.add('hidden');
            currentConflict = null;
            await loadTasks();
            showNotification('Ваши изменения сохранены', 'success');
        } catch (error) {
            console.error('Ошибка принудительного сохранения:', error);
            showNotification('Ошибка сохранения', 'error');
        }
    }
};
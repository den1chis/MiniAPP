// Загрузка задач с группировкой
async function loadTasks() {
    try {
        const tasks = await TaskAPI.getAll();
        const projects = await ProjectAPI.getAll();
        
        // Применяем фильтры
        const filterProject = document.getElementById('filterProject')?.value || '';
        const filterPriority = document.getElementById('filterPriority')?.value || '';
        const filterCompleted = document.getElementById('filterCompleted')?.value || '';
        
        let filtered = tasks;
        
        // По умолчанию скрываем завершённые
        if (filterCompleted === 'false') {
            filtered = filtered.filter(t => !t.completed);
        } else if (filterCompleted === 'true') {
            filtered = filtered.filter(t => t.completed);
        }
        
        if (filterProject) {
            filtered = filtered.filter(t => t.project_id == filterProject);
        }
        if (filterPriority) {
            filtered = filtered.filter(t => t.priority === filterPriority);
        }
        
        renderTasksGrouped(filtered, projects);
        updateTaskCounts(tasks);
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        showNotification('Ошибка загрузки задач', 'error');
    }
}

// Отрисовка задач с группировкой по проектам
function renderTasksGrouped(tasks, projects) {
    const container = document.getElementById('taskList');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач</p>';
        return;
    }
    
    // Группировка задач
    const personalTasks = tasks.filter(t => !t.project_id);
    const projectTasksMap = {};
    
    tasks.filter(t => t.project_id).forEach(task => {
        if (!projectTasksMap[task.project_id]) {
            projectTasksMap[task.project_id] = [];
        }
        projectTasksMap[task.project_id].push(task);
    });
    
    let html = '';
    
    // 1. Личные задачи
    if (personalTasks.length > 0) {
        html += renderTaskGroup('personal', 'Личные задачи', '📝', personalTasks, null);
    }
    
    // 2. Задачи по проектам
    projects.forEach(project => {
        const projectTasks = projectTasksMap[project.id] || [];
        if (projectTasks.length > 0) {
            html += renderTaskGroup(`project-${project.id}`, project.name, project.icon, projectTasks, project);
        }
    });
    
    container.innerHTML = html || '<p class="text-center text-gray-400 py-8">Нет задач</p>';
}

// Отрисовка группы задач
function renderTaskGroup(groupId, groupName, groupIcon, tasks, project) {
    const isCollapsed = localStorage.getItem(`taskGroup_${groupId}_collapsed`) === 'true';
    
    let html = `
        <div class="border rounded-lg overflow-hidden">
            <!-- Заголовок группы -->
            <div class="bg-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors" onclick="toggleTaskGroup('${groupId}')">
                <div class="flex items-center gap-2">
                    <span id="taskGroupIcon-${groupId}" class="text-sm">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="text-lg">${groupIcon}</span>
                    <h3 class="font-semibold text-gray-800">${groupName}</h3>
                    <span class="text-sm text-gray-600">(${tasks.length})</span>
                </div>
            </div>
            
            <!-- Список задач группы -->
            <div id="taskGroup-${groupId}" class="${isCollapsed ? 'hidden' : ''} p-3 space-y-2 bg-white">
    `;
    
    tasks.forEach(task => {
        html += `
            <div class="flex items-start gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''} 
                    onchange="toggleTask(${task.id})"
                    class="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                >
                <div class="flex-1">
                    <h4 class="font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}">
                        ${task.title}
                    </h4>
                    ${task.description ? `<p class="text-sm text-gray-600 mt-1">${task.description}</p>` : ''}
                    
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${task.priority === 'high' ? '<span class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">🔴 Высокий</span>' : ''}
                        ${task.priority === 'medium' ? '<span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">🟡 Средний</span>' : ''}
                        ${task.priority === 'low' ? '<span class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">🟢 Низкий</span>' : ''}
                        
                        ${task.deadline ? `<span class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}</span>` : ''}
                    </div>
                </div>
                
                <div class="flex gap-2">
                    <button onclick="openEditTaskModal(${task.id})" class="text-blue-600 hover:text-blue-800">✏️</button>
                    <button onclick="deleteTask(${task.id})" class="text-red-600 hover:text-red-800">🗑️</button>
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
async function addTask() {
    const input = document.getElementById('newTaskInput');
    const title = input.value.trim();
    
    if (!title) {
        showNotification('Введите название задачи', 'error');
        return;
    }
    
    const projectId = document.getElementById('taskProject')?.value || null;
    const priority = document.getElementById('taskPriority')?.value || 'medium';
    const deadline = document.getElementById('taskDeadline')?.value || null;
    
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
        
        // Закрыть форму после добавления
        toggleTaskForm();
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showNotification('Ошибка добавления задачи', 'error');
    }
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
async function toggleTask(id) {
    try {
        const tasks = await TaskAPI.getAll();
        const task = tasks.find(t => t.id === id);
        
        if (task) {
            const newCompleted = !task.completed;
            await TaskAPI.update(id, { 
                completed: newCompleted,
                completed_at: newCompleted ? new Date().toISOString() : null
            });
            await loadTasks();
        }
    } catch (error) {
        console.error('Ошибка обновления задачи:', error);
        showNotification('Ошибка обновления задачи', 'error');
    }
}

// Удалить задачу
async function deleteTask(id) {
    if (!confirm('Удалить задачу?')) return;
    
    try {
        await TaskAPI.delete(id);
        showNotification('Задача удалена', 'success');
        await loadTasks();
    } catch (error) {
        console.error('Ошибка удаления задачи:', error);
        showNotification('Ошибка удаления задачи', 'error');
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
async function saveTaskEdit() {
    const id = parseInt(document.getElementById('editTaskId').value);
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    const deadline = document.getElementById('editTaskDeadline').value || null;
    
    if (!title) {
        showNotification('Введите название задачи', 'error');
        return;
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
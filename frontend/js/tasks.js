// Загрузка задач
async function loadTasks() {
    try {
        const tasks = await TaskAPI.getAll();
        
        // Применяем фильтры
        const filterProject = document.getElementById('filterProject')?.value || '';
        const filterPriority = document.getElementById('filterPriority')?.value || '';
        const filterCompleted = document.getElementById('filterCompleted')?.value || '';
        
        let filtered = tasks;
        
        if (filterProject) {
            filtered = filtered.filter(t => t.project_id == filterProject);
        }
        if (filterPriority) {
            filtered = filtered.filter(t => t.priority === filterPriority);
        }
        if (filterCompleted !== '') {
            const isCompleted = filterCompleted === 'true';
            filtered = filtered.filter(t => t.completed === isCompleted);
        }
        
        renderTasks(filtered);
        updateTaskCounts(tasks);
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        showNotification('Ошибка загрузки задач', 'error');
    }
}

// Отрисовка задач
function renderTasks(tasks) {
    const container = document.getElementById('taskList');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start gap-3">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''} 
                    onchange="toggleTask(${task.id})"
                    class="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                >
                <div class="flex-1">
                    <h3 class="font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}">
                        ${task.title}
                    </h3>
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
        </div>
    `).join('');
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

// Переключить статус задачи
async function toggleTask(id) {
    try {
        const tasks = await TaskAPI.getAll();
        const task = tasks.find(t => t.id === id);
        
        if (task) {
            await TaskAPI.update(id, { completed: !task.completed });
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
        document.getElementById('editTaskDeadline').value = task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '';
        
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
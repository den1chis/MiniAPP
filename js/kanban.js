// Загрузка канбана
async function loadKanban() {
    try {
        const tasks = await TaskAPI.getAll();
        
        // Применяем фильтры
        const filterProject = document.getElementById('kanbanFilterProject')?.value || '';
        const filterSubproject = document.getElementById('kanbanFilterSubproject')?.value || '';
        const filterPriority = document.getElementById('kanbanFilterPriority')?.value || '';
        
        let filtered = tasks;
        
        if (filterProject) {
            filtered = filtered.filter(t => t.project_id == filterProject);
        }
        if (filterSubproject) {
            filtered = filtered.filter(t => t.subproject_id == filterSubproject);
        }
        if (filterPriority) {
            filtered = filtered.filter(t => t.priority === filterPriority);
        }
        
        renderKanban(filtered);
        await updateKanbanFilters();
    } catch (error) {
        console.error('Ошибка загрузки канбана:', error);
        showNotification('Ошибка загрузки канбана', 'error');
    }
}

// Отрисовка канбана
function renderKanban(tasks) {
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const doneTasks = tasks.filter(t => t.status === 'done');
    
    document.getElementById('kanban-todo-count').textContent = todoTasks.length;
    document.getElementById('kanban-progress-count').textContent = inProgressTasks.length;
    document.getElementById('kanban-done-count').textContent = doneTasks.length;
    
    renderKanbanColumn('kanban-todo', todoTasks);
    renderKanbanColumn('kanban-in_progress', inProgressTasks);
    renderKanbanColumn('kanban-done', doneTasks);
}

// Отрисовка колонки канбана
function renderKanbanColumn(columnId, tasks) {
    const container = document.getElementById(columnId);
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Нет задач</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="bg-white border rounded-lg p-3 cursor-move hover:shadow-md transition-shadow" draggable="true" ondragstart="dragStart(event, ${task.id})" ondragend="dragEnd(event)">
            <div class="flex items-start justify-between mb-2">
                <h4 class="font-medium text-sm text-gray-800 flex-1">${task.title}</h4>
                <div class="flex gap-1">
                    ${task.priority === 'high' ? '<span class="text-red-500">🔴</span>' : ''}
                    ${task.priority === 'medium' ? '<span class="text-yellow-500">🟡</span>' : ''}
                    ${task.priority === 'low' ? '<span class="text-green-500">🟢</span>' : ''}
                </div>
            </div>
            ${task.deadline ? `<p class="text-xs text-gray-500">📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}</p>` : ''}
        </div>
    `).join('');
}

// Обновить фильтры канбана
async function updateKanbanFilters() {
    try {
        const projects = await ProjectAPI.getAll();
        
        const projectSelect = document.getElementById('kanbanFilterProject');
        if (projectSelect) {
            const currentValue = projectSelect.value;
            const defaultOption = projectSelect.querySelector('option[value=""]');
            
            projectSelect.innerHTML = '';
            if (defaultOption) projectSelect.appendChild(defaultOption.cloneNode(true));
            
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = `${project.icon} ${project.name}`;
                projectSelect.appendChild(option);
            });
            
            projectSelect.value = currentValue;
        }
    } catch (error) {
        console.error('Ошибка обновления фильтров:', error);
    }
}

// Drag & Drop
let draggedTaskId = null;

function dragStart(event, taskId) {
    draggedTaskId = taskId;
    event.target.style.opacity = '0.5';
}

function dragEnd(event) {
    event.target.style.opacity = '1';
}

// Разрешить drop
function allowDrop(event) {
    event.preventDefault();
}

// Drop задачи
async function dropTask(event, newStatus) {
    event.preventDefault();
    
    if (!draggedTaskId) return;
    
    try {
        await TaskAPI.update(draggedTaskId, { status: newStatus });
        showNotification('Статус обновлён', 'success');
        await loadKanban();
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        showNotification('Ошибка обновления статуса', 'error');
    }
    
    draggedTaskId = null;
}

// Показать/скрыть фильтры
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

// Очистить фильтры
function clearKanbanFilters() {
    document.getElementById('kanbanFilterProject').value = '';
    document.getElementById('kanbanFilterSubproject').value = '';
    document.getElementById('kanbanFilterPriority').value = '';
    loadKanban();
}

// Добавить drop zones для колонок
document.addEventListener('DOMContentLoaded', () => {
    const columns = ['kanban-todo', 'kanban-in_progress', 'kanban-done'];
    const statuses = ['todo', 'in_progress', 'done'];
    
    columns.forEach((columnId, index) => {
        const column = document.getElementById(columnId);
        if (column) {
            column.parentElement.addEventListener('dragover', allowDrop);
            column.parentElement.addEventListener('drop', (e) => dropTask(e, statuses[index]));
        }
    });
});
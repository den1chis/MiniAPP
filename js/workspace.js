// ========== WORKSPACE: ОБЩИЕ ФУНКЦИИ ==========
// В самое начало файла добавьте:

// Переключение табов workspace
function switchWorkspaceTab(tab) {
    // Скрыть все контенты
    document.querySelectorAll('.workspace-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Убрать активность со всех табов
    document.querySelectorAll('.ws-tab-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    // Показать нужный контент
    const content = document.getElementById(`workspace-${tab}`);
    if (content) {
        content.classList.remove('hidden');
    }
    
    // Активировать таб
    const activeTab = document.getElementById(`ws-tab-${tab}`);
    if (activeTab) {
        activeTab.classList.remove('bg-gray-100', 'text-gray-600');
        activeTab.classList.add('bg-blue-500', 'text-white');
    }
    
    // Загрузить данные для таба
    if (tab === 'overview') {
        loadWorkspaceStats();
    } else if (tab === 'tasks') {
        loadWorkspaceTasks();
    } else if (tab === 'subprojects') {
        loadSubprojects();
    } else if (tab === 'roadmap') {
        loadMilestones();
    } else if (tab === 'notes') {
        loadProjectNotes();
    }
}
// Загрузка данных workspace
async function loadWorkspaceData() {
    await loadWorkspaceStats();
    await loadWorkspaceTasks();
    await loadSubprojects();
    await loadMilestones();
    await loadProjectNotes();
}

// Загрузка статистики проекта
async function loadWorkspaceStats() {
    try {
        const tasks = await TaskAPI.getAll();
        const projectTasks = tasks.filter(t => t.project_id === window.currentProjectId);
        
        const milestones = await MilestoneAPI.getAll(window.currentProjectId);
        const projectNotes = await ProjectNoteAPI.getAll(window.currentProjectId);
        
        const total = projectTasks.length;
        const completed = projectTasks.filter(t => t.completed).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        document.getElementById('ws-total-tasks').textContent = total;
        document.getElementById('ws-completed-tasks').textContent = completed;
        document.getElementById('ws-milestones-count').textContent = milestones.length;
        document.getElementById('ws-notes-count').textContent = projectNotes.length;
        
        document.getElementById('ws-progress-text').textContent = `${progress}%`;
        document.getElementById('ws-progress-bar').style.width = `${progress}%`;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// ========== WORKSPACE: ЗАДАЧИ ==========

// Загрузка задач workspace
// Загрузка задач workspace с учётом прав
async function loadWorkspaceTasks() {
    try {
        const userId = getUserId();
        const canView = await MemberPermissionAPI.canAccess(window.currentProjectId, userId, 'tasks');
        
        if (!canView) {
            document.getElementById('wsTaskList').innerHTML = '<p class="text-center text-gray-400 py-8">Нет доступа к задачам</p>';
            return;
        }
        
        const tasks = await TaskAPI.getAll();
        
        const filterMilestone = document.getElementById('wsFilterMilestone')?.value || '';
        const filterPriority = document.getElementById('wsFilterPriority')?.value || '';
        
        let filtered = tasks.filter(t => t.project_id === window.currentProjectId);
        
        if (filterMilestone) {
            filtered = filtered.filter(t => t.milestone_id == filterMilestone);
        }
        if (filterPriority) {
            filtered = filtered.filter(t => t.priority === filterPriority);
        }
        
        renderWorkspaceTasks(filtered);
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        showNotification('Ошибка загрузки задач', 'error');
    }
}

// Отрисовка задач workspace
function renderWorkspaceTasks(tasks) {
    const container = document.getElementById('wsTaskList');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач в проекте</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="bg-white border rounded-lg p-3 hover:shadow-sm transition-shadow">
            <div class="flex items-start gap-2">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''} 
                    onchange="toggleTask(${task.id}); loadWorkspaceStats();"
                    class="mt-1 w-4 h-4 rounded"
                >
                <div class="flex-1">
                    <p class="font-medium text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}">
                        ${task.title}
                    </p>
                    ${task.description ? `<p class="text-xs text-gray-600 mt-1">${task.description}</p>` : ''}
                    <div class="flex gap-2 mt-1 flex-wrap">
                        ${task.priority === 'high' ? '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">🔴 Высокий</span>' : ''}
                        ${task.priority === 'medium' ? '<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">🟡 Средний</span>' : ''}
                        ${task.priority === 'low' ? '<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">🟢 Низкий</span>' : ''}
                        ${task.deadline ? `<span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}</span>` : ''}
                    </div>
                </div>
                <button onclick="deleteTask(${task.id}); loadWorkspaceTasks(); loadWorkspaceStats();" class="text-red-600 hover:text-red-800 text-sm">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Добавить задачу в workspace
// В функции addWorkspaceTask добавьте:
async function addWorkspaceTask() {
    const input = document.getElementById('wsNewTaskInput');
    const title = input.value.trim();
    
    if (!title) {
        showNotification('Введите название задачи', 'error');
        return;
    }
    
    const milestoneId = document.getElementById('wsTaskMilestone')?.value || null;
    const priority = document.getElementById('wsTaskPriority')?.value || 'medium';
    let deadline = document.getElementById('wsTaskDeadline')?.value || null;
    
    // Установить время 23:59:59
    if (deadline) {
        deadline = setEndOfDay(deadline);
    }
    
    try {
        await TaskAPI.create({
            title,
            project_id: window.currentProjectId,
            milestone_id: milestoneId ? parseInt(milestoneId) : null,
            priority,
            deadline,
            status: 'todo',
            completed: false
        });
        
        input.value = '';
        document.getElementById('wsTaskDeadline').value = '';
        
        showNotification('Задача добавлена', 'success');
        await loadWorkspaceTasks();
        await loadWorkspaceStats();
        
        toggleWorkspaceTaskForm();
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showNotification('Ошибка добавления задачи', 'error');
    }
}

// Обновить выпадающий список этапов
async function updateMilestoneSelect() {
    try {
        const milestones = await MilestoneAPI.getAll(window.currentProjectId);
        
        const selects = ['wsTaskMilestone', 'wsFilterMilestone'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const currentValue = select.value;
            const defaultOption = select.querySelector('option[value=""]');
            
            select.innerHTML = '';
            if (defaultOption) {
                select.appendChild(defaultOption.cloneNode(true));
            }
            
            milestones.forEach(milestone => {
                const option = document.createElement('option');
                option.value = milestone.id;
                option.textContent = milestone.name;
                select.appendChild(option);
            });
            
            select.value = currentValue;
        });
    } catch (error) {
        console.error('Ошибка обновления списка этапов:', error);
    }
}

// Показать/скрыть форму задачи workspace
async function toggleWorkspaceTaskForm() {
    const userId = getUserId();
    const canEdit = await MemberPermissionAPI.canAccess(window.currentProjectId, userId, 'tasks', null, true);
    
    if (!canEdit) {
        showNotification('У вас нет прав на добавление задач', 'error');
        return;
    }
    
    const container = document.getElementById('wsTaskFormContainer');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

// ========== WORKSPACE: ПОДПРОЕКТЫ ==========

// Загрузка подпроектов
async function loadSubprojects() {
    try {
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        renderSubprojects(subprojects);
    } catch (error) {
        console.error('Ошибка загрузки подпроектов:', error);
        showNotification('Ошибка загрузки подпроектов', 'error');
    }
}

// Отрисовка подпроектов
function renderSubprojects(subprojects) {
    const container = document.getElementById('subprojectList');
    
    if (!subprojects || subprojects.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет подпроектов</p>';
        return;
    }
    
    container.innerHTML = subprojects.map(sp => `
        <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onclick="openSubprojectDetail(${sp.id})">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${sp.icon || '📁'}</span>
                    <div>
                        <h3 class="font-bold text-gray-800">${sp.name}</h3>
                        ${sp.description ? `<p class="text-sm text-gray-600">${sp.description}</p>` : ''}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); deleteSubproject(${sp.id})" class="text-red-600 hover:text-red-800">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Добавить подпроект
async function addSubproject() {
    const name = document.getElementById('newSubprojectName').value.trim();
    const description = document.getElementById('newSubprojectDescription').value.trim();
    const icon = document.getElementById('newSubprojectIcon').value.trim() || '📁';
    const color = document.getElementById('newSubprojectColor').value;
    
    if (!name) {
        showNotification('Введите название подпроекта', 'error');
        return;
    }
    
    try {
        await SubprojectAPI.create({
            project_id: window.currentProjectId,
            name,
            description,
            icon,
            color
        });
        
        document.getElementById('newSubprojectName').value = '';
        document.getElementById('newSubprojectDescription').value = '';
        document.getElementById('newSubprojectIcon').value = '';
        document.getElementById('newSubprojectColor').value = '#3B82F6';
        
        showNotification('Подпроект создан', 'success');
        await loadSubprojects();
        
        toggleSubprojectForm();
    } catch (error) {
        console.error('Ошибка создания подпроекта:', error);
        showNotification('Ошибка создания подпроекта', 'error');
    }
}

// Удалить подпроект
async function deleteSubproject(id) {
    if (!confirm('Удалить подпроект?')) return;
    
    try {
        await SubprojectAPI.delete(id);
        showNotification('Подпроект удалён', 'success');
        await loadSubprojects();
    } catch (error) {
        console.error('Ошибка удаления подпроекта:', error);
        showNotification('Ошибка удаления подпроекта', 'error');
    }
}

// Показать/скрыть форму подпроекта
function toggleSubprojectForm() {
    const container = document.getElementById('subprojectFormContainer');
    const btn = document.querySelector('[onclick="toggleSubprojectForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Создать подпроект</span>';
        document.getElementById('newSubprojectName').value = '';
        document.getElementById('newSubprojectDescription').value = '';
        document.getElementById('newSubprojectIcon').value = '';
        document.getElementById('newSubprojectColor').value = '#3B82F6';
    }
}

// ========== WORKSPACE: ROADMAP ==========

// Загрузка milestones
async function loadMilestones() {
    try {
        const milestones = await MilestoneAPI.getAll(window.currentProjectId);
        renderMilestones(milestones);
    } catch (error) {
        console.error('Ошибка загрузки этапов:', error);
        showNotification('Ошибка загрузки этапов', 'error');
    }
}

// Отрисовка milestones
// Отрисовка milestones
function renderMilestones(milestones) {
    const container = document.getElementById('milestoneList');
    
    if (!milestones || milestones.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет этапов. Создайте первый!</p>';
        return;
    }
    
    container.innerHTML = milestones.map((m, index) => {
        // Рассчитать прогресс этапа
        const now = new Date();
        const start = m.start_date ? new Date(m.start_date) : null;
        const end = m.end_date ? new Date(m.end_date) : null;
        
        let progress = 0;
        let daysLeft = null;
        let isOverdue = false;
        
        if (start && end) {
            const total = end - start;
            const elapsed = now - start;
            progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
            
            if (now > end && !m.completed) {
                isOverdue = true;
            }
            
            daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        }
        
        return `
            <div class="bg-white border rounded-lg p-4 ${isOverdue ? 'border-red-300' : ''}">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-start gap-3 flex-1">
                        <div class="flex flex-col items-center">
                            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                                ${index + 1}
                            </div>
                            ${index < milestones.length - 1 ? '<div class="w-0.5 h-8 bg-gray-300 mt-2"></div>' : ''}
                        </div>
                        
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <input 
                                    type="checkbox" 
                                    ${m.completed ? 'checked' : ''} 
                                    onchange="toggleMilestone(${m.id})"
                                    class="w-5 h-5"
                                >
                                <h3 class="font-bold text-gray-800 ${m.completed ? 'line-through text-gray-400' : ''}">
                                    ${m.name}
                                </h3>
                                ${m.completed ? '<span class="text-green-600 text-sm">✅ Завершено</span>' : ''}
                                ${isOverdue ? '<span class="text-red-600 text-sm">⚠️ Просрочено</span>' : ''}
                            </div>
                            
                            ${m.description ? `<p class="text-sm text-gray-600 mb-2">${m.description}</p>` : ''}
                            
                            <!-- Даты -->
                            ${start || end ? `
                                <div class="flex flex-wrap gap-3 text-sm text-gray-600 mb-2">
                                    ${start ? `<span>📅 Начало: <strong>${new Date(start).toLocaleDateString('ru-RU')}</strong></span>` : ''}
                                    ${end ? `<span>🏁 Конец: <strong>${new Date(end).toLocaleDateString('ru-RU')}</strong></span>` : ''}
                                    ${daysLeft !== null && !m.completed ? `
                                        <span class="${daysLeft < 0 ? 'text-red-600' : daysLeft < 7 ? 'text-orange-600' : 'text-blue-600'}">
                                            ⏱️ ${daysLeft < 0 ? `Просрочено на ${Math.abs(daysLeft)} дн.` : `Осталось ${daysLeft} дн.`}
                                        </span>
                                    ` : ''}
                                </div>
                            ` : ''}
                            
                            <!-- Прогресс по времени -->
                            ${start && end && !m.completed ? `
                                <div class="mb-2">
                                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>Прогресс по времени</span>
                                        <span>${Math.round(progress)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-2">
                                        <div class="h-2 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-blue-500'}" style="width: ${Math.min(100, progress)}%"></div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            <!-- Задачи этапа -->
                            <div class="mt-2">
                                <button onclick="showMilestoneTasks(${m.id})" class="text-sm text-blue-600 hover:text-blue-800">
                                    📋 Задачи этапа
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="editMilestone(${m.id})" class="text-blue-600 hover:text-blue-800">✏️</button>
                        <button onclick="deleteMilestone(${m.id})" class="text-red-600 hover:text-red-800">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Показать задачи этапа
async function showMilestoneTasks(milestoneId) {
    try {
        const tasks = await TaskAPI.getAll();
        const milestoneTasks = tasks.filter(t => t.milestone_id === milestoneId && t.project_id === window.currentProjectId);
        
        if (milestoneTasks.length === 0) {
            showNotification('В этом этапе пока нет задач', 'info');
            return;
        }
        
        const completed = milestoneTasks.filter(t => t.completed).length;
        const total = milestoneTasks.length;
        
        let message = `Задачи этапа (${completed}/${total}):\n\n`;
        milestoneTasks.forEach(t => {
            message += `${t.completed ? '✅' : '⬜'} ${t.title}\n`;
        });
        
        alert(message);
    } catch (error) {
        console.error('Ошибка загрузки задач этапа:', error);
    }
}

// Редактировать milestone (добавьте в конец workspace.js)
async function editMilestone(id) {
    try {
        const milestones = await MilestoneAPI.getAll(window.currentProjectId);
        const milestone = milestones.find(m => m.id === id);
        
        if (!milestone) return;
        
        document.getElementById('newMilestoneName').value = milestone.name;
        document.getElementById('newMilestoneDescription').value = milestone.description || '';
        document.getElementById('milestoneStartDate').value = milestone.start_date || '';
        document.getElementById('milestoneEndDate').value = milestone.end_date || '';
        
        // Показать форму
        const container = document.getElementById('milestoneFormContainer');
        container.classList.remove('hidden');
        
        // Изменить кнопку на "Обновить"
        const btn = container.querySelector('button[onclick="addMilestone()"]');
        btn.textContent = 'Обновить этап';
        btn.setAttribute('onclick', `updateMilestone(${id})`);
        
    } catch (error) {
        console.error('Ошибка открытия редактирования:', error);
    }
}

// Обновить milestone (добавьте в конец workspace.js)
async function updateMilestone(id) {
    const name = document.getElementById('newMilestoneName').value.trim();
    const description = document.getElementById('newMilestoneDescription').value.trim();
    const startDate = document.getElementById('milestoneStartDate').value || null;
    const endDate = document.getElementById('milestoneEndDate').value || null;
    
    if (!name) {
        showNotification('Введите название этапа', 'error');
        return;
    }
    
    try {
        await MilestoneAPI.update(id, {
            name,
            description,
            start_date: startDate,
            end_date: endDate
        });
        
        // Очистить форму
        document.getElementById('newMilestoneName').value = '';
        document.getElementById('newMilestoneDescription').value = '';
        document.getElementById('milestoneStartDate').value = '';
        document.getElementById('milestoneEndDate').value = '';
        
        // Вернуть кнопку на "Создать"
        const btn = document.querySelector('#milestoneFormContainer button[onclick^="updateMilestone"]');
        if (btn) {
            btn.textContent = 'Создать этап';
            btn.setAttribute('onclick', 'addMilestone()');
        }
        
        showNotification('Этап обновлён', 'success');
        await loadMilestones();
        await updateMilestoneSelect();
        
        toggleMilestoneForm();
    } catch (error) {
        console.error('Ошибка обновления этапа:', error);
        showNotification('Ошибка обновления этапа', 'error');
    }
}

// Добавить milestone
async function addMilestone() {
    const name = document.getElementById('newMilestoneName').value.trim();
    const description = document.getElementById('newMilestoneDescription').value.trim();
    const startDate = document.getElementById('milestoneStartDate').value || null;
    const endDate = document.getElementById('milestoneEndDate').value || null;
    
    if (!name) {
        showNotification('Введите название этапа', 'error');
        return;
    }
    
    try {
        await MilestoneAPI.create({
            project_id: window.currentProjectId,
            name,
            description,
            start_date: startDate,
            end_date: endDate
        });
        
        document.getElementById('newMilestoneName').value = '';
        document.getElementById('newMilestoneDescription').value = '';
        document.getElementById('milestoneStartDate').value = '';
        document.getElementById('milestoneEndDate').value = '';
        
        showNotification('Этап создан', 'success');
        await loadMilestones();
        await updateMilestoneSelect();
        
        toggleMilestoneForm();
    } catch (error) {
        console.error('Ошибка создания этапа:', error);
        showNotification('Ошибка создания этапа', 'error');
    }
}

// Переключить статус milestone
async function toggleMilestone(id) {
    try {
        const milestones = await MilestoneAPI.getAll(window.currentProjectId);
        const milestone = milestones.find(m => m.id === id);
        
        if (milestone) {
            await MilestoneAPI.update(id, { completed: !milestone.completed });
            await loadMilestones();
        }
    } catch (error) {
        console.error('Ошибка обновления этапа:', error);
        showNotification('Ошибка обновления этапа', 'error');
    }
}

// Удалить milestone
async function deleteMilestone(id) {
    if (!confirm('Удалить этап?')) return;
    
    try {
        await MilestoneAPI.delete(id);
        showNotification('Этап удалён', 'success');
        await loadMilestones();
        await updateMilestoneSelect();
    } catch (error) {
        console.error('Ошибка удаления этапа:', error);
        showNotification('Ошибка удаления этапа', 'error');
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

// ========== WORKSPACE: ЗАМЕТКИ ПРОЕКТА ==========

// Загрузка заметок проекта
async function loadProjectNotes() {
    try {
        const notes = await ProjectNoteAPI.getAll(window.currentProjectId);
        renderProjectNotes(notes);
    } catch (error) {
        console.error('Ошибка загрузки заметок:', error);
        showNotification('Ошибка загрузки заметок', 'error');
    }
}

// Отрисовка заметок проекта
function renderProjectNotes(notes) {
    const container = document.getElementById('projectNoteList');
    
    if (!notes || notes.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет заметок</p>';
        return;
    }
    
    container.innerHTML = notes.map(note => `
        <div class="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-bold text-gray-800">${note.title}</h3>
                <button onclick="deleteProjectNote(${note.id})" class="text-red-600 hover:text-red-800">🗑️</button>
            </div>
            ${note.content ? `<p class="text-gray-600 text-sm whitespace-pre-wrap">${note.content}</p>` : ''}
            <p class="text-xs text-gray-400 mt-2">${new Date(note.created_at).toLocaleString('ru-RU')}</p>
        </div>
    `).join('');
}

// Добавить заметку проекта
async function addProjectNote() {
    const title = document.getElementById('newProjectNoteTitle').value.trim();
    const content = document.getElementById('newProjectNoteContent').value.trim();
    
    if (!title) {
        showNotification('Введите заголовок заметки', 'error');
        return;
    }
    
    try {
        await ProjectNoteAPI.create(window.currentProjectId, title, content);
        
        document.getElementById('newProjectNoteTitle').value = '';
        document.getElementById('newProjectNoteContent').value = '';
        
        showNotification('Заметка создана', 'success');
        await loadProjectNotes();
        await loadWorkspaceStats();
        
        toggleProjectNoteForm();
    } catch (error) {
        console.error('Ошибка создания заметки:', error);
        showNotification('Ошибка создания заметки', 'error');
    }
}

// Удалить заметку проекта
async function deleteProjectNote(id) {
    if (!confirm('Удалить заметку?')) return;
    
    try {
        await ProjectNoteAPI.delete(id);
        showNotification('Заметка удалена', 'success');
        await loadProjectNotes();
        await loadWorkspaceStats();
    } catch (error) {
        console.error('Ошибка удаления заметки:', error);
        showNotification('Ошибка удаления заметки', 'error');
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

// ========== ПЕРЕКЛЮЧЕНИЕ ТАБОВ ==========
// Быстрый выбор даты для workspace
function setWsDeadlineToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('wsTaskDeadline').value = today;
}

function setWsDeadlineTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('wsTaskDeadline').value = tomorrow.toISOString().split('T')[0];
}

function clearWsDeadline() {
    document.getElementById('wsTaskDeadline').value = '';
}
// Быстрый выбор даты для milestones
function setMilestoneStartToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('milestoneStartDate').value = today;
}

function setMilestoneEndTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('milestoneEndDate').value = tomorrow.toISOString().split('T')[0];
}

// В конец файла
function setEndOfDay(dateString) {
    const date = new Date(dateString);
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
}


// Открыть модальное окно шаринга
async function openShareProjectModal() {
    document.getElementById('shareProjectModal').classList.remove('hidden');
    await loadCurrentShares();
}

// Закрыть модальное окно
function closeShareProjectModal() {
    document.getElementById('shareProjectModal').classList.add('hidden');
    document.getElementById('shareWithTelegramId').value = '';
}

// Загрузить текущие шары
async function loadCurrentShares() {
    try {
        const shares = await ProjectShareAPI.getProjectShares(window.currentProjectId);
        const container = document.getElementById('currentShares');
        
        if (shares.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">Проект ни с кем не расшарен</p>';
            return;
        }
        
        container.innerHTML = shares.map(share => `
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span class="text-sm">ID: ${share.shared_with_id}</span>
                <button onclick="removeShare('${share.shared_with_id}')" class="text-red-600 hover:text-red-800 text-sm">
                    Удалить
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки шаров:', error);
    }
}

// Поделиться проектом
async function shareProject() {
    const telegramId = document.getElementById('shareWithTelegramId').value.trim();
    
    if (!telegramId) {
        showNotification('Введите Telegram ID', 'error');
        return;
    }
    
    if (telegramId === getUserId()) {
        showNotification('Нельзя расшарить с самим собой', 'error');
        return;
    }
    
    try {
        await ProjectShareAPI.share(window.currentProjectId, telegramId);
        showNotification('Проект расшарен', 'success');
        document.getElementById('shareWithTelegramId').value = '';
        await loadCurrentShares();
    } catch (error) {
        console.error('Ошибка шаринга:', error);
        showNotification(error.message || 'Ошибка шаринга', 'error');
    }
}

// Удалить доступ
async function removeShare(sharedWithId) {
    if (!confirm('Удалить доступ для этого пользователя?')) return;
    
    try {
        await ProjectShareAPI.removeShare(window.currentProjectId, sharedWithId);
        showNotification('Доступ удалён', 'success');
        await loadCurrentShares();
    } catch (error) {
        console.error('Ошибка удаления доступа:', error);
        showNotification('Ошибка удаления доступа', 'error');
    }
}


// ========== УПРАВЛЕНИЕ УЧАСТНИКАМИ ПРОЕКТА ==========

// Открыть модальное окно управления участниками
async function openManageMembersModal() {
    document.getElementById('manageMembersModal').classList.remove('hidden');
    await loadProjectMembers();
}

// Закрыть модальное окно
function closeMembersModal() {
    document.getElementById('manageMembersModal').classList.add('hidden');
    document.getElementById('newMemberTelegramId').value = '';
}

// Загрузить список участников
async function loadProjectMembers() {
    try {
        const members = await ProjectMemberAPI.getMembers(window.currentProjectId);
        const container = document.getElementById('membersList');
        
        if (members.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">Нет участников</p>';
            return;
        }
        
        const currentUserId = getUserId();
        
        container.innerHTML = members.map(member => {
            const roleIcons = {
                owner: '👑',
                editor: '✏️',
                viewer: '👁️'
            };
            
            const roleNames = {
                owner: 'Владелец',
                editor: 'Редактор',
                viewer: 'Зритель'
            };
            
            const isCurrentUser = member.user_id === currentUserId;
            const isOwner = member.role === 'owner';
            
            return `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex-1">
                        <p class="font-medium">
                            ID: ${member.user_id} ${isCurrentUser ? '<span class="text-blue-600">(Вы)</span>' : ''}
                        </p>
                        <p class="text-sm text-gray-600">
                            ${roleIcons[member.role]} ${roleNames[member.role]}
                        </p>
                    </div>
                    
                    ${!isOwner ? `
                        <div class="flex gap-2">
                            <button onclick="openPermissionsModal(${member.id}, '${member.user_id}')" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                                Права
                            </button>
                            <select onchange="changeMemberRole(${window.currentProjectId}, '${member.user_id}', this.value)" class="px-2 py-1 text-sm border rounded">
                                <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Зритель</option>
                                <option value="editor" ${member.role === 'editor' ? 'selected' : ''}>Редактор</option>
                            </select>
                            <button onclick="removeMember(${window.currentProjectId}, '${member.user_id}')" class="text-red-600 hover:text-red-800">
                                🗑️
                            </button>
                        </div>
                    ` : '<span class="text-sm text-gray-500">Полный доступ</span>'}
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки участников:', error);
        showNotification('Ошибка загрузки участников', 'error');
    }
}

// Добавить участника
async function addProjectMember() {
    const telegramId = document.getElementById('newMemberTelegramId').value.trim();
    const role = document.getElementById('newMemberRole').value;
    
    if (!telegramId) {
        showNotification('Введите Telegram ID', 'error');
        return;
    }
    
    if (telegramId === getUserId()) {
        showNotification('Нельзя добавить самого себя', 'error');
        return;
    }
    
    try {
        await ProjectMemberAPI.add(window.currentProjectId, telegramId, role);
        
        const memberId = await ProjectMemberAPI.getMemberId(window.currentProjectId, telegramId);
        
        // Установить базовые права в зависимости от роли
        if (role === 'viewer') {
            // Зритель видит всё, но не редактирует
            await MemberPermissionAPI.set(memberId, 'tasks', true, false);
            await MemberPermissionAPI.set(memberId, 'notes', true, false);
            await MemberPermissionAPI.set(memberId, 'roadmap', true, false);
        } else if (role === 'editor') {
            // Редактор видит и редактирует всё
            await MemberPermissionAPI.set(memberId, 'tasks', true, true);
            await MemberPermissionAPI.set(memberId, 'notes', true, true);
            await MemberPermissionAPI.set(memberId, 'roadmap', true, true);
        }
        
        showNotification('Участник добавлен', 'success');
        document.getElementById('newMemberTelegramId').value = '';
        await loadProjectMembers();
        
    } catch (error) {
        console.error('Ошибка добавления участника:', error);
        showNotification(error.message || 'Ошибка добавления участника', 'error');
    }
}

// Изменить роль участника
async function changeMemberRole(projectId, userId, newRole) {
    try {
        await ProjectMemberAPI.updateRole(projectId, userId, newRole);
        
        const memberId = await ProjectMemberAPI.getMemberId(projectId, userId);
        
        // Обновить права согласно новой роли
        if (newRole === 'viewer') {
            await MemberPermissionAPI.set(memberId, 'tasks', true, false);
            await MemberPermissionAPI.set(memberId, 'notes', true, false);
            await MemberPermissionAPI.set(memberId, 'roadmap', true, false);
        } else if (newRole === 'editor') {
            await MemberPermissionAPI.set(memberId, 'tasks', true, true);
            await MemberPermissionAPI.set(memberId, 'notes', true, true);
            await MemberPermissionAPI.set(memberId, 'roadmap', true, true);
        }
        
        showNotification('Роль изменена', 'success');
        await loadProjectMembers();
        
    } catch (error) {
        console.error('Ошибка изменения роли:', error);
        showNotification(error.message || 'Ошибка изменения роли', 'error');
    }
}

// Удалить участника
async function removeMember(projectId, userId) {
    if (!confirm('Удалить этого участника из проекта?')) return;
    
    try {
        await ProjectMemberAPI.remove(projectId, userId);
        showNotification('Участник удалён', 'success');
        await loadProjectMembers();
    } catch (error) {
        console.error('Ошибка удаления участника:', error);
        showNotification(error.message || 'Ошибка удаления участника', 'error');
    }
}

// ========== НАСТРОЙКА ДЕТАЛЬНЫХ ПРАВ ==========

// Открыть модальное окно прав
async function openPermissionsModal(memberId, userId) {
    document.getElementById('editMemberId').value = memberId;
    document.getElementById('editMemberUserId').value = userId;
    document.getElementById('editMemberUserIdDisplay').textContent = userId;
    document.getElementById('memberPermissionsModal').classList.remove('hidden');
    
    await loadMemberPermissions(memberId);
    await loadSubprojectPermissions(memberId);
}

// Закрыть модальное окно прав
function closePermissionsModal() {
    document.getElementById('memberPermissionsModal').classList.add('hidden');
}

// Загрузить права участника
async function loadMemberPermissions(memberId) {
    try {
        const permissions = await MemberPermissionAPI.get(memberId);
        
        // Сбросить чекбоксы
        document.getElementById('perm_tasks_view').checked = false;
        document.getElementById('perm_tasks_edit').checked = false;
        document.getElementById('perm_notes_view').checked = false;
        document.getElementById('perm_notes_edit').checked = false;
        document.getElementById('perm_roadmap_view').checked = false;
        document.getElementById('perm_roadmap_edit').checked = false;
        
        // Заполнить чекбоксы
        permissions.forEach(perm => {
            if (perm.resource_id !== null) return; // Пропустить специфичные права
            
            if (perm.resource_type === 'tasks') {
                document.getElementById('perm_tasks_view').checked = perm.can_view;
                document.getElementById('perm_tasks_edit').checked = perm.can_edit;
            } else if (perm.resource_type === 'notes') {
                document.getElementById('perm_notes_view').checked = perm.can_view;
                document.getElementById('perm_notes_edit').checked = perm.can_edit;
            } else if (perm.resource_type === 'roadmap') {
                document.getElementById('perm_roadmap_view').checked = perm.can_view;
                document.getElementById('perm_roadmap_edit').checked = perm.can_edit;
            }
        });
        
    } catch (error) {
        console.error('Ошибка загрузки прав:', error);
    }
}

// Загрузить права на подпроекты
async function loadSubprojectPermissions(memberId) {
    try {
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        const permissions = await MemberPermissionAPI.get(memberId);
        
        const container = document.getElementById('subprojectPermissions');
        
        if (subprojects.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">Нет подпроектов</p>';
            return;
        }
        
        container.innerHTML = subprojects.map(sp => {
            const perm = permissions.find(p => p.resource_type === 'subproject' && p.resource_id === sp.id);
            
            return `
                <div class="flex items-center justify-between p-2 bg-white rounded border">
                    <span class="text-sm">${sp.icon} ${sp.name}</span>
                    <div class="flex gap-2">
                        <label class="flex items-center gap-1">
                            <input 
                                type="checkbox" 
                                ${perm?.can_view ? 'checked' : ''}
                                onchange="toggleSubprojectPermission(${memberId}, ${sp.id}, 'view', this.checked)"
                                class="w-4 h-4"
                            >
                            <span class="text-xs">Видит</span>
                        </label>
                        <label class="flex items-center gap-1">
                            <input 
                                type="checkbox" 
                                ${perm?.can_edit ? 'checked' : ''}
                                onchange="toggleSubprojectPermission(${memberId}, ${sp.id}, 'edit', this.checked)"
                                class="w-4 h-4"
                            >
                            <span class="text-xs">Редактирует</span>
                        </label>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки прав на подпроекты:', error);
    }
}

// Переключить право на подпроект
async function toggleSubprojectPermission(memberId, subprojectId, permType, isChecked) {
    try {
        const permissions = await MemberPermissionAPI.get(memberId);
        const existing = permissions.find(p => p.resource_type === 'subproject' && p.resource_id === subprojectId);
        
        let canView = existing?.can_view || false;
        let canEdit = existing?.can_edit || false;
        
        if (permType === 'view') {
            canView = isChecked;
            if (!isChecked) canEdit = false; // Если убрали просмотр, убрать и редактирование
        } else if (permType === 'edit') {
            canEdit = isChecked;
            if (isChecked) canView = true; // Если дали редактирование, автоматически дать просмотр
        }
        
        await MemberPermissionAPI.set(memberId, 'subproject', canView, canEdit, subprojectId);
        await loadSubprojectPermissions(memberId);
        
    } catch (error) {
        console.error('Ошибка изменения прав:', error);
        showNotification('Ошибка изменения прав', 'error');
    }
}

// Сохранить общие права
async function savePermissions() {
    const memberId = parseInt(document.getElementById('editMemberId').value);
    
    try {
        // Задачи
        const tasksView = document.getElementById('perm_tasks_view').checked;
        const tasksEdit = document.getElementById('perm_tasks_edit').checked;
        await MemberPermissionAPI.set(memberId, 'tasks', tasksView, tasksEdit);
        
        // Заметки
        const notesView = document.getElementById('perm_notes_view').checked;
        const notesEdit = document.getElementById('perm_notes_edit').checked;
        await MemberPermissionAPI.set(memberId, 'notes', notesView, notesEdit);
        
        // Roadmap
        const roadmapView = document.getElementById('perm_roadmap_view').checked;
        const roadmapEdit = document.getElementById('perm_roadmap_edit').checked;
        await MemberPermissionAPI.set(memberId, 'roadmap', roadmapView, roadmapEdit);
        
        showNotification('Права сохранены', 'success');
        closePermissionsModal();
        
    } catch (error) {
        console.error('Ошибка сохранения прав:', error);
        showNotification('Ошибка сохранения прав', 'error');
    }
}
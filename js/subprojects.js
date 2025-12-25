// ========== ДЕТАЛЬНЫЙ ВИД ПОДПРОЕКТА ==========

// Открыть детальный вид подпроекта
// Открыть детальный вид подпроекта
async function openSubprojectDetail(subprojectId) {
    window.currentSubprojectId = subprojectId;
    
    try {
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        const subproject = subprojects.find(sp => sp.id === subprojectId);
        
        if (!subproject) return;
        
        // Проверить права доступа
        // Проверить права доступа
        const userId = getUserId();
        const role = await ProjectMemberAPI.getRole(window.currentProjectId, userId);
        const isOwner = role === 'owner';

        // Для не-владельцев проверить права редактирования
        const canEdit = isOwner ? true : await MemberPermissionAPI.canAccess(
            window.currentProjectId, 
            userId, 
            'subproject', 
            subprojectId, 
            true
        );
        // Скрыть список подпроектов
        document.getElementById('workspace-subprojects').classList.add('hidden');
        
        // Показать детальный вид
        document.getElementById('subproject-detail-view').classList.remove('hidden');
        
        // Заполнить данные
        document.getElementById('subproject-detail-icon').textContent = subproject.icon || '📁';
        document.getElementById('subproject-detail-name').textContent = subproject.name;
        document.getElementById('subproject-detail-description').textContent = subproject.description || 'Нет описания';
        
        // Скрыть кнопки редактирования если нет прав
        if (!canEdit) {
            // Скрыть все кнопки добавления
            const addButtons = document.querySelectorAll('#subproject-detail-view button[onclick*="add"], button[onclick*="toggle"]');
            addButtons.forEach(btn => {
                if (!btn.onclick || !btn.onclick.toString().includes('close')) {
                    btn.style.display = 'none';
                }
            });
            
            // Скрыть кнопку "Изменить"
            const editBtn = document.querySelector('button[onclick="openEditSubprojectModal()"]');
            if (editBtn) editBtn.style.display = 'none';
        } else {
            // Показать все кнопки
            const addButtons = document.querySelectorAll('#subproject-detail-view button');
            addButtons.forEach(btn => btn.style.display = '');
        }
        
        // Загрузить данные
        switchSubprojectTab('data');
        await loadCustomFields();
        
    } catch (error) {
        console.error('Ошибка открытия подпроекта:', error);
        showNotification('Ошибка открытия подпроекта', 'error');
    }
}

// Закрыть детальный вид подпроекта
function closeSubprojectDetail() {
    document.getElementById('subproject-detail-view').classList.add('hidden');
    document.getElementById('workspace-subprojects').classList.remove('hidden');
    window.currentSubprojectId = null;
}

// Переключение табов подпроекта
function switchSubprojectTab(tab) {
    // Скрыть все контенты
    document.querySelectorAll('.sp-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Убрать активность со всех табов
    document.querySelectorAll('.sp-tab-btn').forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-600');
    });
    
    // Показать нужный контент
    document.getElementById(`sp-content-${tab}`).classList.remove('hidden');
    
    // Активировать таб
    const activeTab = document.getElementById(`sp-tab-${tab}`);
    activeTab.classList.remove('border-transparent', 'text-gray-600');
    activeTab.classList.add('border-blue-500', 'text-blue-600');
    
    // Загрузить данные для таба
    if (tab === 'data') {
        loadCustomFields();
    } else if (tab === 'tasks') {
        loadSubprojectTasks();
    } else if (tab === 'notes') {
        loadSubprojectNotes();
    } else if (tab === 'tables') {
        loadSubprojectTables();
    }
}

// ========== КАСТОМНЫЕ ПОЛЯ ==========

// Загрузка кастомных полей
async function loadCustomFields() {
    try {
        const fields = await CustomFieldAPI.getAll(window.currentSubprojectId);
        renderCustomFields(fields);
    } catch (error) {
        console.error('Ошибка загрузки полей:', error);
        showNotification('Ошибка загрузки полей', 'error');
    }
}

// Отрисовка кастомных полей
function renderCustomFields(fields) {
    const container = document.getElementById('customFieldsList');
    
    if (!fields || fields.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">Нет полей. Добавьте первое поле.</p>';
        return;
    }
    
    container.innerHTML = fields.map(field => {
        let displayValue = field.field_value;
        let icon = '📝';
        
        switch(field.field_type) {
            case 'password':
                displayValue = '••••••••';
                icon = '🔒';
                break;
            case 'email':
                icon = '📧';
                break;
            case 'phone':
                icon = '📱';
                break;
            case 'url':
                icon = '🔗';
                displayValue = `<a href="${field.field_value}" target="_blank" class="text-blue-600 hover:underline">${field.field_value}</a>`;
                break;
            case 'date':
                icon = '📅';
                displayValue = new Date(field.field_value).toLocaleDateString('ru-RU');
                break;
            case 'number':
                icon = '🔢';
                break;
        }
        
        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3 flex-1">
                    <span class="text-xl">${icon}</span>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-gray-700">${field.field_name}</p>
                        <p class="text-sm text-gray-600">${displayValue}</p>
                    </div>
                </div>
                <button onclick="deleteCustomField(${field.id})" class="text-red-600 hover:text-red-800 ml-2">🗑️</button>
            </div>
        `;
    }).join('');
}

// Открыть модальное окно добавления поля
function openAddFieldModal() {
    document.getElementById('addFieldModal').classList.remove('hidden');
}

// Закрыть модальное окно добавления поля
function closeAddFieldModal() {
    document.getElementById('addFieldModal').classList.add('hidden');
    document.getElementById('fieldName').value = '';
    document.getElementById('fieldValue').value = '';
}

// Сохранить кастомное поле
async function saveCustomField() {
    const name = document.getElementById('fieldName').value.trim();
    const type = document.getElementById('fieldType').value;
    const value = document.getElementById('fieldValue').value;
    
    if (!name) {
        showNotification('Введите название поля', 'error');
        return;
    }
    
    try {
        const userId = getUserId();
        
        // Получить подпроект
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        const subproject = subprojects.find(sp => sp.id === window.currentSubprojectId);
        
        if (!subproject) {
            showNotification('Подпроект не найден', 'error');
            return;
        }
        
        // Проверить права
        const role = await ProjectMemberAPI.getRole(subproject.project_id, userId);
        const isOwner = role === 'owner';
        
        if (!isOwner) {
            const canEdit = await MemberPermissionAPI.canAccess(
                subproject.project_id, 
                userId, 
                'subproject', 
                window.currentSubprojectId, 
                true
            );
            
            if (!canEdit) {
                showNotification('У вас нет прав на добавление полей', 'error');
                return;
            }
        }
        
        await CustomFieldAPI.create({
            subproject_id: window.currentSubprojectId,
            field_name: name,
            field_type: type,
            field_value: value
        });
        
        showNotification('Поле добавлено', 'success');
        closeAddFieldModal();
        await loadCustomFields();
        
    } catch (error) {
        console.error('Ошибка добавления поля:', error);
        showNotification('Ошибка добавления поля', 'error');
    }
}

// Удалить кастомное поле
async function deleteCustomField(id) {
    if (!confirm('Удалить поле?')) return;
    
    try {
        await CustomFieldAPI.delete(id);
        showNotification('Поле удалено', 'success');
        await loadCustomFields();
    } catch (error) {
        console.error('Ошибка удаления поля:', error);
        showNotification('Ошибка удаления поля', 'error');
    }
}

// ========== ЗАДАЧИ ПОДПРОЕКТА ==========

// Загрузка задач подпроекта
// Загрузка задач подпроекта
async function loadSubprojectTasks() {
    try {
        const userId = getUserId();
        
        // Получить project_id текущего подпроекта
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        const subproject = subprojects.find(sp => sp.id === window.currentSubprojectId);
        
        if (!subproject) {
            document.getElementById('spTaskList').innerHTML = '<p class="text-center text-gray-400 py-8">Подпроект не найден</p>';
            return;
        }
        
        // Проверить роль в проекте
        const role = await ProjectMemberAPI.getRole(subproject.project_id, userId);
        
        // Владелец имеет полный доступ
        const isOwner = role === 'owner';
        
        // Если не владелец - проверить права на подпроект
        if (!isOwner) {
            const canView = await MemberPermissionAPI.canAccess(
                subproject.project_id, 
                userId, 
                'subproject', 
                window.currentSubprojectId
            );
            
            if (!canView) {
                document.getElementById('spTaskList').innerHTML = '<p class="text-center text-gray-400 py-8">Нет доступа к задачам</p>';
                return;
            }
        }
        
        // Загрузить задачи
        const tasks = await TaskAPI.getAll();
        const subprojectTasks = tasks.filter(t => t.subproject_id === window.currentSubprojectId);
        
        renderSubprojectTasks(subprojectTasks);
        
    } catch (error) {
        console.error('Ошибка загрузки задач подпроекта:', error);
        document.getElementById('spTaskList').innerHTML = '<p class="text-center text-gray-400 py-8">Ошибка загрузки задач</p>';
    }
}

// Отрисовка задач подпроекта
function renderSubprojectTasks(tasks) {
    const container = document.getElementById('spTaskList');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет задач</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="bg-white border rounded-lg p-3">
            <div class="flex items-start gap-2">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''} 
                    onchange="toggleTask(${task.id}); loadSubprojectTasks();"
                    class="mt-1 w-4 h-4 rounded"
                >
                <div class="flex-1">
                    <p class="font-medium text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}">
                        ${task.title}
                    </p>
                    <div class="flex gap-2 mt-1">
                        ${task.priority === 'high' ? '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Высокий</span>' : ''}
                        ${task.priority === 'medium' ? '<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">Средний</span>' : ''}
                        ${task.priority === 'low' ? '<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Низкий</span>' : ''}
                    </div>
                </div>
                <button onclick="deleteTask(${task.id}); loadSubprojectTasks();" class="text-red-600 hover:text-red-800">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Добавить задачу в подпроект
async function addSubprojectTask() {
    const input = document.getElementById('spNewTaskInput');
    const title = input.value.trim();
    
    if (!title) {
        showNotification('Введите название задачи', 'error');
        return;
    }
    
    const priority = document.getElementById('spTaskPriority')?.value || 'medium';
    let deadline = document.getElementById('spTaskDeadline')?.value || null;
    
    if (deadline) {
        deadline = setEndOfDay(deadline);
    }
    
    try {
        const userId = getUserId();
        
        // Получить подпроект
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        const subproject = subprojects.find(sp => sp.id === window.currentSubprojectId);
        
        if (!subproject) {
            showNotification('Подпроект не найден', 'error');
            return;
        }
        
        // Проверить права
        const role = await ProjectMemberAPI.getRole(subproject.project_id, userId);
        const isOwner = role === 'owner';
        
        if (!isOwner) {
            const canEdit = await MemberPermissionAPI.canAccess(
                subproject.project_id, 
                userId, 
                'subproject', 
                window.currentSubprojectId, 
                true
            );
            
            if (!canEdit) {
                showNotification('У вас нет прав на добавление задач', 'error');
                return;
            }
        }
        
        await TaskAPI.create({
            title,
            project_id: subproject.project_id,
            subproject_id: window.currentSubprojectId,
            priority,
            deadline,
            status: 'todo',
            completed: false
        });
        
        input.value = '';
        document.getElementById('spTaskDeadline').value = '';
        
        showNotification('Задача добавлена', 'success');
        await loadSubprojectTasks();
        toggleSpTaskForm();
        
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showNotification('Ошибка добавления задачи', 'error');
    }
}

// Добавьте функцию в конец файла
function setEndOfDay(dateString) {
    const date = new Date(dateString);
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
}

// Показать/скрыть форму задачи подпроекта
function toggleSpTaskForm() {
    const container = document.getElementById('spTaskFormContainer');
    const btn = document.querySelector('[onclick="toggleSpTaskForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Добавить задачу</span>';
        document.getElementById('spNewTaskInput').value = '';
        document.getElementById('spTaskDeadline').value = '';
    }
}

// ========== ЗАМЕТКИ ПОДПРОЕКТА ==========

// Загрузка заметок подпроекта
async function loadSubprojectNotes() {
    try {
        const notes = await SubprojectNoteAPI.getAll(window.currentSubprojectId);
        renderSubprojectNotes(notes);
    } catch (error) {
        console.error('Ошибка загрузки заметок:', error);
        showNotification('Ошибка загрузки заметок', 'error');
    }
}

// Отрисовка заметок подпроекта
function renderSubprojectNotes(notes) {
    const container = document.getElementById('spNoteList');
    
    if (!notes || notes.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет заметок</p>';
        return;
    }
    
    container.innerHTML = notes.map(note => `
        <div class="bg-white border rounded-lg p-3">
            <div class="flex items-start justify-between">
                <p class="text-gray-800 text-sm whitespace-pre-wrap flex-1">${note.content}</p>
                <button onclick="deleteSubprojectNote(${note.id})" class="text-red-600 hover:text-red-800 ml-2">🗑️</button>
            </div>
            <p class="text-xs text-gray-400 mt-2">${new Date(note.created_at).toLocaleString('ru-RU')}</p>
        </div>
    `).join('');
}

// Добавить заметку в подпроект
async function addSubprojectNote() {
    const input = document.getElementById('spNewNoteInput');
    const content = input.value.trim();
    
    if (!content) {
        showNotification('Введите текст заметки', 'error');
        return;
    }
    
    try {
        const userId = getUserId();
        
        // Получить подпроект
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        const subproject = subprojects.find(sp => sp.id === window.currentSubprojectId);
        
        if (!subproject) {
            showNotification('Подпроект не найден', 'error');
            return;
        }
        
        // Проверить права
        const role = await ProjectMemberAPI.getRole(subproject.project_id, userId);
        const isOwner = role === 'owner';
        
        if (!isOwner) {
            const canEdit = await MemberPermissionAPI.canAccess(
                subproject.project_id, 
                userId, 
                'subproject', 
                window.currentSubprojectId, 
                true // needEdit = true
            );
            
            if (!canEdit) {
                showNotification('У вас нет прав на добавление заметок', 'error');
                return;
            }
        }
        
        await SubprojectNoteAPI.create({
            subproject_id: window.currentSubprojectId,
            content
        });
        
        input.value = '';
        showNotification('Заметка добавлена', 'success');
        await loadSubprojectNotes();
        toggleSpNoteForm();
        
    } catch (error) {
        console.error('Ошибка добавления заметки:', error);
        showNotification('Ошибка добавления заметки', 'error');
    }
}
// Удалить заметку подпроекта
async function deleteSubprojectNote(id) {
    if (!confirm('Удалить заметку?')) return;
    
    try {
        await SubprojectNoteAPI.delete(id);
        showNotification('Заметка удалена', 'success');
        await loadSubprojectNotes();
    } catch (error) {
        console.error('Ошибка удаления заметки:', error);
        showNotification('Ошибка удаления заметки', 'error');
    }
}

// Показать/скрыть форму заметки подпроекта
function toggleSpNoteForm() {
    const container = document.getElementById('spNoteFormContainer');
    const btn = document.querySelector('[onclick="toggleSpNoteForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Добавить заметку</span>';
        document.getElementById('spNewNoteInput').value = '';
    }
}

// ========== РЕДАКТИРОВАНИЕ ПОДПРОЕКТА ==========

// Открыть модальное окно редактирования
async function openEditSubprojectModal() {
    try {
        const subprojects = await SubprojectAPI.getAll(window.currentProjectId);
        const subproject = subprojects.find(sp => sp.id === window.currentSubprojectId);
        
        if (!subproject) return;
        
        document.getElementById('editSubprojectName').value = subproject.name;
        document.getElementById('editSubprojectDescription').value = subproject.description || '';
        document.getElementById('editSubprojectIcon').value = subproject.icon || '';
        document.getElementById('editSubprojectColor').value = subproject.color || '#3B82F6';
        
        document.getElementById('editSubprojectModal').classList.remove('hidden');
    } catch (error) {
        console.error('Ошибка открытия модального окна:', error);
    }
}

// Закрыть модальное окно редактирования
function closeEditSubprojectModal() {
    document.getElementById('editSubprojectModal').classList.add('hidden');
}

// Сохранить изменения подпроекта
async function saveSubprojectEdit() {
    const name = document.getElementById('editSubprojectName').value.trim();
    const description = document.getElementById('editSubprojectDescription').value.trim();
    const icon = document.getElementById('editSubprojectIcon').value.trim();
    const color = document.getElementById('editSubprojectColor').value;
    
    if (!name) {
        showNotification('Введите название подпроекта', 'error');
        return;
    }
    
    try {
        await SubprojectAPI.update(window.currentSubprojectId, {
            name,
            description,
            icon,
            color
        });
        
        // Обновить заголовок
        document.getElementById('subproject-detail-name').textContent = name;
        document.getElementById('subproject-detail-description').textContent = description;
        document.getElementById('subproject-detail-icon').textContent = icon;
        
        closeEditSubprojectModal();
        showNotification('Подпроект обновлён', 'success');
        await loadSubprojects();
    } catch (error) {
        console.error('Ошибка сохранения подпроекта:', error);
        showNotification('Ошибка сохранения подпроекта', 'error');
    }
}

// Быстрый выбор даты для задач подпроекта
function setSpDeadlineToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('spTaskDeadline').value = today;
}

function setSpDeadlineTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('spTaskDeadline').value = tomorrow.toISOString().split('T')[0];
}
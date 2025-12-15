// ========== ПОДПРОЕКТЫ ==========

let currentSubproject = null;
let currentSubprojectTab = 'data';

// ========== СПИСОК ПОДПРОЕКТОВ ==========

async function loadSubprojects() {
    if (!currentProject) return;
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/subprojects/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const subprojects = await response.json();
        renderSubprojects(subprojects);
    } catch (error) {
        console.error('Ошибка загрузки подпроектов:', error);
        showError('Не удалось загрузить подпроекты');
    }
}

function renderSubprojects(subprojects) {
    const subprojectList = document.getElementById('subprojectList');
    
    if (subprojects.length === 0) {
        subprojectList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет подпроектов. Создайте первый!</p>';
        return;
    }
    
    subprojectList.innerHTML = subprojects.map(sp => `
        <div class="border rounded-lg hover:shadow-md transition-shadow cursor-pointer" style="border-left: 4px solid ${sp.color}">
            <div onclick="openSubprojectDetail(${sp.id})" class="flex items-center gap-3 p-4">
                <span class="text-2xl">${sp.icon}</span>
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-800">${escapeHtml(sp.name)}</h3>
                    <p class="text-sm text-gray-500 line-clamp-1">${escapeHtml(sp.description || 'Без описания')}</p>
                    <div class="flex gap-3 mt-2 text-xs text-gray-500">
                        <span>✅ ${sp.tasks_count} задач</span>
                        <span>📝 ${sp.custom_fields.length} полей</span>
                        <span>📓 ${sp.notes ? sp.notes.length : 0} заметок</span>
                        <span>📊 ${sp.tables ? sp.tables.length : 0} таблиц</span>
                    </div>
                </div>
            </div>
            <div class="border-t px-4 py-2 flex justify-end">
                <button 
                    onclick="event.stopPropagation(); deleteSubproject(${sp.id})"
                    class="text-xs text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                >
                    Удалить
                </button>
            </div>
        </div>
    `).join('');
}

async function addSubproject() {
    const name = document.getElementById('newSubprojectName').value.trim();
    const description = document.getElementById('newSubprojectDescription').value.trim();
    const icon = document.getElementById('newSubprojectIcon').value.trim() || '📁';
    const color = document.getElementById('newSubprojectColor').value;
    
    if (!name) {
        document.getElementById('newSubprojectName').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/subprojects/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ name, description, icon, color })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        document.getElementById('newSubprojectName').value = '';
        document.getElementById('newSubprojectDescription').value = '';
        document.getElementById('newSubprojectIcon').value = '';
        document.getElementById('newSubprojectColor').value = '#3B82F6';
        
        await loadSubprojects();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка создания подпроекта:', error);
        showError('Не удалось создать подпроект');
    }
}

async function deleteSubproject(id) {
    if (!confirm('Удалить подпроект? Все данные, задачи и таблицы будут удалены.')) return;
    
    try {
        const response = await fetch(`${API_URL}/subprojects/${id}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        await loadSubprojects();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления подпроекта:', error);
        showError('Не удалось удалить подпроект');
    }
}

// ========== ДЕТАЛЬНЫЙ ВИД ПОДПРОЕКТА ==========

async function openSubprojectDetail(subprojectId) {
    currentSubproject = subprojectId;
    
    // Скрыть список подпроектов
    document.getElementById('workspace-subprojects').classList.add('hidden');
    
    // Показать детальный вид
    document.getElementById('subproject-detail-view').classList.remove('hidden');
    
    // Загрузить данные
    await loadSubprojectDetail();
    switchSubprojectTab('data');
}

function closeSubprojectDetail() {
    currentSubproject = null;
    
    // Скрыть детальный вид
    document.getElementById('subproject-detail-view').classList.add('hidden');
    
    // Показать список подпроектов
    document.getElementById('workspace-subprojects').classList.remove('hidden');
    
    // Обновить список
    loadSubprojects();
}

async function loadSubprojectDetail() {
    try {
        const response = await fetch(`${API_URL}/subprojects/${currentSubproject}/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const subproject = await response.json();
        
        // Обновить заголовок
        document.getElementById('subproject-detail-icon').textContent = subproject.icon;
        document.getElementById('subproject-detail-name').textContent = subproject.name;
        document.getElementById('subproject-detail-description').textContent = subproject.description || 'Без описания';
        
        // Сохранить данные для редактирования
        window.currentSubprojectData = subproject;
        
        return subproject;
    } catch (error) {
        console.error('Ошибка загрузки подпроекта:', error);
        showError('Не удалось загрузить подпроект');
    }
}

function switchSubprojectTab(tab) {
    currentSubprojectTab = tab;
    
    // Скрыть все вкладки
    document.querySelectorAll('.sp-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.sp-tab-btn').forEach(el => {
        el.classList.remove('border-blue-500', 'text-blue-600');
        el.classList.add('border-transparent', 'text-gray-600');
    });
    
    // Показать выбранную
    document.getElementById(`sp-content-${tab}`).classList.remove('hidden');
    const tabBtn = document.getElementById(`sp-tab-${tab}`);
    tabBtn.classList.remove('border-transparent', 'text-gray-600');
    tabBtn.classList.add('border-blue-500', 'text-blue-600');
    
    // Загрузить данные
    if (tab === 'data') loadCustomFields();
    if (tab === 'tasks') loadSubprojectTasks();
    if (tab === 'notes') loadSubprojectNotes();
    if (tab === 'tables') loadSubprojectTables();
}

// ========== КАСТОМНЫЕ ПОЛЯ ==========

function loadCustomFields() {
    const subproject = window.currentSubprojectData;
    if (!subproject) return;
    
    const container = document.getElementById('customFieldsList');
    
    if (!subproject.custom_fields || subproject.custom_fields.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">Нет полей. Добавьте первое поле.</p>';
        return;
    }
    
    container.innerHTML = subproject.custom_fields.map((field, index) => {
        let displayValue = field.value;
        
        if (field.type === 'password') {
            displayValue = '••••••••';
        } else if (field.type === 'url') {
            displayValue = `<a href="${field.value}" target="_blank" class="text-blue-600 hover:underline">${field.value}</a>`;
        } else if (field.type === 'email') {
            displayValue = `<a href="mailto:${field.value}" class="text-blue-600 hover:underline">${field.value}</a>`;
        } else if (field.type === 'phone') {
            displayValue = `<a href="tel:${field.value}" class="text-blue-600 hover:underline">${field.value}</a>`;
        }
        
        return `
            <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-600">${escapeHtml(field.name)}</p>
                    <p class="text-gray-800">${field.type === 'url' || field.type === 'email' || field.type === 'phone' ? displayValue : escapeHtml(displayValue)}</p>
                </div>
                <div class="flex gap-2">
                    ${field.type === 'password' ? `
                        <button onclick="togglePasswordVisibility(${index})" class="text-gray-600 hover:text-gray-800 px-2">
                            👁
                        </button>
                    ` : ''}
                    <button onclick="deleteCustomField(${index})" class="text-red-500 hover:text-red-700 px-2">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openAddFieldModal() {
    document.getElementById('addFieldModal').classList.remove('hidden');
}

function closeAddFieldModal() {
    document.getElementById('addFieldModal').classList.add('hidden');
    document.getElementById('fieldName').value = '';
    document.getElementById('fieldValue').value = '';
    document.getElementById('fieldType').value = 'text';
}

async function saveCustomField() {
    const name = document.getElementById('fieldName').value.trim();
    const value = document.getElementById('fieldValue').value.trim();
    const type = document.getElementById('fieldType').value;
    
    if (!name || !value) {
        showError('Заполните все поля');
        return;
    }
    
    const subproject = window.currentSubprojectData;
    const customFields = subproject.custom_fields || [];
    
    customFields.push({ name, value, type });
    
    try {
        const response = await fetch(`${API_URL}/subprojects/${currentSubproject}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ custom_fields: customFields })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const updated = await response.json();
        window.currentSubprojectData = updated;
        
        closeAddFieldModal();
        loadCustomFields();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка добавления поля:', error);
        showError('Не удалось добавить поле');
    }
}

async function deleteCustomField(index) {
    if (!confirm('Удалить поле?')) return;
    
    const subproject = window.currentSubprojectData;
    const customFields = [...subproject.custom_fields];
    customFields.splice(index, 1);
    
    try {
        const response = await fetch(`${API_URL}/subprojects/${currentSubproject}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ custom_fields: customFields })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const updated = await response.json();
        window.currentSubprojectData = updated;
        
        loadCustomFields();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления поля:', error);
        showError('Не удалось удалить поле');
    }
}

function togglePasswordVisibility(index) {
    const subproject = window.currentSubprojectData;
    const field = subproject.custom_fields[index];
    
    const container = document.getElementById('customFieldsList');
    const fieldElement = container.children[index];
    const valueElement = fieldElement.querySelector('.text-gray-800');
    
    if (valueElement.textContent === '••••••••') {
        valueElement.textContent = field.value;
    } else {
        valueElement.textContent = '••••••••';
    }
}

// ========== ЗАДАЧИ ПОДПРОЕКТА ==========

async function loadSubprojectTasks() {
    if (!currentSubproject) return;
    
    try {
        const response = await fetch(`${API_URL}/tasks/?subproject=${currentSubproject}`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tasks = await response.json();
        renderSubprojectTasks(tasks);
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        showError('Не удалось загрузить задачи');
    }
}

function renderSubprojectTasks(tasks) {
    const taskList = document.getElementById('spTaskList');
    
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
            <div class="flex items-start gap-3 p-3 border-l-4 rounded-lg ${priorityColors[task.priority]}">
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

async function addSubprojectTask() {
    const title = document.getElementById('spNewTaskInput').value.trim();
    const priority = document.getElementById('spTaskPriority').value;
    const deadlineInput = document.getElementById('spTaskDeadline').value;
    const deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    
    if (!title) {
        document.getElementById('spNewTaskInput').focus();
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
                project: currentProject,
                subproject: currentSubproject,
                priority, 
                deadline 
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error('Ошибка создания задачи:', error);
            throw new Error(`HTTP ${response.status}`);
        }
        
        document.getElementById('spNewTaskInput').value = '';
        document.getElementById('spTaskDeadline').value = '';
        
        await loadSubprojectTasks();
        await loadSubprojectDetail(); // Обновить счётчики
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showError('Не удалось добавить задачу');
    }
}
// ========== ЗАМЕТКИ ==========

async function loadSubprojectNotes() {
    const subproject = window.currentSubprojectData;
    if (!subproject) return;
    
    const notes = subproject.notes || [];
    const noteList = document.getElementById('spNoteList');
    
    if (notes.length === 0) {
        noteList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет заметок</p>';
        return;
    }
    
    noteList.innerHTML = notes.map(note => `
        <div class="border rounded-lg p-3 hover:bg-gray-50">
            <div class="flex justify-between items-start mb-2">
                <p class="text-xs text-gray-500">${new Date(note.created_at).toLocaleString('ru-RU')}</p>
                <button onclick="deleteSubprojectNote(${note.id})" class="text-red-500 hover:text-red-700 text-sm">
                    🗑️
                </button>
            </div>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(note.content)}</p>
        </div>
    `).join('');
}

async function addSubprojectNote() {
    const content = document.getElementById('spNewNoteInput').value.trim();
    
    if (!content) {
        document.getElementById('spNewNoteInput').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/subprojects/${currentSubproject}/notes/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        document.getElementById('spNewNoteInput').value = '';
        
        await loadSubprojectDetail();
        loadSubprojectNotes();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка добавления заметки:', error);
        showError('Не удалось добавить заметку');
    }
}

async function deleteSubprojectNote(noteId) {
    if (!confirm('Удалить заметку?')) return;
    
    try {
        const response = await fetch(`${API_URL}/subproject-notes/${noteId}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        await loadSubprojectDetail();
        loadSubprojectNotes();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления заметки:', error);
        showError('Не удалось удалить заметку');
    }
}

// ========== РЕДАКТИРОВАНИЕ ПОДПРОЕКТА ==========

function openEditSubprojectModal() {
    const subproject = window.currentSubprojectData;
    if (!subproject) return;
    
    document.getElementById('editSubprojectName').value = subproject.name;
    document.getElementById('editSubprojectDescription').value = subproject.description || '';
    document.getElementById('editSubprojectIcon').value = subproject.icon;
    document.getElementById('editSubprojectColor').value = subproject.color;
    
    document.getElementById('editSubprojectModal').classList.remove('hidden');
}

function closeEditSubprojectModal() {
    document.getElementById('editSubprojectModal').classList.add('hidden');
}

async function saveSubprojectEdit() {
    const name = document.getElementById('editSubprojectName').value.trim();
    const description = document.getElementById('editSubprojectDescription').value.trim();
    const icon = document.getElementById('editSubprojectIcon').value.trim();
    const color = document.getElementById('editSubprojectColor').value;
    
    if (!name) {
        document.getElementById('editSubprojectName').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/subprojects/${currentSubproject}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ name, description, icon, color })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        closeEditSubprojectModal();
        await loadSubprojectDetail();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка обновления подпроекта:', error);
        showError('Не удалось обновить подпроект');
    }
}

// Показать/скрыть форму создания подпроекта
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
// ========== ПРОЕКТЫ ==========

async function loadProjects() {
    try {
        const response = await fetch(`${API_URL}/projects/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const projects = await response.json();
        renderProjects(projects);
        updateProjectSelects(projects);
    } catch (error) {
        console.error('Ошибка загрузки проектов:', error);
        showError('Не удалось загрузить проекты');
    }
}

function renderProjects(projects) {
    const projectList = document.getElementById('projectList');
    
    if (projects.length === 0) {
        projectList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет проектов</p>';
        return;
    }
    
    projectList.innerHTML = projects.map(project => `
        <div class="border rounded-lg hover:shadow-md transition-shadow cursor-pointer" style="border-left: 4px solid ${project.color}">
            <div onclick="openProject(${project.id})" class="flex items-center gap-3 p-4">
                <span class="text-2xl">${project.icon}</span>
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-800">${escapeHtml(project.name)}</h3>
                    <p class="text-sm text-gray-500 line-clamp-1">${escapeHtml(project.description || 'Без описания')}</p>
                    <div class="flex gap-3 mt-2 text-xs text-gray-500">
                        <span>✅ ${project.tasks_count} задач</span>
                        <span>🗺️ ${project.milestones_count} этапов</span>
                        <span>📝 ${project.documents_count} документов</span>
                    </div>
                </div>
            </div>
            <div class="border-t px-4 py-2 flex justify-end">
                <button 
                    onclick="event.stopPropagation(); deleteProject(${project.id})"
                    class="text-xs text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                >
                    Удалить
                </button>
            </div>
        </div>
    `).join('');
}

function updateProjectSelects(projects) {
    const selects = [
        document.getElementById('taskProject'),
        document.getElementById('filterProject')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        const options = select.id === 'filterProject' 
            ? '<option value="">Все проекты</option>'
            : '<option value="">Без проекта</option>';
        
        select.innerHTML = options + projects.map(p => 
            `<option value="${p.id}">${p.icon} ${escapeHtml(p.name)}</option>`
        ).join('');
        
        select.value = currentValue;
    });
}

async function addProject() {
    const name = document.getElementById('newProjectName').value.trim();
    const description = document.getElementById('newProjectDescription').value.trim();
    const icon = document.getElementById('newProjectIcon').value.trim() || '📁';
    const color = document.getElementById('newProjectColor').value;
    
    if (!name) {
        document.getElementById('newProjectName').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/projects/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ name, description, icon, color })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        document.getElementById('newProjectName').value = '';
        document.getElementById('newProjectDescription').value = '';
        document.getElementById('newProjectIcon').value = '';
        document.getElementById('newProjectColor').value = '#3B82F6';
        
        await loadProjects();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка создания проекта:', error);
        showError('Не удалось создать проект');
    }
}

async function deleteProject(id) {
    if (!confirm('Удалить проект? Все задачи, этапы и документы также будут удалены.')) return;
    
    try {
        const response = await fetch(`${API_URL}/projects/${id}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        await loadProjects();
        await loadTasks();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления проекта:', error);
        showError('Не удалось удалить проект');
    }
}

// ========== МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ==========

async function openEditProjectModal() {
    if (!currentProject) return;
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const project = await response.json();
        
        document.getElementById('editProjectName').value = project.name;
        document.getElementById('editProjectDescription').value = project.description || '';
        document.getElementById('editProjectIcon').value = project.icon;
        document.getElementById('editProjectColor').value = project.color;
        
        document.getElementById('editProjectModal').classList.remove('hidden');
    } catch (error) {
        console.error('Ошибка загрузки проекта:', error);
        showError('Не удалось загрузить проект');
    }
}

function closeEditProjectModal() {
    document.getElementById('editProjectModal').classList.add('hidden');
}

async function saveProjectEdit() {
    const name = document.getElementById('editProjectName').value.trim();
    const description = document.getElementById('editProjectDescription').value.trim();
    const icon = document.getElementById('editProjectIcon').value.trim();
    const color = document.getElementById('editProjectColor').value;
    
    if (!name) {
        document.getElementById('editProjectName').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ name, description, icon, color })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        closeEditProjectModal();
        await loadProjectDetail();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка обновления проекта:', error);
        showError('Не удалось обновить проект');
    }
}

// Показать/скрыть форму создания проекта
function toggleProjectForm() {
    const container = document.getElementById('projectFormContainer');
    const btn = document.querySelector('[onclick="toggleProjectForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Создать проект</span>';
        // Очистка полей
        document.getElementById('newProjectName').value = '';
        document.getElementById('newProjectDescription').value = '';
        document.getElementById('newProjectIcon').value = '';
        document.getElementById('newProjectColor').value = '#3B82F6';
    }
}
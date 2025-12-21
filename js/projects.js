// Загрузка проектов
async function loadProjects() {
    try {
        const projects = await ProjectAPI.getAll();
        renderProjects(projects);
        await updateProjectSelects();
    } catch (error) {
        console.error('Ошибка загрузки проектов:', error);
        document.getElementById('projectList').innerHTML = `
            <div class="text-center py-8">
                <p class="text-red-600 mb-2">Ошибка загрузки проектов</p>
                <p class="text-sm text-gray-500">${error.message || 'Неизвестная ошибка'}</p>
                <button onclick="loadProjects()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    Повторить попытку
                </button>
            </div>
        `;
    }
}

// Отрисовка проектов
function renderProjects(projects) {
    const container = document.getElementById('projectList');
    
    if (!projects || projects.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет проектов</p>';
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onclick="openWorkspace(${project.id})">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-3xl">${project.icon || '📁'}</span>
                    <div>
                        <h3 class="font-bold text-gray-800">${project.name}</h3>
                        ${project.description ? `<p class="text-sm text-gray-600">${project.description}</p>` : ''}
                    </div>
                </div>
                
                <div class="flex gap-2" onclick="event.stopPropagation()">
                    <button onclick="deleteProject(${project.id})" class="text-red-600 hover:text-red-800">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Добавить проект
async function addProject() {
    const name = document.getElementById('newProjectName').value.trim();
    const description = document.getElementById('newProjectDescription').value.trim();
    const icon = document.getElementById('newProjectIcon').value.trim() || '📁';
    const color = document.getElementById('newProjectColor').value;
    
    if (!name) {
        showNotification('Введите название проекта', 'error');
        return;
    }
    
    try {
        await ProjectAPI.create({
            name,
            description,
            icon,
            color
        });
        
        document.getElementById('newProjectName').value = '';
        document.getElementById('newProjectDescription').value = '';
        document.getElementById('newProjectIcon').value = '';
        document.getElementById('newProjectColor').value = '#3B82F6';
        
        showNotification('Проект создан', 'success');
        await loadProjects();
        
        // Закрыть форму
        toggleProjectForm();
    } catch (error) {
        console.error('Ошибка создания проекта:', error);
        showNotification('Ошибка создания проекта', 'error');
    }
}

// Удалить проект
async function deleteProject(id) {
    if (!confirm('Удалить проект? Все связанные задачи тоже будут удалены.')) return;
    
    try {
        await ProjectAPI.delete(id);
        showNotification('Проект удалён', 'success');
        await loadProjects();
    } catch (error) {
        console.error('Ошибка удаления проекта:', error);
        showNotification('Ошибка удаления проекта', 'error');
    }
}

// Обновить выпадающие списки проектов
async function updateProjectSelects(projects) {
    const selects = [
        'taskProject',
        'filterProject',
        'kanbanFilterProject',
        'calendarFilterProject'
    ];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        const defaultOption = select.querySelector('option[value=""]');
        
        select.innerHTML = '';
        if (defaultOption) {
            select.appendChild(defaultOption.cloneNode(true));
        }
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.icon} ${project.name}`;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    });
}

// Открыть workspace проекта
// Открыть workspace проекта
async function openWorkspace(projectId) {
    window.currentProjectId = projectId;
    
    try {
        const projects = await ProjectAPI.getAll();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
            showNotification('Проект не найден', 'error');
            return;
        }
        
        // Заполнить данные проекта
        document.getElementById('ws-project-name').textContent = project.name;
        document.getElementById('ws-project-description').textContent = project.description || 'Нет описания';
        
        // Скрыть список проектов
        document.getElementById('view-projects').classList.add('hidden');
        
        // Показать workspace
        document.getElementById('view-workspace').classList.remove('hidden');
        
        // Скрыть главные табы
        document.getElementById('mainTabs').classList.add('hidden');
        
        // Показать табы workspace
        const workspaceTabs = document.getElementById('workspaceTabs');
        workspaceTabs.classList.remove('hidden');
        workspaceTabs.classList.add('flex');
        
        // Показать кнопку "Назад"
        document.getElementById('backBtn').classList.remove('hidden');
        
        // Изменить заголовок
        document.getElementById('pageTitle').textContent = project.name;
        
        // Показать вкладку "Обзор" по умолчанию
        switchWorkspaceTab('overview');
        
        // Загрузить все данные
        await loadWorkspaceData();
        
    } catch (error) {
        console.error('Ошибка открытия workspace:', error);
        showNotification('Ошибка открытия проекта', 'error');
    }
}

// Показать/скрыть форму
function toggleProjectForm() {
    const container = document.getElementById('projectFormContainer');
    const btn = document.querySelector('[onclick="toggleProjectForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Создать проект</span>';
        document.getElementById('newProjectName').value = '';
        document.getElementById('newProjectDescription').value = '';
        document.getElementById('newProjectIcon').value = '';
        document.getElementById('newProjectColor').value = '#3B82F6';
    }
}
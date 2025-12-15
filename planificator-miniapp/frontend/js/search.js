// ========== ПОИСК ==========

function handleSearch(query) {
    const searchResults = document.getElementById('searchResults');
    
    clearTimeout(searchTimeout);
    
    if (!query || query.length < 2) {
        searchResults.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${API_URL}/search/?q=${encodeURIComponent(query)}`, {
                headers: { 'X-Telegram-Init-Data': getInitData() }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const results = await response.json();
            renderSearchResults(results);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }, 300);
}

function renderSearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    
    const hasResults = results.tasks.length > 0 || 
                       results.projects.length > 0 || 
                       results.notes.length > 0 || 
                       results.milestones.length > 0;
    
    if (!hasResults) {
        searchResults.innerHTML = '<p class="p-4 text-center text-gray-500">Ничего не найдено</p>';
        searchResults.classList.remove('hidden');
        return;
    }
    
    let html = '';
    
    if (results.projects.length > 0) {
        html += '<div class="p-2 border-b"><p class="text-xs font-semibold text-gray-500 mb-2">ПРОЕКТЫ</p>';
        results.projects.forEach(project => {
            html += `
                <div onclick="openProject(${project.id}); closeSearch();" class="search-result-item p-2 rounded cursor-pointer transition-colors">
                    <p class="font-medium">${project.icon} ${escapeHtml(project.name)}</p>
                    <p class="text-xs text-gray-500">${project.tasks_count} задач</p>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (results.tasks.length > 0) {
        html += '<div class="p-2 border-b"><p class="text-xs font-semibold text-gray-500 mb-2">ЗАДАЧИ</p>';
        results.tasks.forEach(task => {
            const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[task.priority];
            html += `
                <div onclick="openTaskFromSearch(${task.id}, ${task.project || 'null'}); closeSearch();" class="search-result-item p-2 rounded cursor-pointer transition-colors">
                    <p class="font-medium">${priorityEmoji} ${escapeHtml(task.title)}</p>
                    ${task.project_name ? `<p class="text-xs text-gray-500">📁 ${escapeHtml(task.project_name)}</p>` : ''}
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (results.milestones.length > 0) {
        html += '<div class="p-2 border-b"><p class="text-xs font-semibold text-gray-500 mb-2">ЭТАПЫ</p>';
        results.milestones.forEach(milestone => {
            html += `
                <div onclick="openProject(${milestone.project_id}); switchWorkspaceTab('roadmap'); closeSearch();" class="search-result-item p-2 rounded cursor-pointer transition-colors">
                    <p class="font-medium">🗺️ ${escapeHtml(milestone.name)}</p>
                    <p class="text-xs text-gray-500">Проект: ${escapeHtml(milestone.project_name)}</p>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (results.notes.length > 0) {
        html += '<div class="p-2"><p class="text-xs font-semibold text-gray-500 mb-2">ЗАМЕТКИ</p>';
        results.notes.forEach(note => {
            html += `
                <div onclick="switchTab('notes'); closeSearch();" class="search-result-item p-2 rounded cursor-pointer transition-colors">
                    <p class="font-medium">📝 ${escapeHtml(note.title)}</p>
                    <p class="text-xs text-gray-500 line-clamp-1">${escapeHtml(note.content)}</p>
                </div>
            `;
        });
        html += '</div>';
    }
    
    searchResults.innerHTML = html;
    searchResults.classList.remove('hidden');
}

function closeSearch() {
    document.getElementById('globalSearch').value = '';
    document.getElementById('searchResults').classList.add('hidden');
}

function openTaskFromSearch(taskId, projectId) {
    if (projectId) {
        // Если задача в проекте — открыть проект и показать задачу
        openProject(projectId);
        switchWorkspaceTab('tasks');
        setTimeout(() => openEditTaskModal(taskId), 300);
    } else {
        // Если задача не в проекте — перейти на вкладку задач и открыть
        switchTab('tasks');
        setTimeout(() => openEditTaskModal(taskId), 300);
    }
}
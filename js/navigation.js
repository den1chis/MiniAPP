// ========== НАВИГАЦИЯ ==========

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-blue-500', 'text-white');
        el.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    const viewEl = document.getElementById(`view-${tab}`);
    if (viewEl) {
        viewEl.classList.remove('hidden');
    }
    
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) {
        tabEl.classList.remove('bg-gray-100', 'text-gray-600');
        tabEl.classList.add('bg-blue-500', 'text-white');
    }
    
    document.getElementById('workspaceTabs')?.classList.add('hidden');
    document.getElementById('backBtn')?.classList.add('hidden');
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = 'Планировщик';
    }
    
    // Загрузить данные вкладки
    if (tab === 'profile') loadProfile();
    if (tab === 'tasks') loadTasks();
    if (tab === 'kanban') loadKanban();
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'calendar') loadCalendar();
    if (tab === 'projects') loadProjects();
    if (tab === 'notes') loadNotes();
    if (tab === 'settings') checkUpcomingDeadlines();
    if (tab === 'achievements') loadAchievements();
}

function switchWorkspaceTab(wsTab) {
    currentWorkspaceTab = wsTab;
    
    document.querySelectorAll('.workspace-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.ws-tab-btn').forEach(el => {
        el.classList.remove('bg-blue-500', 'text-white');
        el.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    document.getElementById(`workspace-${wsTab}`)?.classList.remove('hidden');
    const wsTabBtn = document.getElementById(`ws-tab-${wsTab}`);
    if (wsTabBtn) {
        wsTabBtn.classList.remove('bg-gray-100', 'text-gray-600');
        wsTabBtn.classList.add('bg-blue-500', 'text-white');
    }
    
    if (wsTab === 'overview') loadWorkspaceOverview();
    if (wsTab === 'tasks') loadWorkspaceTasks();
    if (wsTab === 'subprojects') loadSubprojects();
    if (wsTab === 'roadmap') loadMilestones();
    if (wsTab === 'documents') loadDocuments();
}

function openProject(projectId) {
    currentProject = projectId;

    document.getElementById('mainTabs')?.classList.add('hidden');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    document.getElementById('view-workspace')?.classList.remove('hidden');
    document.getElementById('workspaceTabs')?.classList.remove('hidden');
    document.getElementById('workspaceTabs')?.classList.add('flex');
    document.getElementById('backBtn')?.classList.remove('hidden');

    loadProjectDetail();
    switchWorkspaceTab('overview');
}

function goBack() {
    // Если открыт подпроект - вернуться к списку подпроектов
    if (window.currentSubprojectId) {
        closeSubprojectDetail();
        return;
    }
    
    // Если открыт workspace - вернуться к проектам
    if (window.currentProjectId) {
        document.getElementById('view-workspace')?.classList.add('hidden');
        document.getElementById('view-projects')?.classList.remove('hidden');
        document.getElementById('workspaceTabs')?.classList.add('hidden');
        document.getElementById('workspaceTabs')?.classList.remove('flex');
        document.getElementById('mainTabs')?.classList.remove('hidden');
        document.getElementById('backBtn')?.classList.add('hidden');
        
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = 'Планировщик';
        }
        
        switchTab('projects');
        window.currentProjectId = null;
    }
}
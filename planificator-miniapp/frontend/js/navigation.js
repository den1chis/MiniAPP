// ========== НАВИГАЦИЯ ==========

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-blue-500', 'text-white');
        el.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.remove('bg-gray-100', 'text-gray-600');
    document.getElementById(`tab-${tab}`).classList.add('bg-blue-500', 'text-white');
    
    document.getElementById('workspaceTabs').classList.add('hidden');
    document.getElementById('backBtn').classList.add('hidden');
    document.getElementById('pageTitle').textContent = 'Планировщик';
    
    if (tab === 'tasks') loadTasks();
    if (tab === 'kanban') loadKanban();
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'calendar') loadCalendar();
    if (tab === 'projects') loadProjects();
    if (tab === 'notes') loadNotes();
    if (tab === 'settings') checkUpcomingDeadlines();
}

function switchWorkspaceTab(wsTab) {
    currentWorkspaceTab = wsTab;
    
    document.querySelectorAll('.workspace-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.ws-tab-btn').forEach(el => {
        el.classList.remove('bg-blue-500', 'text-white');
        el.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    document.getElementById(`workspace-${wsTab}`).classList.remove('hidden');
    document.getElementById(`ws-tab-${wsTab}`).classList.remove('bg-gray-100', 'text-gray-600');
    document.getElementById(`ws-tab-${wsTab}`).classList.add('bg-blue-500', 'text-white');
    
    if (wsTab === 'overview') loadWorkspaceOverview();
    if (wsTab === 'tasks') loadWorkspaceTasks();
    if (wsTab === 'subprojects') loadSubprojects();
    if (wsTab === 'roadmap') loadMilestones();
    if (wsTab === 'documents') loadDocuments();
}

function openProject(projectId) {
    currentProject = projectId;

    document.getElementById('mainTabs').classList.add('hidden');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    document.getElementById('view-workspace').classList.remove('hidden'); // ← КЛЮЧ
    document.getElementById('workspaceTabs').classList.remove('hidden');
    document.getElementById('workspaceTabs').classList.add('flex');
    document.getElementById('backBtn').classList.remove('hidden');

    loadProjectDetail();
    switchWorkspaceTab('overview');
}


function goBack() {
    currentProject = null;
    
    document.getElementById('mainTabs').classList.remove('hidden');
    document.getElementById('workspaceTabs').classList.add('hidden');
    document.getElementById('workspaceTabs').classList.remove('flex');
    document.getElementById('backBtn').classList.add('hidden');
    
    document.querySelectorAll('.workspace-content').forEach(el => el.classList.add('hidden'));
    
    switchTab('projects');
}
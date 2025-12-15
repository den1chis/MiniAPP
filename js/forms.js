// ========== ПЕРЕКЛЮЧАТЕЛИ ФОРМ ==========

function toggleProjectForm() {
    const container = document.getElementById('projectFormContainer');
    const btn = document.getElementById('toggleProjectFormBtn');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span>';
        document.getElementById('newProjectName').focus();
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span class="hidden sm:inline">Новый проект</span>';
        // Очистка
        document.getElementById('newProjectName').value = '';
        document.getElementById('newProjectDescription').value = '';
        document.getElementById('newProjectIcon').value = '';
        document.getElementById('newProjectColor').value = '#3B82F6';
    }
}

function toggleNoteForm() {
    const container = document.getElementById('noteFormContainer');
    const btn = document.getElementById('toggleNoteFormBtn');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span>';
        document.getElementById('newNoteTitle').focus();
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span class="hidden sm:inline">Новая заметка</span>';
        // Очистка
        document.getElementById('newNoteTitle').value = '';
        document.getElementById('newNoteContent').value = '';
        document.getElementById('newNoteTags').value = '';
    }
}

function toggleSubprojectForm() {
    const container = document.getElementById('subprojectFormContainer');
    const btn = document.getElementById('toggleSubprojectFormBtn');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span>';
        document.getElementById('newSubprojectName').focus();
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span class="hidden sm:inline">Новый подпроект</span>';
        // Очистка
        document.getElementById('newSubprojectName').value = '';
        document.getElementById('newSubprojectDescription').value = '';
    }
}

function toggleMilestoneForm() {
    const container = document.getElementById('milestoneFormContainer');
    const btn = document.getElementById('toggleMilestoneFormBtn');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span>';
        document.getElementById('newMilestoneName').focus();
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span class="hidden sm:inline">Новый этап</span>';
        // Очистка
        document.getElementById('newMilestoneName').value = '';
        document.getElementById('newMilestoneDescription').value = '';
        document.getElementById('milestoneStartDate').value = '';
        document.getElementById('milestoneEndDate').value = '';
    }
}

function toggleProjectNoteForm() {
    const container = document.getElementById('projectNoteFormContainer');
    const btn = document.getElementById('toggleProjectNoteFormBtn');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span>';
        document.getElementById('newProjectNoteTitle').focus();
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span class="hidden sm:inline">Новая заметка</span>';
        // Очистка
        document.getElementById('newProjectNoteTitle').value = '';
        document.getElementById('newProjectNoteContent').value = '';
    }
}
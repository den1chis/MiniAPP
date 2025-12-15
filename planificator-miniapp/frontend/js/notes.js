// ========== ЗАМЕТКИ ==========

async function loadNotes() {
    try {
        const response = await fetch(`${API_URL}/notes/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const notes = await response.json();
        renderNotes(notes);
    } catch (error) {
        console.error('Ошибка загрузки заметок:', error);
        showError('Не удалось загрузить заметки');
    }
}

function renderNotes(notes) {
    const noteList = document.getElementById('noteList');
    
    if (notes.length === 0) {
        noteList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет заметок</p>';
        return;
    }
    
    noteList.innerHTML = notes.map(note => `
        <div class="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-semibold text-gray-800">${escapeHtml(note.title)}</h3>
                <button 
                    onclick="deleteNote(${note.id})"
                    class="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                >
                    ✕
                </button>
            </div>
            <p class="text-sm text-gray-600 mb-2 whitespace-pre-wrap">${escapeHtml(note.content)}</p>
            ${note.tags && note.tags.length > 0 ? `
                <div class="flex flex-wrap gap-1">
                    ${note.tags.map(tag => `
                        <span class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">#${escapeHtml(tag)}</span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function addNote() {
    const title = document.getElementById('newNoteTitle').value.trim();
    const content = document.getElementById('newNoteContent').value.trim();
    const tagsInput = document.getElementById('newNoteTags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    
    if (!title || !content) {
        if (!title) document.getElementById('newNoteTitle').focus();
        else document.getElementById('newNoteContent').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/notes/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ title, content, tags })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        document.getElementById('newNoteTitle').value = '';
        document.getElementById('newNoteContent').value = '';
        document.getElementById('newNoteTags').value = '';
        
        await loadNotes();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка создания заметки:', error);
        showError('Не удалось создать заметку');
    }
}

async function deleteNote(id) {
    if (!confirm('Удалить заметку?')) return;
    
    try {
        const response = await fetch(`${API_URL}/notes/${id}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        await loadNotes();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления заметки:', error);
        showError('Не удалось удалить заметку');
    }
}

// Показать/скрыть форму создания заметки
function toggleNoteForm() {
    const container = document.getElementById('noteFormContainer');
    const btn = document.querySelector('[onclick="toggleNoteForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Создать заметку</span>';
        // Очистка полей
        document.getElementById('newNoteTitle').value = '';
        document.getElementById('newNoteContent').value = '';
        document.getElementById('newNoteTags').value = '';
    }
}
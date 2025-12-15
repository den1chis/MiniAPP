// Загрузка заметок
async function loadNotes() {
    try {
        const notes = await NoteAPI.getAll();
        renderNotes(notes);
    } catch (error) {
        console.error('Ошибка загрузки заметок:', error);
        showNotification('Ошибка загрузки заметок', 'error');
    }
}

// Отрисовка заметок
function renderNotes(notes) {
    const container = document.getElementById('noteList');
    
    if (!notes || notes.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет заметок</p>';
        return;
    }
    
    container.innerHTML = notes.map(note => `
        <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-bold text-gray-800">${note.title}</h3>
                <button onclick="deleteNote(${note.id})" class="text-red-600 hover:text-red-800">🗑️</button>
            </div>
            
            ${note.content ? `<p class="text-gray-600 text-sm mb-2">${note.content}</p>` : ''}
            
            ${note.tags ? `
                <div class="flex flex-wrap gap-1">
                    ${note.tags.split(',').map(tag => `
                        <span class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">#${tag.trim()}</span>
                    `).join('')}
                </div>
            ` : ''}
            
            <p class="text-xs text-gray-400 mt-2">${new Date(note.created_at).toLocaleDateString('ru-RU')}</p>
        </div>
    `).join('');
}

// Добавить заметку
async function addNote() {
    const title = document.getElementById('newNoteTitle').value.trim();
    const content = document.getElementById('newNoteContent').value.trim();
    const tags = document.getElementById('newNoteTags').value.trim();
    
    if (!title) {
        showNotification('Введите заголовок заметки', 'error');
        return;
    }
    
    try {
        await NoteAPI.create({
            title,
            content,
            tags
        });
        
        document.getElementById('newNoteTitle').value = '';
        document.getElementById('newNoteContent').value = '';
        document.getElementById('newNoteTags').value = '';
        
        showNotification('Заметка создана', 'success');
        await loadNotes();
        
        // Закрыть форму
        toggleNoteForm();
    } catch (error) {
        console.error('Ошибка создания заметки:', error);
        showNotification('Ошибка создания заметки', 'error');
    }
}

// Удалить заметку
async function deleteNote(id) {
    if (!confirm('Удалить заметку?')) return;
    
    try {
        await NoteAPI.delete(id);
        showNotification('Заметка удалена', 'success');
        await loadNotes();
    } catch (error) {
        console.error('Ошибка удаления заметки:', error);
        showNotification('Ошибка удаления заметки', 'error');
    }
}

// Показать/скрыть форму
function toggleNoteForm() {
    const container = document.getElementById('noteFormContainer');
    const btn = document.querySelector('[onclick="toggleNoteForm()"]');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerHTML = '<span>✕</span><span>Закрыть</span>';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span>+</span><span>Создать заметку</span>';
        document.getElementById('newNoteTitle').value = '';
        document.getElementById('newNoteContent').value = '';
        document.getElementById('newNoteTags').value = '';
    }
}
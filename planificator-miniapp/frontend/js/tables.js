// ========== ТАБЛИЦЫ ==========

// ========== СПИСОК ТАБЛИЦ ==========

async function loadSubprojectTables() {
    if (!currentSubproject) return;
    
    try {
        const response = await fetch(`${API_URL}/subprojects/${currentSubproject}/tables/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tables = await response.json();
        renderSubprojectTables(tables);
    } catch (error) {
        console.error('Ошибка загрузки таблиц:', error);
        showError('Не удалось загрузить таблицы');
    }
}

function renderSubprojectTables(tables) {
    const tableList = document.getElementById('spTableList');
    
    if (tables.length === 0) {
        tableList.innerHTML = '<p class="text-center text-gray-400 py-8">Нет таблиц. Создайте первую!</p>';
        return;
    }
    
    tableList.innerHTML = tables.map(table => {
        const completedRows = table.rows.filter(row => {
            const checkboxIndex = table.columns.findIndex(col => col.type === 'checkbox');
            return checkboxIndex !== -1 && row.cells[checkboxIndex] === true;
        }).length;
        
        return `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="font-semibold text-gray-800">📊 ${escapeHtml(table.name)}</h3>
                    <div class="flex gap-2">
                        <button onclick="openEditTableModal(${table.id})" class="text-blue-600 hover:text-blue-800 text-sm px-2 py-1">
                            ✏️ Редактировать
                        </button>
                        <button onclick="deleteTable(${table.id})" class="text-red-500 hover:text-red-700 text-sm px-2 py-1">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="overflow-x-auto mb-2">
                    ${renderTablePreview(table)}
                </div>
                
                <div class="text-xs text-gray-500">
                    ${table.rows.length} строк, ${table.columns.length} колонок
                    ${completedRows > 0 ? `• ${completedRows}/${table.rows.length} выполнено` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderTablePreview(table) {
    if (table.rows.length === 0) {
        return '<p class="text-sm text-gray-400">Пустая таблица</p>';
    }
    
    // Показываем только первые 3 строки для превью
    const previewRows = table.rows.slice(0, 3);
    
    return `
        <table class="w-full text-sm border-collapse">
            <thead>
                <tr class="bg-gray-50 border-b">
                    ${table.columns.map(col => `
                        <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-r last:border-r-0">
                            ${escapeHtml(col.name)}
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
                ${previewRows.map((row, rowIndex) => `
                    <tr class="border-b last:border-b-0 hover:bg-gray-50">
                        ${row.cells.map((cell, colIndex) => {
                            const column = table.columns[colIndex];
                            return `
                                <td class="px-3 py-2 border-r last:border-r-0">
                                    ${formatTableCell(cell, column.type)}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `).join('')}
                ${table.rows.length > 3 ? `
                    <tr>
                        <td colspan="${table.columns.length}" class="px-3 py-2 text-center text-xs text-gray-400">
                            ... ещё ${table.rows.length - 3} строк
                        </td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    `;
}

function formatTableCell(value, type) {
    if (value === null || value === undefined || value === '') {
        return '<span class="text-gray-300">—</span>';
    }
    
    switch (type) {
        case 'checkbox':
            return value ? '☑' : '☐';
        case 'date':
            return new Date(value).toLocaleDateString('ru-RU');
        case 'number':
            return value.toLocaleString('ru-RU');
        default:
            return escapeHtml(String(value));
    }
}

// ========== СОЗДАНИЕ ТАБЛИЦЫ ==========

function openCreateTableModal() {
    // Сбросить форму
    document.getElementById('tableName').value = '';
    document.getElementById('tableRows').value = 3;
    
    // Установить базовые колонки
    const columnsContainer = document.getElementById('tableColumns');
    columnsContainer.innerHTML = `
        <div class="flex gap-2">
            <input type="text" placeholder="Название колонки" value="Название" class="flex-1 px-3 py-2 border rounded-lg table-col-name">
            <select class="px-3 py-2 border rounded-lg table-col-type">
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date">Дата</option>
                <option value="checkbox">Чекбокс</option>
                <option value="select">Выбор</option>
            </select>
            <button onclick="removeTableColumn(this)" class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg">✕</button>
        </div>
        <div class="flex gap-2">
            <input type="text" placeholder="Название колонки" value="Дедлайн" class="flex-1 px-3 py-2 border rounded-lg table-col-name">
            <select class="px-3 py-2 border rounded-lg table-col-type">
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date" selected>Дата</option>
                <option value="checkbox">Чекбокс</option>
                <option value="select">Выбор</option>
            </select>
            <button onclick="removeTableColumn(this)" class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg">✕</button>
        </div>
        <div class="flex gap-2">
            <input type="text" placeholder="Название колонки" value="Выполнено" class="flex-1 px-3 py-2 border rounded-lg table-col-name">
            <select class="px-3 py-2 border rounded-lg table-col-type">
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date">Дата</option>
                <option value="checkbox" selected>Чекбокс</option>
                <option value="select">Выбор</option>
            </select>
            <button onclick="removeTableColumn(this)" class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg">✕</button>
        </div>
    `;
    
    document.getElementById('createTableModal').classList.remove('hidden');
}

function closeCreateTableModal() {
    document.getElementById('createTableModal').classList.add('hidden');
}

function addTableColumn() {
    const columnsContainer = document.getElementById('tableColumns');
    const newColumn = document.createElement('div');
    newColumn.className = 'flex gap-2';
    newColumn.innerHTML = `
        <input type="text" placeholder="Название колонки" class="flex-1 px-3 py-2 border rounded-lg table-col-name">
        <select class="px-3 py-2 border rounded-lg table-col-type">
            <option value="text">Текст</option>
            <option value="number">Число</option>
            <option value="date">Дата</option>
            <option value="checkbox">Чекбокс</option>
            <option value="select">Выбор</option>
        </select>
        <button onclick="removeTableColumn(this)" class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg">✕</button>
    `;
    columnsContainer.appendChild(newColumn);
}

function removeTableColumn(button) {
    const columnsContainer = document.getElementById('tableColumns');
    if (columnsContainer.children.length <= 1) {
        showError('Таблица должна иметь минимум 1 колонку');
        return;
    }
    button.parentElement.remove();
}

async function createTable() {
    const name = document.getElementById('tableName').value.trim();
    const rowsCount = parseInt(document.getElementById('tableRows').value) || 0;
    
    if (!name) {
        document.getElementById('tableName').focus();
        return;
    }
    
    // Собрать колонки
    const columnElements = document.querySelectorAll('#tableColumns > div');
    const columns = Array.from(columnElements).map(el => {
        const nameInput = el.querySelector('.table-col-name');
        const typeSelect = el.querySelector('.table-col-type');
        return {
            name: nameInput.value.trim() || 'Колонка',
            type: typeSelect.value
        };
    });
    
    if (columns.length === 0) {
        showError('Добавьте хотя бы одну колонку');
        return;
    }
    
    // Создать пустые строки
    const rows = [];
    for (let i = 0; i < rowsCount; i++) {
        const cells = columns.map(col => {
            if (col.type === 'checkbox') return false;
            if (col.type === 'number') return 0;
            return '';
        });
        rows.push({ id: i + 1, cells });
    }
    
    try {
        const response = await fetch(`${API_URL}/subprojects/${currentSubproject}/tables/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({ name, columns, rows })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        closeCreateTableModal();
        await loadSubprojectTables();
        await loadSubprojectDetail(); // Обновить счётчики
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка создания таблицы:', error);
        showError('Не удалось создать таблицу');
    }
}

async function deleteTable(tableId) {
    if (!confirm('Удалить таблицу? Все данные будут потеряны.')) return;
    
    try {
        const response = await fetch(`${API_URL}/tables/${tableId}/`, {
            method: 'DELETE',
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        await loadSubprojectTables();
        await loadSubprojectDetail();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка удаления таблицы:', error);
        showError('Не удалось удалить таблицу');
    }
}

// ========== РЕДАКТИРОВАНИЕ ТАБЛИЦЫ ==========

let currentEditingTable = null;

async function openEditTableModal(tableId) {
    try {
        const response = await fetch(`${API_URL}/tables/${tableId}/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const table = await response.json();
        currentEditingTable = table;
        
        // Создать модальное окно для редактирования
        renderEditTableModal(table);
    } catch (error) {
        console.error('Ошибка загрузки таблицы:', error);
        showError('Не удалось загрузить таблицу');
    }
}

function renderEditTableModal(table) {
    // Создать полноэкранное модальное окно
    const modal = document.createElement('div');
    modal.id = 'editTableFullModal';
    modal.className = 'fixed inset-0 bg-white z-50 overflow-auto';
    
    modal.innerHTML = `
        <div class="max-w-6xl mx-auto p-4">
            <div class="flex items-center justify-between mb-4 sticky top-0 bg-white py-2 border-b">
                <h2 class="text-xl font-bold">📊 ${escapeHtml(table.name)}</h2>
                <div class="flex gap-2">
                    <button onclick="saveTableEdit()" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Сохранить
                    </button>
                    <button onclick="closeEditTableFullModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                        Закрыть
                    </button>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border" id="editableTable">
                    <thead>
                        <tr class="bg-gray-100">
                            ${table.columns.map((col, index) => `
                                <th class="border px-3 py-2 min-w-[150px]">
                                    <input 
                                        type="text" 
                                        value="${escapeHtml(col.name)}" 
                                        class="w-full px-2 py-1 border rounded font-semibold bg-white"
                                        onchange="updateColumnName(${index}, this.value)"
                                    >
                                    <div class="text-xs text-gray-500 mt-1">${getColumnTypeLabel(col.type)}</div>
                                </th>
                            `).join('')}
                            <th class="border px-3 py-2 w-12"></th>
                        </tr>
                    </thead>
                    <tbody id="editableTableBody">
                        ${table.rows.map((row, rowIndex) => renderEditableRow(row, rowIndex, table.columns)).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-4 flex gap-2">
                <button onclick="addTableRow()" class="px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                    + Добавить строку
                </button>
                <button onclick="addTableColumnToExisting()" class="px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                    + Добавить колонку
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function renderEditableRow(row, rowIndex, columns) {
    return `
        <tr class="hover:bg-gray-50" data-row-id="${row.id}">
            ${row.cells.map((cell, colIndex) => {
                const column = columns[colIndex];
                return `
                    <td class="border px-3 py-2">
                        ${renderEditableCell(cell, column.type, rowIndex, colIndex)}
                    </td>
                `;
            }).join('')}
            <td class="border px-2 py-2">
                <button onclick="deleteTableRow(${rowIndex})" class="text-red-500 hover:text-red-700 text-sm">
                    🗑️
                </button>
            </td>
        </tr>
    `;
}

function renderEditableCell(value, type, rowIndex, colIndex) {
    const inputId = `cell-${rowIndex}-${colIndex}`;
    
    switch (type) {
        case 'checkbox':
            return `
                <input 
                    type="checkbox" 
                    ${value ? 'checked' : ''}
                    class="w-5 h-5 cursor-pointer"
                    onchange="updateCell(${rowIndex}, ${colIndex}, this.checked)"
                >
            `;
        case 'date':
            const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
            return `
                <input 
                    type="date" 
                    value="${dateValue}"
                    class="w-full px-2 py-1 border rounded"
                    onchange="updateCell(${rowIndex}, ${colIndex}, this.value)"
                >
            `;
        case 'number':
            return `
                <input 
                    type="number" 
                    value="${value || 0}"
                    class="w-full px-2 py-1 border rounded"
                    onchange="updateCell(${rowIndex}, ${colIndex}, parseFloat(this.value) || 0)"
                >
            `;
        default:
            return `
                <input 
                    type="text" 
                    value="${escapeHtml(String(value || ''))}"
                    class="w-full px-2 py-1 border rounded"
                    onchange="updateCell(${rowIndex}, ${colIndex}, this.value)"
                >
            `;
    }
}

function getColumnTypeLabel(type) {
    const labels = {
        text: '📝 Текст',
        number: '🔢 Число',
        date: '📅 Дата',
        checkbox: '☑️ Чекбокс',
        select: '🎨 Выбор'
    };
    return labels[type] || type;
}

function updateCell(rowIndex, colIndex, value) {
    if (!currentEditingTable) return;
    currentEditingTable.rows[rowIndex].cells[colIndex] = value;
}

function updateColumnName(colIndex, name) {
    if (!currentEditingTable) return;
    currentEditingTable.columns[colIndex].name = name;
}

function addTableRow() {
    if (!currentEditingTable) return;
    
    const newCells = currentEditingTable.columns.map(col => {
        if (col.type === 'checkbox') return false;
        if (col.type === 'number') return 0;
        return '';
    });
    
    const newRow = {
        id: Date.now(),
        cells: newCells
    };
    
    currentEditingTable.rows.push(newRow);
    
    // Перерисовать таблицу
    const tbody = document.getElementById('editableTableBody');
    const newRowIndex = currentEditingTable.rows.length - 1;
    tbody.insertAdjacentHTML('beforeend', renderEditableRow(newRow, newRowIndex, currentEditingTable.columns));
}

function deleteTableRow(rowIndex) {
    if (!currentEditingTable) return;
    if (!confirm('Удалить строку?')) return;
    
    currentEditingTable.rows.splice(rowIndex, 1);
    
    // Перерисовать таблицу
    document.querySelector(`[data-row-id="${currentEditingTable.rows[rowIndex]?.id}"]`)?.remove();
    
    // Перерисовать всю таблицу чтобы обновить индексы
    const tbody = document.getElementById('editableTableBody');
    tbody.innerHTML = currentEditingTable.rows.map((row, idx) => 
        renderEditableRow(row, idx, currentEditingTable.columns)
    ).join('');
}

function addTableColumnToExisting() {
    if (!currentEditingTable) return;
    
    const columnName = prompt('Название новой колонки:');
    if (!columnName) return;
    
    // Добавить колонку
    currentEditingTable.columns.push({
        name: columnName,
        type: 'text'
    });
    
    // Добавить пустые ячейки во все строки
    currentEditingTable.rows.forEach(row => {
        row.cells.push('');
    });
    
    // Перерисовать модальное окно
    closeEditTableFullModal();
    renderEditTableModal(currentEditingTable);
}

async function saveTableEdit() {
    if (!currentEditingTable) return;
    
    try {
        const response = await fetch(`${API_URL}/tables/${currentEditingTable.id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({
                name: currentEditingTable.name,
                columns: currentEditingTable.columns,
                rows: currentEditingTable.rows
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        closeEditTableFullModal();
        await loadSubprojectTables();
        hapticFeedback('success');
    } catch (error) {
        console.error('Ошибка сохранения таблицы:', error);
        showError('Не удалось сохранить таблицу');
    }
}

function closeEditTableFullModal() {
    const modal = document.getElementById('editTableFullModal');
    if (modal) {
        modal.remove();
    }
    currentEditingTable = null;
}
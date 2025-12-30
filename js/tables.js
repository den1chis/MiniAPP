// ========== ТАБЛИЦЫ ПОДПРОЕКТОВ ==========

// Загрузка таблиц
async function loadSubprojectTables() {
    try {
        const tables = await SpTableAPI.getAll(window.currentSubprojectId);
        renderSubprojectTables(tables);
    } catch (error) {
        console.error('Ошибка загрузки таблиц:', error);
        showNotification('Ошибка загрузки таблиц', 'error');
    }
}

// Отрисовка таблиц
function renderSubprojectTables(tables) {
    const container = document.getElementById('spTableList');
    
    if (!tables || tables.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет таблиц</p>';
        return;
    }
    
    container.innerHTML = tables.map(table => `
        <div class="bg-white border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-bold text-gray-800">${table.name}</h3>
                <div class="flex gap-2">
                    <button onclick="addTableRow(${table.id})" class="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600">+ Строка</button>
                    <button onclick="deleteTable(${table.id})" class="text-red-600 hover:text-red-800">🗑️</button>
                </div>
            </div>
            <div id="table-${table.id}" class="overflow-x-auto">
                <p class="text-sm text-gray-500">Загрузка...</p>
            </div>
        </div>
    `).join('');
    
    // Загрузить данные каждой таблицы
    tables.forEach(table => loadTableData(table.id, table.columns));
}

// Загрузка данных таблицы
async function loadTableData(tableId, columns) {
    try {
        const rows = await SpTableAPI.getRows(tableId);
        renderTable(tableId, columns, rows);
    } catch (error) {
        console.error('Ошибка загрузки данных таблицы:', error);
    }
}

// Отрисовка таблицы с inline-редактированием
function renderTable(tableId, columns, rows) {
    const container = document.getElementById(`table-${tableId}`);
    
    if (!container) return;
    
    let html = '<table class="min-w-full border-collapse text-sm">';
    
    // Заголовки
    html += '<thead class="bg-gray-100"><tr>';
    columns.forEach(col => {
        html += `<th class="border border-gray-300 px-3 py-2 text-left font-semibold">${col.name}</th>`;
    });
    html += '<th class="border border-gray-300 px-3 py-2 text-center w-16">⚙️</th>';
    html += '</tr></thead>';
    
    // Строки
    html += '<tbody>';
    if (rows.length === 0) {
        html += `<tr><td colspan="${columns.length + 1}" class="border border-gray-300 px-3 py-2 text-center text-gray-500">Нет данных</td></tr>`;
    } else {
        rows.forEach(row => {
            html += `<tr class="hover:bg-gray-50">`;
            columns.forEach(col => {
                const value = row.row_data[col.name] !== undefined ? row.row_data[col.name] : '';
                html += `<td class="border border-gray-300 px-2 py-1">`;
                
                if (col.type === 'checkbox') {
                    html += `<input type="checkbox" ${value ? 'checked' : ''} onchange="updateTableCell(${tableId}, ${row.id}, '${col.name}', this.checked)" class="w-5 h-5">`;
                } else if (col.type === 'date') {
                    html += `<input type="date" value="${value}" onchange="updateTableCell(${tableId}, ${row.id}, '${col.name}', this.value)" class="w-full px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded">`;
                } else if (col.type === 'number') {
                    html += `<input type="number" value="${value}" onchange="updateTableCell(${tableId}, ${row.id}, '${col.name}', this.value)" class="w-full px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded">`;
                } else {
                    html += `<input type="text" value="${value}" onchange="updateTableCell(${tableId}, ${row.id}, '${col.name}', this.value)" class="w-full px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded">`;
                }
                
                html += `</td>`;
            });
            html += `<td class="border border-gray-300 px-2 py-1 text-center">
                <button onclick="deleteTableRow(${tableId}, ${row.id})" class="text-red-600 hover:text-red-800 text-lg">🗑️</button>
            </td>`;
            html += '</tr>';
        });
    }
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

// Обновить ячейку таблицы (inline editing)
async function updateTableCell(tableId, rowId, columnName, newValue) {
    try {
        const rows = await SpTableAPI.getRows(tableId);
        const row = rows.find(r => r.id === rowId);
        
        if (!row) return;
        
        // Обновить значение
        row.row_data[columnName] = newValue;
        
        await SpTableAPI.updateRow(rowId, row.row_data);
        
        // Не показываем уведомление при каждом изменении - слишком навязчиво
        console.log('Cell updated:', columnName, newValue);
    } catch (error) {
        console.error('Ошибка обновления ячейки:', error);
        showNotification('Ошибка обновления', 'error');
    }
}

// ========== СОЗДАНИЕ ТАБЛИЦЫ ==========

// Открыть модальное окно создания таблицы
function openCreateTableModal() {
    document.getElementById('createTableModal').classList.remove('hidden');
    
    // Добавить первую колонку по умолчанию
    const columnsContainer = document.getElementById('tableColumns');
    if (columnsContainer.children.length === 0) {
        addTableColumn();
    }
}

// Закрыть модальное окно создания таблицы
function closeCreateTableModal() {
    document.getElementById('createTableModal').classList.add('hidden');
    document.getElementById('tableName').value = '';
    document.getElementById('tableColumns').innerHTML = '';
    document.getElementById('tableRows').value = '3';
}

// Добавить колонку в форму
function addTableColumn() {
    const container = document.getElementById('tableColumns');
    const columnDiv = document.createElement('div');
    columnDiv.className = 'flex gap-2';
    columnDiv.innerHTML = `
        <input type="text" placeholder="Название колонки" class="flex-1 px-3 py-2 border rounded-lg table-col-name">
        <select class="px-3 py-2 border rounded-lg table-col-type">
            <option value="text">Текст</option>
            <option value="number">Число</option>
            <option value="date">Дата</option>
            <option value="checkbox">Чекбокс</option>
        </select>
        <button onclick="removeTableColumn(this)" class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg">✕</button>
    `;
    container.appendChild(columnDiv);
}

// Удалить колонку из формы
function removeTableColumn(btn) {
    btn.parentElement.remove();
}

// Создать таблицу
async function createTable() {
    const name = document.getElementById('tableName').value.trim();
    const rowsCount = parseInt(document.getElementById('tableRows').value) || 0;
    
    if (!name) {
        showNotification('Введите название таблицы', 'error');
        return;
    }
    
    // Собрать колонки
    const columnNames = Array.from(document.querySelectorAll('.table-col-name')).map(input => input.value.trim());
    const columnTypes = Array.from(document.querySelectorAll('.table-col-type')).map(select => select.value);
    
    if (columnNames.length === 0 || columnNames.some(name => !name)) {
        showNotification('Заполните все названия колонок', 'error');
        return;
    }
    
    const columns = columnNames.map((name, index) => ({
        name: name,
        type: columnTypes[index]
    }));
    
    try {
        // Создать таблицу (ОДИН РАЗ)
        const table = await SpTableAPI.create({
            subproject_id: window.currentSubprojectId,
            name,
            columns
        });
        
        // ✅ НАЧИСЛИТЬ XP ЗА ТАБЛИЦУ
        const result = await TreeAPI.addXP(getUserId(), 'table_created');
        if (result) {
            showXPNotification(result.totalXP, 'Таблица создана');
            
            if (result.leveledUp) {
                showLevelUpNotification(result.newLevel);
            }
            
            TreeAPI.refreshProfileDebounced();
        }
        
        // Создать пустые строки
        for (let i = 0; i < rowsCount; i++) {
            const emptyRow = {};
            columns.forEach(col => {
                emptyRow[col.name] = col.type === 'checkbox' ? false : '';
            });
            await SpTableAPI.createRow(table.id, emptyRow);
            
            // ✅ НАЧИСЛИТЬ XP ЗА КАЖДУЮ СТРОКУ (БЕЗ УВЕДОМЛЕНИЯ)
            await TreeAPI.addXP(getUserId(), 'table_row_created');
        }
        
        showNotification('Таблица создана', 'success');
        closeCreateTableModal();
        await loadSubprojectTables();
        
    } catch (error) {
        console.error('Ошибка создания таблицы:', error);
        showNotification('Ошибка создания таблицы', 'error');
    }
}

// Удалить таблицу
async function deleteTable(tableId) {
    if (!confirm('Удалить таблицу со всеми данными?')) return;
    
    try {
        await SpTableAPI.delete(tableId);
        showNotification('Таблица удалена', 'success');
        await loadSubprojectTables();
    } catch (error) {
        console.error('Ошибка удаления таблицы:', error);
        showNotification('Ошибка удаления таблицы', 'error');
    }
}

// ========== РАБОТА СО СТРОКАМИ ==========

// Добавить строку
async function addTableRow(tableId) {
    try {
        // Получить структуру таблицы
        const tables = await SpTableAPI.getAll(window.currentSubprojectId);
        const table = tables.find(t => t.id === tableId);
        
        if (!table) return;
        
        // Создать пустую строку
        const emptyRow = {};
        table.columns.forEach(col => {
            emptyRow[col.name] = col.type === 'checkbox' ? false : '';
        });
        
        await SpTableAPI.createRow(tableId, emptyRow);
        
        // ✅ НАЧИСЛИТЬ XP (БЕЗ УВЕДОМЛЕНИЯ - МЕЛКОЕ ДЕЙСТВИЕ)
        await TreeAPI.addXP(getUserId(), 'table_row_created');
        
        showNotification('Строка добавлена', 'success');
        await loadTableData(tableId, table.columns);
        
    } catch (error) {
        console.error('Ошибка добавления строки:', error);
        showNotification('Ошибка добавления строки', 'error');
    }
}

// Удалить строку
async function deleteTableRow(tableId, rowId) {
    if (!confirm('Удалить строку?')) return;
    
    try {
        const tables = await SpTableAPI.getAll(window.currentSubprojectId);
        const table = tables.find(t => t.id === tableId);
        
        await SpTableAPI.deleteRow(rowId);
        showNotification('Строка удалена', 'success');
        await loadTableData(tableId, table.columns);
    } catch (error) {
        console.error('Ошибка удаления строки:', error);
        showNotification('Ошибка удаления строки', 'error');
    }
}
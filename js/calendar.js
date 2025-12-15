// Текущий месяц и год
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Загрузка календаря
async function loadCalendar() {
    await updateCalendarProjectFilter();
    await renderCalendar();
}

// Обновить фильтр проектов
async function updateCalendarProjectFilter() {
    try {
        const projects = await ProjectAPI.getAll();
        
        const select = document.getElementById('calendarFilterProject');
        if (!select) return;
        
        const currentValue = select.value;
        const defaultOption = select.querySelector('option[value=""]');
        
        select.innerHTML = '';
        if (defaultOption) select.appendChild(defaultOption.cloneNode(true));
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.icon} ${project.name}`;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    } catch (error) {
        console.error('Ошибка загрузки проектов для календаря:', error);
    }
}

// Отрисовка календаря
async function renderCalendar() {
    // Обновить заголовок
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    document.getElementById('calendarMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Загрузить задачи
    await loadCalendarTasks();
}

// Загрузка задач для календаря
async function loadCalendarTasks() {
    try {
        const tasks = await TaskAPI.getAll();
        
        // Применить фильтры
        const filterProject = document.getElementById('calendarFilterProject')?.value || '';
        const filterPriority = document.getElementById('calendarFilterPriority')?.value || '';
        
        let filtered = tasks.filter(t => t.deadline); // Только задачи с дедлайнами
        
        if (filterProject) {
            filtered = filtered.filter(t => t.project_id == filterProject);
        }
        if (filterPriority) {
            filtered = filtered.filter(t => t.priority === filterPriority);
        }
        
        renderCalendarGrid(filtered);
    } catch (error) {
        console.error('Ошибка загрузки задач календаря:', error);
        showNotification('Ошибка загрузки задач', 'error');
    }
}

// Отрисовка сетки календаря
function renderCalendarGrid(tasks) {
    const grid = document.getElementById('calendarGrid');
    
    // Сохранить заголовки дней недели
    const headers = Array.from(grid.children).slice(0, 7);
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));
    
    // Первый день месяца
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // Определить день недели (0 = воскресенье, нужен понедельник = 1)
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // Конвертировать в пн=0
    
    // Пустые ячейки в начале
    for (let i = 0; i < startDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'border border-gray-200 p-2 min-h-[80px] bg-gray-50';
        grid.appendChild(emptyCell);
    }
    
    // Дни месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        
        // Найти задачи на этот день
        const dayTasks = tasks.filter(t => {
            if (!t.deadline) return false;
            const taskDate = new Date(t.deadline).toISOString().split('T')[0];
            return taskDate === dateStr;
        });
        
        const isToday = 
            date.getDate() === new Date().getDate() &&
            date.getMonth() === new Date().getMonth() &&
            date.getFullYear() === new Date().getFullYear();
        
        const cell = document.createElement('div');
        cell.className = `border border-gray-200 p-2 min-h-[80px] ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'}`;
        
        let html = `<div class="font-semibold text-sm mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}">${day}</div>`;
        
        if (dayTasks.length > 0) {
            html += '<div class="space-y-1">';
            dayTasks.slice(0, 3).forEach(task => {
                let bgColor = 'bg-gray-200';
                if (task.priority === 'high') bgColor = 'bg-red-200';
                if (task.priority === 'medium') bgColor = 'bg-yellow-200';
                if (task.priority === 'low') bgColor = 'bg-green-200';
                
                html += `
                    <div class="${bgColor} px-2 py-1 rounded text-xs truncate" title="${task.title}">
                        ${task.completed ? '✅' : '⬜'} ${task.title}
                    </div>
                `;
            });
            
            if (dayTasks.length > 3) {
                html += `<div class="text-xs text-gray-500">+${dayTasks.length - 3} ещё</div>`;
            }
            
            html += '</div>';
        }
        
        cell.innerHTML = html;
        grid.appendChild(cell);
    }
}

// Сменить месяц
function changeMonth(delta) {
    currentMonth += delta;
    
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    
    renderCalendar();
}

// Вернуться к сегодняшнему дню
function jumpToToday() {
    currentMonth = new Date().getMonth();
    currentYear = new Date().getFullYear();
    renderCalendar();
}
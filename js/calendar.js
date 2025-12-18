// Текущий вид календаря
let currentCalendarView = 'vertical';

// Текущий месяц и год для сетки
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Загрузка календаря
async function loadCalendar() {
    if (currentCalendarView === 'vertical') {
        await loadVerticalCalendar();
    } else {
        await loadGridCalendar();
    }
}

// Переключение вида календаря
function switchCalendarView(view) {
    currentCalendarView = view;
    
    const verticalBtn = document.getElementById('calViewVertical');
    const gridBtn = document.getElementById('calViewGrid');
    const verticalCal = document.getElementById('calendarVertical');
    const gridCal = document.getElementById('calendarGrid');
    
    if (view === 'vertical') {
        verticalBtn.classList.remove('bg-gray-100', 'text-gray-600');
        verticalBtn.classList.add('bg-blue-500', 'text-white');
        gridBtn.classList.remove('bg-blue-500', 'text-white');
        gridBtn.classList.add('bg-gray-100', 'text-gray-600');
        
        verticalCal.classList.remove('hidden');
        gridCal.classList.add('hidden');
        
        loadVerticalCalendar();
    } else {
        gridBtn.classList.remove('bg-gray-100', 'text-gray-600');
        gridBtn.classList.add('bg-blue-500', 'text-white');
        verticalBtn.classList.remove('bg-blue-500', 'text-white');
        verticalBtn.classList.add('bg-gray-100', 'text-gray-600');
        
        gridCal.classList.remove('hidden');
        verticalCal.classList.add('hidden');
        
        loadGridCalendar();
    }
}

// ========== ВЕРТИКАЛЬНЫЙ КАЛЕНДАРЬ ==========

async function loadVerticalCalendar() {
    try {
        const tasks = await TaskAPI.getAll();
        const tasksWithDeadline = tasks.filter(t => t.deadline);
        
        renderVerticalCalendar(tasksWithDeadline);
    } catch (error) {
        console.error('Ошибка загрузки вертикального календаря:', error);
    }
}

function renderVerticalCalendar(tasks) {
    const container = document.getElementById('calendarVertical');
    
    // Генерируем 30 дней (вчера + сегодня + 28 дней вперёд)
    const days = [];
    for (let i = -1; i < 29; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        days.push(date);
    }
    
    let html = '';
    
    days.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayTasks = tasks.filter(t => {
            if (!t.deadline) return false;
            const taskDate = new Date(t.deadline).toISOString().split('T')[0];
            return taskDate === dateStr;
        });
        
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
        
        html += `
            <div class="bg-white rounded-lg shadow-md p-4 ${isToday ? 'border-2 border-blue-500' : ''}">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <h3 class="font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'}">
                            ${date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                            ${isToday ? '• Сегодня' : ''}
                        </h3>
                        <p class="text-xs text-gray-500">${dayTasks.length} задач${dayTasks.length === 1 ? 'а' : dayTasks.length < 5 ? 'и' : ''}</p>
                    </div>
                    <button onclick="addTaskForDate('${dateStr}')" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                        + Задача
                    </button>
                </div>
                
                ${dayTasks.length === 0 ? 
                    `<p class="text-sm text-gray-400 text-center py-4">Нет задач на этот день</p>` :
                    `<div class="space-y-2">
                        ${dayTasks.map(task => `
                            <div class="flex items-start gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                                <input 
                                    type="checkbox" 
                                    ${task.completed ? 'checked' : ''} 
                                    onchange="toggleTaskInCalendar(${task.id})"
                                    class="mt-1 w-5 h-5 rounded border-gray-300 cursor-pointer"
                                >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'} break-words">
                                        ${task.title}
                                    </p>
                                    <div class="flex gap-1 mt-1">
                                        ${task.priority === 'high' ? '<span class="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">🔴</span>' : ''}
                                        ${task.priority === 'medium' ? '<span class="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">🟡</span>' : ''}
                                        ${task.priority === 'low' ? '<span class="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">🟢</span>' : ''}
                                    </div>
                                </div>
                                <button onclick="openEditTaskModal(${task.id})" class="text-blue-600 hover:text-blue-800 text-sm">✏️</button>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Отметить задачу в календаре
async function toggleTaskInCalendar(id) {
    try {
        const tasks = await TaskAPI.getAll();
        const task = tasks.find(t => t.id === id);
        
        if (task) {
            const newCompleted = !task.completed;
            await TaskAPI.update(id, { 
                completed: newCompleted,
                completed_at: newCompleted ? new Date().toISOString() : null
            });
            await loadVerticalCalendar();
        }
    } catch (error) {
        console.error('Ошибка обновления задачи:', error);
        showNotification('Ошибка обновления задачи', 'error');
    }
}

// Добавить задачу на конкретную дату
function addTaskForDate(dateStr) {
    document.getElementById('calendarQuickAdd').classList.remove('hidden');
    document.getElementById('calQuickTaskDate').value = dateStr;
    document.getElementById('calQuickTaskTitle').focus();
    
    // Прокрутить к форме
    document.getElementById('calendarQuickAdd').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Показать/скрыть быструю форму
function toggleQuickAddTask() {
    const form = document.getElementById('calendarQuickAdd');
    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('calQuickTaskDate').value = today;
        document.getElementById('calQuickTaskTitle').focus();
    } else {
        form.classList.add('hidden');
        document.getElementById('calQuickTaskTitle').value = '';
        document.getElementById('calQuickTaskDate').value = '';
    }
}

// Добавить задачу из календаря
async function addQuickTaskFromCalendar() {
    const title = document.getElementById('calQuickTaskTitle').value.trim();
    const deadline = document.getElementById('calQuickTaskDate').value;
    
    if (!title) {
        showNotification('Введите название задачи', 'error');
        return;
    }
    
    if (!deadline) {
        showNotification('Выберите дату', 'error');
        return;
    }
    
    try {
        await TaskAPI.create({
            title,
            deadline,
            priority: 'medium',
            status: 'todo',
            completed: false
        });
        
        document.getElementById('calQuickTaskTitle').value = '';
        showNotification('Задача добавлена', 'success');
        toggleQuickAddTask();
        await loadVerticalCalendar();
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
        showNotification('Ошибка добавления задачи', 'error');
    }
}

// ========== КАЛЕНДАРЬ-СЕТКА ==========

async function loadGridCalendar() {
    await updateCalendarProjectFilter();
    await renderGridCalendar();
}

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

async function renderGridCalendar() {
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    document.getElementById('calendarMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    await loadCalendarTasks();
}

async function loadCalendarTasks() {
    try {
        const tasks = await TaskAPI.getAll();
        
        const filterProject = document.getElementById('calendarFilterProject')?.value || '';
        
        let filtered = tasks.filter(t => t.deadline);
        
        if (filterProject) {
            filtered = filtered.filter(t => t.project_id == filterProject);
        }
        
        renderCalendarGrid(filtered);
    } catch (error) {
        console.error('Ошибка загрузки задач календаря:', error);
    }
}

function renderCalendarGrid(tasks) {
    const grid = document.getElementById('calendarGridView');
    
    const headers = Array.from(grid.children).slice(0, 7);
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    for (let i = 0; i < startDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'border border-gray-200 p-2 min-h-[80px] bg-gray-50';
        grid.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        
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

function changeMonth(delta) {
    currentMonth += delta;
    
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    
    renderGridCalendar();
}

function jumpToToday() {
    currentMonth = new Date().getMonth();
    currentYear = new Date().getFullYear();
    renderGridCalendar();
}
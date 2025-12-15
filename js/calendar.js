// ========== КАЛЕНДАРЬ ==========

function loadCalendar() {
    renderCalendar();
    updateCalendarProjectFilter();
}

async function updateCalendarProjectFilter() {
    try {
        const response = await fetch(`${API_URL}/projects/`, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) return;
        
        const projects = await response.json();
        const select = document.getElementById('calendarFilterProject');
        
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Все проекты</option>' + 
                projects.map(p => `<option value="${p.id}">${p.icon} ${escapeHtml(p.name)}</option>`).join('');
            select.value = currentValue;
        }
    } catch (error) {
        console.error('Ошибка загрузки проектов для календаря:', error);
    }
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const calendarGrid = document.getElementById('calendarGrid');
    
    while (calendarGrid.children.length > 7) {
        calendarGrid.removeChild(calendarGrid.lastChild);
    }
    
    for (let i = 0; i < firstDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month p-2';
        calendarGrid.appendChild(emptyDay);
    }
    
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        const currentDate = new Date(year, month, day);
        const isToday = currentDate.toDateString() === today.toDateString();
        
        dayElement.className = `calendar-day p-2 ${isToday ? 'today' : ''}`;
        dayElement.innerHTML = `<div class="text-sm font-semibold mb-1">${day}</div>`;
        dayElement.dataset.date = currentDate.toISOString().split('T')[0];
        
        calendarGrid.appendChild(dayElement);
    }
    
    loadCalendarTasks();
}

async function loadCalendarTasks() {
    try {
        let url = `${API_URL}/tasks/`;
        const params = new URLSearchParams();
        
        const projectFilter = document.getElementById('calendarFilterProject')?.value;
        const priorityFilter = document.getElementById('calendarFilterPriority')?.value;
        
        if (projectFilter) params.append('project', projectFilter);
        if (priorityFilter) params.append('priority', priorityFilter);
        
        if (params.toString()) url += `?${params.toString()}`;
        
        const response = await fetch(url, {
            headers: { 'X-Telegram-Init-Data': getInitData() }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tasks = await response.json();
        
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        
        tasks.forEach(task => {
            if (!task.deadline) return;
            
            const deadlineDate = new Date(task.deadline);
            if (deadlineDate.getFullYear() !== year || deadlineDate.getMonth() !== month) return;
            
            const dateStr = deadlineDate.toISOString().split('T')[0];
            const dayElement = document.querySelector(`[data-date="${dateStr}"]`);
            
            if (dayElement) {
                const priorityColors = {
                    high: 'bg-red-200 text-red-800',
                    medium: 'bg-yellow-200 text-yellow-800',
                    low: 'bg-green-200 text-green-800'
                };
                
                const taskDiv = document.createElement('div');
                taskDiv.className = `calendar-task ${priorityColors[task.priority]}`;
                taskDiv.textContent = task.title;
                taskDiv.onclick = () => openEditTaskModal(task.id);
                
                dayElement.appendChild(taskDiv);
            }
        });
    } catch (error) {
        console.error('Ошибка загрузки задач календаря:', error);
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function jumpToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}
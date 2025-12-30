// ========== СТРАНИЦА ДОСТИЖЕНИЙ ==========

let allAchievements = [];
let currentAchievement = null;

// Загрузить страницу достижений
async function loadAchievements() {
    try {
        const userId = getUserId();
        
        // Получить все достижения с прогрессом
        allAchievements = await TreeAPI.getAllAchievementsWithProgress(userId);
        
        // Отобразить общую статистику
        renderAchievementsStats();
        
        // Отобразить по категориям
        renderAchievementsByCategory();
        
    } catch (error) {
        console.error('Ошибка загрузки достижений:', error);
        showNotification('Ошибка загрузки достижений', 'error');
    }
}

// Отрисовка общей статистики
function renderAchievementsStats() {
    const unlocked = allAchievements.filter(a => a.unlocked).length;
    const total = allAchievements.length;
    const progress = total > 0 ? Math.floor((unlocked / total) * 100) : 0;
    
    document.getElementById('achievementsProgress').textContent = `${unlocked} / ${total}`;
    document.getElementById('achievementsProgressBar').style.width = `${progress}%`;
    
    // Обновить счётчик в кнопке на профиле
    const countEl = document.getElementById('achievementsCount');
    if (countEl) {
        countEl.textContent = `${unlocked}/${total}`;
    }
}

// Отрисовка по категориям
function renderAchievementsByCategory() {
    const container = document.getElementById('achievementCategories');
    if (!container) return;
    
    // Группировать по категориям
    const categories = {};
    allAchievements.forEach(ach => {
        if (!categories[ach.category]) {
            categories[ach.category] = [];
        }
        categories[ach.category].push(ach);
    });
    
    // Иконки категорий
    const categoryIcons = {
        'Новичок': '🌱',
        'Марафонец': '🔥',
        'Продуктивность': '⚡',
        'Организация': '📊',
        'Социальный': '👥',
        'Мастерство': '🎯'
    };
    
    container.innerHTML = Object.keys(categories).map(category => {
        const achievements = categories[category];
        const unlocked = achievements.filter(a => a.unlocked).length;
        const icon = categoryIcons[category] || '🏆';
        
        return `
            <div class="bg-white rounded-lg border overflow-hidden">
                <!-- Заголовок категории -->
                <button 
                    onclick="toggleCategory('${category}')"
                    class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${icon}</span>
                        <div class="text-left">
                            <p class="font-bold text-gray-800">${category}</p>
                            <p class="text-xs text-gray-600">${unlocked} / ${achievements.length} разблокировано</p>
                        </div>
                    </div>
                    <span class="text-gray-400 category-arrow" id="arrow-${category}">▼</span>
                </button>
                
                <!-- Достижения категории -->
                <div id="category-${category}" class="p-4 grid grid-cols-3 gap-3">
                    ${achievements.map(ach => renderAchievementCard(ach)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Отрисовка карточки достижения
function renderAchievementCard(achievement) {
    const isUnlocked = achievement.unlocked;
    const cardClass = isUnlocked ? 'achievement-unlocked' : 'achievement-locked';
    const iconClass = isUnlocked ? 'achievement-icon-unlocked' : 'achievement-icon-locked';
    
    return `
        <div 
            class="achievement-card ${cardClass} rounded-lg p-3 text-center cursor-pointer relative overflow-hidden"
            onclick="openAchievementModal(${achievement.id})"
        >
            <div class="text-4xl mb-2 ${iconClass}">${achievement.icon}</div>
            <p class="text-xs font-medium text-gray-800 mb-1">${achievement.name}</p>
            
            ${isUnlocked ? `
                <div class="text-xs text-orange-600 font-bold">✓ Получено</div>
            ` : `
                <div class="text-xs text-gray-600 mb-1">${achievement.progress}%</div>
                <div class="h-1.5 bg-gray-300 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-green-400 to-blue-500" style="width: ${achievement.progress}%"></div>
                </div>
            `}
        </div>
    `;
}

// Переключение видимости категории
function toggleCategory(category) {
    const content = document.getElementById(`category-${category}`);
    const arrow = document.getElementById(`arrow-${category}`);
    
    if (!content || !arrow) return;
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.textContent = '▼';
    } else {
        content.classList.add('hidden');
        arrow.textContent = '▶';
    }
}

// Открыть модальное окно достижения
function openAchievementModal(achievementId) {
    const achievement = allAchievements.find(a => a.id === achievementId);
    if (!achievement) return;
    
    currentAchievement = achievement;
    
    // Заполнить модальное окно
    document.getElementById('modalAchievementIcon').textContent = achievement.icon;
    document.getElementById('modalAchievementName').textContent = achievement.name;
    document.getElementById('modalAchievementDescription').textContent = achievement.description;
    document.getElementById('modalAchievementReward').textContent = `+${achievement.xp_reward} XP`;
    
    if (achievement.unlocked) {
        // Показать дату разблокировки
        document.getElementById('modalAchievementProgress').classList.add('hidden');
        document.getElementById('modalAchievementUnlocked').classList.remove('hidden');
        
        const date = new Date(achievement.unlocked_at);
        document.getElementById('modalUnlockedDate').textContent = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } else {
        // Показать прогресс
        document.getElementById('modalAchievementUnlocked').classList.add('hidden');
        document.getElementById('modalAchievementProgress').classList.remove('hidden');
        
        document.getElementById('modalProgressText').textContent = `${achievement.current} / ${achievement.target}`;
        document.getElementById('modalProgressBar').style.width = `${achievement.progress}%`;
    }
    
    // Показать модальное окно
    document.getElementById('achievementModal').classList.remove('hidden');
}

// Закрыть модальное окно
function closeAchievementModal() {
    document.getElementById('achievementModal').classList.add('hidden');
    currentAchievement = null;
}

// Обновить счётчик достижений в кнопке
async function updateAchievementsCount() {
    try {
        const userId = getUserId();
        const achievements = await TreeAPI.getAchievements(userId);
        
        // Получить общее количество
        const { data: allAchievements } = await supabaseClient
            .from('achievements')
            .select('id');
        
        const total = allAchievements?.length || 50;
        
        const countEl = document.getElementById('achievementsCount');
        if (countEl) {
            countEl.textContent = `${achievements.length}/${total}`;
        }
    } catch (error) {
        console.error('Ошибка обновления счётчика достижений:', error);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    updateAchievementsCount();
});
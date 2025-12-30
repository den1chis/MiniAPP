// ========== ПРОФИЛЬ И ДЕРЕВО ПРОГРЕССА ==========

let userStats = null;

// Загрузить профиль
async function loadProfile() {
    try {
        const userId = getUserId();
        
        // ✅ ПОПЫТКА ЗАГРУЗИТЬ СТАТИСТИКУ
        let userStats = null;
        let isNewUser = false;
        
        try {
            userStats = await TreeAPI.getStats(userId);
        } catch (error) {
            // Статистики нет — создать с пересчётом реальных данных
            console.log('📊 Статистика не найдена, создаём с пересчётом реальных данных...');
            isNewUser = true;
            
            try {
                // Получить реальные данные пользователя
                const { data: tasks } = await supabaseClient.from('tasks').select('*').eq('user_id', userId);
                const { data: projects } = await supabaseClient.from('projects').select('*').eq('user_id', userId);
                const { data: notes } = await supabaseClient.from('notes').select('*').eq('user_id', userId);
                const { data: subprojects } = await supabaseClient.from('subprojects').select('*');
                const { data: tables } = await supabaseClient.from('sp_tables').select('*');
                
                // Фильтровать подпроекты по user_id через projects
                const userProjectIds = projects?.map(p => p.id) || [];
                const userSubprojects = subprojects?.filter(sp => userProjectIds.includes(sp.project_id)) || [];
                
                // Посчитать статистику
                const tasksCreated = tasks?.length || 0;
                const tasksCompleted = tasks?.filter(t => t.completed).length || 0;
                const projectsCreated = projects?.length || 0;
                const notesCreated = notes?.length || 0;
                const subprojectsCreated = userSubprojects.length;
                const tablesCreated = tables?.filter(t => userSubprojects.some(sp => sp.id === t.subproject_id)).length || 0;
                
                // Рассчитать XP
                const calculatedXP = 
                    (tasksCreated * 2) +
                    (tasksCompleted * 5) +
                    (projectsCreated * 10) +
                    (notesCreated * 3) +
                    (subprojectsCreated * 8) +
                    (tablesCreated * 8);
                
                const calculatedLevel = TreeAPI.calculateLevel(calculatedXP);
                
                console.log(`💎 Рассчитанный XP: ${calculatedXP}, Уровень: ${calculatedLevel}`);
                console.log(`   Задачи: ${tasksCreated} создано, ${tasksCompleted} выполнено`);
                console.log(`   Проекты: ${projectsCreated}, Заметки: ${notesCreated}`);
                
                // Создать статистику с пересчитанными значениями
                const { data: newStats, error: insertError } = await supabaseClient
                    .from('user_tree_stats')
                    .insert([{
                        user_id: userId,
                        total_xp: calculatedXP,
                        tree_level: calculatedLevel,
                        current_streak: 1,
                        max_streak: 1,
                        tasks_created: tasksCreated,
                        tasks_completed: tasksCompleted,
                        projects_created: projectsCreated,
                        notes_created: notesCreated,
                        subprojects_created: subprojectsCreated,
                        tables_created: tablesCreated,
                        achievements_migrated: false
                    }])
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                
                userStats = newStats;
                console.log('✅ Статистика создана с пересчётом:', userStats);
                
            } catch (createError) {
                console.error('❌ Ошибка создания статистики:', createError);
                throw createError;
            }
        }
        
        // ✅ МИГРАЦИЯ: Пересчитать достижения для существующих пользователей
        if (!userStats.achievements_migrated) {
            console.log('🔄 Запуск миграции достижений для пользователя:', userId);
            
            try {
                const xpBefore = userStats.total_xp;
                
                // 💎 ПЕРЕСЧИТАТЬ XP ПО СТАТИСТИКЕ (для старых пользователей)
                if (!isNewUser) {
                    const calculatedXP = 
                        (userStats.tasks_created || 0) * 2 +
                        (userStats.tasks_completed || 0) * 5 +
                        (userStats.tasks_edited || 0) * 1 +
                        (userStats.projects_created || 0) * 10 +
                        (userStats.subprojects_created || 0) * 8 +
                        (userStats.notes_created || 0) * 3 +
                        (userStats.tables_created || 0) * 8 +
                        (userStats.table_rows_created || 0) * 1 +
                        (userStats.members_invited || 0) * 10 +
                        (userStats.custom_fields_created || 0) * 3;
                    
                    console.log('💎 Пересчёт XP:');
                    console.log(`   Текущий: ${xpBefore}`);
                    console.log(`   Рассчитанный по статистике: ${calculatedXP}`);
                    
                    // ✅ ОБНОВИТЬ XP И УРОВЕНЬ если пересчитанный больше
                    if (calculatedXP > xpBefore) {
                        const newLevel = TreeAPI.calculateLevel(calculatedXP);
                        
                        await supabaseClient
                            .from('user_tree_stats')
                            .update({ 
                                total_xp: calculatedXP,
                                tree_level: newLevel
                            })
                            .eq('user_id', userId);
                        
                        console.log(`   ✅ XP обновлён: ${xpBefore} → ${calculatedXP} (+${calculatedXP - xpBefore})`);
                        console.log(`   🌳 Уровень дерева: ${newLevel}`);
                    } else {
                        console.log(`   ✅ XP остался прежним`);
                    }
                }
                
                // 🏆 РАЗБЛОКИРОВАТЬ ДОСТИЖЕНИЯ (БЕЗ начисления XP)
                window.suppressAchievementNotifications = true;
                await TreeAPI.checkAchievements(userId, true);
                window.suppressAchievementNotifications = false;
                
                // 🚩 УСТАНОВИТЬ ФЛАГ МИГРАЦИИ
                await supabaseClient
                    .from('user_tree_stats')
                    .update({ achievements_migrated: true })
                    .eq('user_id', userId);
                
                // ✅ ЗАГРУЗИТЬ ОБНОВЛЁННУЮ СТАТИСТИКУ
                userStats = await TreeAPI.getStats(userId);
                
                console.log('✅ Миграция завершена');
                console.log(`   Итоговый XP: ${userStats.total_xp}`);
                console.log(`   Уровень дерева: ${userStats.tree_level}`);
                
                // Показать уведомление
                if (!isNewUser) {
                    const xpGained = userStats.total_xp - xpBefore;
                    if (xpGained > 0) {
                        showNotification(`🎉 Прогресс пересчитан! +${xpGained} XP`, 'success');
                    } else {
                        showNotification('🎉 Достижения обновлены!', 'success');
                    }
                }
                
            } catch (error) {
                console.error('❌ Ошибка миграции достижений:', error);
                window.suppressAchievementNotifications = false;
            }
        }
        
        // ✅ ОТОБРАЗИТЬ ВСЁ
        renderTree(userStats.tree_level);
        renderProfileInfo(userStats);
        renderProgress(userStats);
        renderStats(userStats);
        await loadRecentAchievements(userId);
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

// Отрисовка дерева
function renderTree(level) {
    const container = document.getElementById('treeContainer');
    if (!container) return;
    
    const levelInfo = TreeAPI.getLevelInfo(level);
    const treeSVG = getTreeSVG(level);
    
    container.innerHTML = `
        <div class="text-center">
            <div class="inline-block relative">
                ${treeSVG}
            </div>
            <p class="text-lg font-bold text-gray-800 mt-2">${levelInfo.name}</p>
            <p class="text-sm text-gray-600">Уровень ${level}</p>
        </div>
    `;
}

// SVG деревьев по уровням
// Получить SVG дерева для уровня
function getTreeSVG(level) {
    const svgs = {
        // Уровень 0: Семя
        0: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="seedGlow">
                        <stop offset="0%" stop-color="#8B4513" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="#8B4513" stop-opacity="0"/>
                    </radialGradient>
                </defs>
                <!-- Почва -->
                <ellipse cx="100" cy="150" rx="60" ry="20" fill="#654321" opacity="0.6"/>
                <!-- Свечение -->
                <circle cx="100" cy="130" r="40" fill="url(#seedGlow)"/>
                <!-- Семя -->
                <ellipse cx="100" cy="130" rx="15" ry="20" fill="#8B4513"/>
                <ellipse cx="100" cy="125" rx="10" ry="8" fill="#A0522D"/>
            </svg>
        `,
        
        // Уровень 1: Росток
        1: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <linearGradient id="stemGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#90EE90"/>
                        <stop offset="100%" stop-color="#228B22"/>
                    </linearGradient>
                </defs>
                <!-- Земля -->
                <ellipse cx="100" cy="160" rx="50" ry="15" fill="#8B4513" opacity="0.7"/>
                <!-- Стебель -->
                <path d="M 100 160 Q 95 120, 100 90" stroke="url(#stemGrad)" stroke-width="4" fill="none"/>
                <!-- Листочки -->
                <ellipse cx="85" cy="110" rx="12" ry="8" fill="#90EE90" transform="rotate(-30 85 110)"/>
                <ellipse cx="115" cy="100" rx="12" ry="8" fill="#7CFC00" transform="rotate(30 115 100)"/>
                <!-- Верхушка -->
                <circle cx="100" cy="90" r="6" fill="#ADFF2F"/>
            </svg>
        `,
        
        // Уровень 2: Саженец
        2: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="leafGrad2">
                        <stop offset="0%" stop-color="#7CFC00"/>
                        <stop offset="100%" stop-color="#228B22"/>
                    </radialGradient>
                </defs>
                <!-- Земля -->
                <ellipse cx="100" cy="170" rx="60" ry="18" fill="#8B4513" opacity="0.8"/>
                <!-- Ствол -->
                <rect x="95" y="100" width="10" height="70" fill="#8B4513" rx="2"/>
                <!-- Ветки -->
                <line x1="100" y1="130" x2="70" y2="120" stroke="#8B4513" stroke-width="3"/>
                <line x1="100" y1="120" x2="130" y2="110" stroke="#8B4513" stroke-width="3"/>
                <!-- Листва -->
                <circle cx="70" cy="120" r="18" fill="url(#leafGrad2)" opacity="0.9"/>
                <circle cx="100" cy="100" r="22" fill="url(#leafGrad2)" opacity="0.9"/>
                <circle cx="130" cy="110" r="18" fill="url(#leafGrad2)" opacity="0.9"/>
            </svg>
        `,
        
        // Уровень 3: Молодое дерево
        3: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="crownGrad3">
                        <stop offset="0%" stop-color="#00FF00"/>
                        <stop offset="100%" stop-color="#006400"/>
                    </radialGradient>
                </defs>
                <!-- Земля -->
                <ellipse cx="100" cy="175" rx="70" ry="20" fill="#654321" opacity="0.8"/>
                <!-- Ствол -->
                <path d="M 95 175 L 92 100 L 95 80 L 105 80 L 108 100 L 105 175 Z" fill="#8B4513"/>
                <!-- Ветки -->
                <path d="M 95 120 Q 70 115, 60 110" stroke="#8B4513" stroke-width="4" fill="none"/>
                <path d="M 105 110 Q 130 105, 140 100" stroke="#8B4513" stroke-width="4" fill="none"/>
                <!-- Крона -->
                <circle cx="60" cy="110" r="25" fill="url(#crownGrad3)"/>
                <circle cx="100" cy="80" r="35" fill="url(#crownGrad3)"/>
                <circle cx="140" cy="100" r="25" fill="url(#crownGrad3)"/>
                <circle cx="80" cy="90" r="28" fill="url(#crownGrad3)"/>
                <circle cx="120" cy="85" r="28" fill="url(#crownGrad3)"/>
            </svg>
        `,
        
        // Уровень 4: Крепкое дерево
        4: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="strongCrown">
                        <stop offset="0%" stop-color="#32CD32"/>
                        <stop offset="100%" stop-color="#006400"/>
                    </radialGradient>
                </defs>
                <!-- Земля -->
                <ellipse cx="100" cy="180" rx="80" ry="20" fill="#654321"/>
                <!-- Ствол мощный -->
                <path d="M 90 180 L 88 110 L 90 70 L 110 70 L 112 110 L 110 180 Z" fill="#654321"/>
                <path d="M 90 180 L 88 110 L 90 70 L 110 70 L 112 110 L 110 180 Z" fill="#8B4513" opacity="0.8"/>
                <!-- Ветки -->
                <path d="M 88 130 Q 60 120, 45 110" stroke="#654321" stroke-width="5" fill="none"/>
                <path d="M 112 120 Q 140 110, 155 100" stroke="#654321" stroke-width="5" fill="none"/>
                <!-- Густая крона -->
                <circle cx="45" cy="110" r="30" fill="url(#strongCrown)"/>
                <circle cx="75" cy="95" r="35" fill="url(#strongCrown)"/>
                <circle cx="100" cy="70" r="40" fill="url(#strongCrown)"/>
                <circle cx="125" cy="90" r="35" fill="url(#strongCrown)"/>
                <circle cx="155" cy="100" r="30" fill="url(#strongCrown)"/>
                <circle cx="100" cy="50" r="25" fill="url(#strongCrown)"/>
            </svg>
        `,
        
        // Уровень 5: Цветущее дерево
        5: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="blossomGrad">
                        <stop offset="0%" stop-color="#FFB6C1"/>
                        <stop offset="100%" stop-color="#FF69B4"/>
                    </radialGradient>
                    <radialGradient id="glowPink">
                        <stop offset="0%" stop-color="#FFD700" stop-opacity="0.6"/>
                        <stop offset="100%" stop-color="#FF69B4" stop-opacity="0"/>
                    </radialGradient>
                </defs>
                <!-- Свечение -->
                <circle cx="100" cy="90" r="80" fill="url(#glowPink)"/>
                <!-- Земля -->
                <ellipse cx="100" cy="180" rx="80" ry="20" fill="#654321"/>
                <!-- Ствол -->
                <path d="M 92 180 L 90 100 L 92 65 L 108 65 L 110 100 L 108 180 Z" fill="#8B4513"/>
                <!-- Цветущая крона -->
                <circle cx="50" cy="105" r="28" fill="url(#blossomGrad)"/>
                <circle cx="80" cy="85" r="35" fill="url(#blossomGrad)"/>
                <circle cx="100" cy="65" r="40" fill="url(#blossomGrad)"/>
                <circle cx="120" cy="80" r="35" fill="url(#blossomGrad)"/>
                <circle cx="150" cy="100" r="28" fill="url(#blossomGrad)"/>
                <!-- Цветочки -->
                <circle cx="60" cy="95" r="3" fill="#FFF"/>
                <circle cx="90" cy="75" r="3" fill="#FFF"/>
                <circle cx="110" cy="70" r="3" fill="#FFF"/>
                <circle cx="130" cy="85" r="3" fill="#FFF"/>
                <circle cx="140" cy="105" r="3" fill="#FFF"/>
            </svg>
        `,
        
        // Уровень 6: Плодоносящее
        6: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="goldenGlow">
                        <stop offset="0%" stop-color="#FFD700" stop-opacity="0.8"/>
                        <stop offset="100%" stop-color="#FFA500" stop-opacity="0"/>
                    </radialGradient>
                    <radialGradient id="appleGrad">
                        <stop offset="0%" stop-color="#FF6347"/>
                        <stop offset="100%" stop-color="#DC143C"/>
                    </radialGradient>
                </defs>
                <!-- Золотое свечение -->
                <circle cx="100" cy="90" r="85" fill="url(#goldenGlow)"/>
                <!-- Земля -->
                <ellipse cx="100" cy="180" rx="85" ry="20" fill="#654321"/>
                <!-- Ствол -->
                <path d="M 92 180 L 90 95 L 92 60 L 108 60 L 110 95 L 108 180 Z" fill="#8B4513"/>
                <!-- Крона зелёная -->
                <circle cx="50" cy="100" r="30" fill="#228B22" opacity="0.9"/>
                <circle cx="80" cy="80" r="35" fill="#228B22" opacity="0.9"/>
                <circle cx="100" cy="60" r="42" fill="#228B22" opacity="0.9"/>
                <circle cx="120" cy="75" r="35" fill="#228B22" opacity="0.9"/>
                <circle cx="150" cy="95" r="30" fill="#228B22" opacity="0.9"/>
                <!-- Яблоки -->
                <circle cx="55" cy="105" r="6" fill="url(#appleGrad)"/>
                <circle cx="75" cy="90" r="6" fill="url(#appleGrad)"/>
                <circle cx="95" cy="70" r="6" fill="url(#appleGrad)"/>
                <circle cx="110" cy="65" r="6" fill="url(#appleGrad)"/>
                <circle cx="125" cy="85" r="6" fill="url(#appleGrad)"/>
                <circle cx="145" cy="100" r="6" fill="url(#appleGrad)"/>
                <!-- Блики на яблоках -->
                <circle cx="96" cy="68" r="2" fill="#FFF" opacity="0.8"/>
                <circle cx="111" cy="63" r="2" fill="#FFF" opacity="0.8"/>
            </svg>
        `,
        
        // Уровень 7: Величественное
        7: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="majesticGlow">
                        <stop offset="0%" stop-color="#FFD700" stop-opacity="1"/>
                        <stop offset="50%" stop-color="#FFA500" stop-opacity="0.5"/>
                        <stop offset="100%" stop-color="#FF8C00" stop-opacity="0"/>
                    </radialGradient>
                    <linearGradient id="goldenCrown" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#FFD700"/>
                        <stop offset="100%" stop-color="#DAA520"/>
                    </linearGradient>
                </defs>
                <!-- Лучи света -->
                <path d="M 100 60 L 95 20 L 100 30 L 105 20 Z" fill="#FFD700" opacity="0.6"/>
                <path d="M 100 60 L 70 30 L 80 40 L 75 25 Z" fill="#FFD700" opacity="0.5"/>
                <path d="M 100 60 L 130 30 L 120 40 L 125 25 Z" fill="#FFD700" opacity="0.5"/>
                <!-- Мощное свечение -->
                <circle cx="100" cy="85" r="90" fill="url(#majesticGlow)"/>
                <!-- Земля -->
                <ellipse cx="100" cy="180" rx="90" ry="22" fill="#654321"/>
                <!-- Мощный ствол -->
                <path d="M 88 180 L 86 90 L 88 55 L 112 55 L 114 90 L 112 180 Z" fill="#654321"/>
                <!-- Золотая крона -->
                <circle cx="45" cy="95" r="32" fill="url(#goldenCrown)"/>
                <circle cx="75" cy="75" r="38" fill="url(#goldenCrown)"/>
                <circle cx="100" cy="55" r="45" fill="url(#goldenCrown)"/>
                <circle cx="125" cy="70" r="38" fill="url(#goldenCrown)"/>
                <circle cx="155" cy="90" r="32" fill="url(#goldenCrown)"/>
                <!-- Искры -->
                <circle cx="50" cy="85" r="2" fill="#FFF"/>
                <circle cx="100" cy="45" r="2" fill="#FFF"/>
                <circle cx="150" cy="80" r="2" fill="#FFF"/>
                <circle cx="70" cy="65" r="2" fill="#FFF"/>
                <circle cx="130" cy="60" r="2" fill="#FFF"/>
            </svg>
        `,
        
        // Уровень 8: Древнее
        8: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="mysticGlow">
                        <stop offset="0%" stop-color="#9370DB" stop-opacity="1"/>
                        <stop offset="50%" stop-color="#8A2BE2" stop-opacity="0.6"/>
                        <stop offset="100%" stop-color="#4B0082" stop-opacity="0"/>
                    </radialGradient>
                    <linearGradient id="ancientCrown" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#DDA0DD"/>
                        <stop offset="50%" stop-color="#9370DB"/>
                        <stop offset="100%" stop-color="#4B0082"/>
                    </linearGradient>
                </defs>
                <!-- Мистическое свечение -->
                <circle cx="100" cy="80" r="95" fill="url(#mysticGlow)"/>
                <!-- Магические руны вокруг -->
                <text x="40" y="50" font-size="12" fill="#9370DB" opacity="0.7">✦</text>
                <text x="160" y="50" font-size="12" fill="#9370DB" opacity="0.7">✦</text>
                <text x="30" y="120" font-size="12" fill="#9370DB" opacity="0.7">✧</text>
                <text x="170" y="120" font-size="12" fill="#9370DB" opacity="0.7">✧</text>
                <!-- Земля -->
                <ellipse cx="100" cy="180" rx="92" ry="22" fill="#4B0082" opacity="0.8"/>
                <!-- Древний ствол -->
                <path d="M 85 180 L 83 85 L 85 50 L 115 50 L 117 85 L 115 180 Z" fill="#4B0082"/>
                <path d="M 90 140 L 70 135" stroke="#8A2BE2" stroke-width="2" opacity="0.6"/>
                <path d="M 110 130 L 130 125" stroke="#8A2BE2" stroke-width="2" opacity="0.6"/>
                <!-- Мистическая крона -->
                <circle cx="40" cy="90" r="33" fill="url(#ancientCrown)"/>
                <circle cx="70" cy="70" r="40" fill="url(#ancientCrown)"/>
                <circle cx="100" cy="50" r="48" fill="url(#ancientCrown)"/>
                <circle cx="130" cy="65" r="40" fill="url(#ancientCrown)"/>
                <circle cx="160" cy="85" r="33" fill="url(#ancientCrown)"/>
                <!-- Звёзды -->
                <circle cx="45" cy="80" r="2" fill="#FFF"/>
                <circle cx="100" cy="40" r="3" fill="#FFF"/>
                <circle cx="155" cy="75" r="2" fill="#FFF"/>
                <circle cx="75" cy="60" r="2" fill="#FFF"/>
                <circle cx="125" cy="55" r="2" fill="#FFF"/>
            </svg>
        `,
        
        // Уровень 9: Легендарное
        9: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="fireGlow">
                        <stop offset="0%" stop-color="#FF4500" stop-opacity="1"/>
                        <stop offset="50%" stop-color="#FF6347" stop-opacity="0.7"/>
                        <stop offset="100%" stop-color="#FF8C00" stop-opacity="0"/>
                    </radialGradient>
                    <linearGradient id="flameCrown" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#FF4500"/>
                        <stop offset="50%" stop-color="#FF6347"/>
                        <stop offset="100%" stop-color="#FFD700"/>
                    </linearGradient>
                </defs>
                <!-- Огненное свечение -->
                <circle cx="100" cy="75" r="100" fill="url(#fireGlow)"/>
                <!-- Огненные искры -->
                <circle cx="30" cy="60" r="3" fill="#FFD700">
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
                </circle>
                <circle cx="170" cy="55" r="3" fill="#FFD700">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
                </circle>
                <circle cx="50" cy="100" r="2" fill="#FF6347">
                    <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite"/>
                </circle>
                <circle cx="150" cy="95" r="2" fill="#FF6347">
                    <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/>
                </circle>
                <!-- Земля обугленная -->
                <ellipse cx="100" cy="180" rx="95" ry="23" fill="#2F1F1F"/>
                <!-- Обожжённый ствол -->
                <path d="M 85 180 L 82 80 L 84 45 L 116 45 L 118 80 L 115 180 Z" fill="#2F1F1F"/>
                <!-- Огненная крона -->
                <circle cx="35" cy="85" r="35" fill="url(#flameCrown)"/>
                <circle cx="65" cy="65" r="42" fill="url(#flameCrown)"/>
                <circle cx="100" cy="45" r="50" fill="url(#flameCrown)"/>
                <circle cx="135" cy="60" r="42" fill="url(#flameCrown)"/>
                <circle cx="165" cy="80" r="35" fill="url(#flameCrown)"/>
                <!-- Языки пламени -->
                <path d="M 100 30 Q 95 20, 100 10" fill="#FFD700" opacity="0.8"/>
                <path d="M 70 50 Q 65 40, 70 30" fill="#FF6347" opacity="0.7"/>
                <path d="M 130 48 Q 135 38, 130 28" fill="#FF6347" opacity="0.7"/>
            </svg>
        `,
        
        // Уровень 10: Мировое Древо
        10: `
            <svg viewBox="0 0 200 200" class="w-full h-full">
                <defs>
                    <radialGradient id="cosmicGlow">
                        <stop offset="0%" stop-color="#00FFFF" stop-opacity="1"/>
                        <stop offset="30%" stop-color="#9370DB" stop-opacity="0.8"/>
                        <stop offset="60%" stop-color="#FF1493" stop-opacity="0.6"/>
                        <stop offset="100%" stop-color="#FFD700" stop-opacity="0"/>
                    </radialGradient>
                    <linearGradient id="rainbowCrown" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#FF0000"/>
                        <stop offset="16%" stop-color="#FF7F00"/>
                        <stop offset="33%" stop-color="#FFFF00"/>
                        <stop offset="50%" stop-color="#00FF00"/>
                        <stop offset="66%" stop-color="#0000FF"/>
                        <stop offset="83%" stop-color="#4B0082"/>
                        <stop offset="100%" stop-color="#9400D3"/>
                    </linearGradient>
                </defs>
                <!-- Космическое свечение -->
                <circle cx="100" cy="70" r="110" fill="url(#cosmicGlow)"/>
                <!-- Звёзды космоса -->
                <circle cx="20" cy="30" r="2" fill="#FFF"><animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/></circle>
                <circle cx="180" cy="40" r="2" fill="#FFF"><animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/></circle>
                <circle cx="40" cy="80" r="1.5" fill="#FFF"><animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/></circle>
                <circle cx="160" cy="75" r="1.5" fill="#FFF"><animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite"/></circle>
                <circle cx="60" cy="120" r="1" fill="#FFF"><animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite"/></circle>
                <circle cx="140" cy="115" r="1" fill="#FFF"><animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite"/></circle>
                <!-- Планеты -->
                <circle cx="170" cy="60" r="5" fill="#4169E1" opacity="0.8"/>
                <circle cx="30" cy="90" r="4" fill="#FF6347" opacity="0.8"/>
                <!-- Земля космическая -->
                <ellipse cx="100" cy="180" rx="98" ry="24" fill="#1A0033" opacity="0.9"/>
                <!-- Ствол мирового древа -->
                <path d="M 83 180 L 80 75 L 82 40 L 118 40 L 120 75 L 117 180 Z" fill="#4B0082" opacity="0.9"/>
                <path d="M 83 180 L 80 75 L 82 40 L 118 40 L 120 75 L 117 180 Z" fill="url(#cosmicGlow)" opacity="0.3"/>
                <!-- Радужная крона -->
                <circle cx="30" cy="80" r="38" fill="url(#rainbowCrown)" opacity="0.9"/>
                <circle cx="60" cy="58" r="45" fill="url(#rainbowCrown)" opacity="0.9"/>
                <circle cx="100" cy="38" r="55" fill="url(#rainbowCrown)" opacity="0.9"/>
                <circle cx="140" cy="55" r="45" fill="url(#rainbowCrown)" opacity="0.9"/>
                <circle cx="170" cy="75" r="38" fill="url(#rainbowCrown)" opacity="0.9"/>
                <!-- Космические кристаллы -->
                <polygon points="100,25 103,32 97,32" fill="#00FFFF" opacity="0.8"/>
                <polygon points="70,48 73,55 67,55" fill="#FF1493" opacity="0.8"/>
                <polygon points="130,45 133,52 127,52" fill="#FFD700" opacity="0.8"/>
                <!-- Аура -->
                <circle cx="100" cy="60" r="60" fill="none" stroke="#00FFFF" stroke-width="1" opacity="0.4">
                    <animate attributeName="r" values="60;65;60" dur="3s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite"/>
                </circle>
            </svg>
        `,
    };
    
    return svgs[level] || svgs[0];
}

// Отрисовка информации профиля
function renderProfileInfo(stats) {
    const container = document.getElementById('profileInfo');
    if (!container) return;
    
    const userId = getUserId();
    const levelInfo = TreeAPI.getLevelInfo(stats.tree_level);
    
    container.innerHTML = `
        <div class="text-center mb-4">
            <p class="text-gray-600 text-sm">User ID: ${userId}</p>
            <div class="flex items-center justify-center gap-2 mt-2">
                <span class="text-2xl">⚡</span>
                <span class="text-lg font-bold text-gray-800">
                    ${stats.total_xp.toLocaleString()} XP
                </span>
                <span class="text-sm text-gray-600">→ Уровень ${stats.tree_level}</span>
            </div>
        </div>
    `;
}

// Отрисовка прогресс-бара
function renderProgress(stats) {
    const container = document.getElementById('progressBar');
    if (!container) return;
    
    const progress = TreeAPI.getProgress(stats.total_xp, stats.tree_level);
    const nextLevel = TreeAPI.getLevelInfo(stats.tree_level + 1);
    
    if (!nextLevel) {
        // Максимальный уровень
        container.innerHTML = `
            <div class="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-4 text-center">
                <p class="text-white font-bold text-lg">🌟 МАКСИМАЛЬНЫЙ УРОВЕНЬ 🌟</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div>
            <div class="flex justify-between text-sm text-gray-600 mb-1">
                <span>${progress.progress}% до следующего уровня</span>
                <span>${progress.current} / ${progress.total} XP</span>
            </div>
            <div class="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500 flex items-center justify-end pr-2"
                     style="width: ${progress.progress}%">
                    ${progress.progress > 10 ? '<span class="text-white text-xs font-bold">⚡</span>' : ''}
                </div>
            </div>
            <p class="text-center text-sm text-gray-600 mt-1">
                Следующий уровень: <span class="font-bold">${nextLevel.name}</span>
            </p>
        </div>
    `;
}

// Отрисовка статистики
function renderStats(stats) {
    const container = document.getElementById('statsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="bg-white rounded-lg border p-4">
            <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>📊</span>
                <span>Статистика за всё время</span>
            </h3>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="flex items-center gap-2">
                    <span>✅</span>
                    <span class="text-gray-600">Выполнено:</span>
                    <span class="font-bold">${stats.tasks_completed}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span>📝</span>
                    <span class="text-gray-600">Создано:</span>
                    <span class="font-bold">${stats.tasks_created}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span>📁</span>
                    <span class="text-gray-600">Проектов:</span>
                    <span class="font-bold">${stats.projects_created}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span>📂</span>
                    <span class="text-gray-600">Подпроектов:</span>
                    <span class="font-bold">${stats.subprojects_created}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span>🔥</span>
                    <span class="text-gray-600">Streak:</span>
                    <span class="font-bold">${stats.current_streak} дней</span>
                </div>
                <div class="flex items-center gap-2">
                    <span>⭐</span>
                    <span class="text-gray-600">Лучший:</span>
                    <span class="font-bold">${stats.max_streak} дней</span>
                </div>
            </div>
        </div>
    `;
}

// Загрузить последние достижения
async function loadRecentAchievements(userId) {
    try {
        const achievements = await TreeAPI.getAchievements(userId);
        const recent = achievements.slice(0, 3);
        
        const container = document.getElementById('recentAchievements');
        if (!container) return;
        
        if (recent.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <p class="text-2xl mb-2">🏆</p>
                    <p class="text-sm">Выполните первую задачу, чтобы получить достижение!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="grid grid-cols-3 gap-3">
                ${recent.map(ach => `
                    <div class="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg p-3 text-center">
                        <div class="text-3xl mb-1">${ach.achievements.icon}</div>
                        <p class="text-xs font-medium text-gray-800">${ach.achievements.name}</p>
                        <p class="text-xs text-gray-600 mt-1">+${ach.achievements.xp_reward} XP</p>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки достижений:', error);
    }
}

// Показать уведомление о разблокировке достижения
function showAchievementUnlocked(achievement) {
    // Не показывать во время миграции
    if (window.suppressAchievementNotifications) {
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce';
    notification.innerHTML = `
        <div class="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white px-6 py-4 rounded-lg shadow-2xl border-2 border-yellow-300">
            <div class="flex items-center gap-3">
                <span class="text-4xl">${achievement.icon}</span>
                <div>
                    <p class="font-bold text-lg">🏆 Достижение разблокировано!</p>
                    <p class="text-sm">${achievement.name}</p>
                    <p class="text-xs mt-1">+${achievement.xp_reward} XP</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate-slideOut');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// Показать уведомление о получении XP
function showXPNotification(xp, message) {
    // Показываем только значимые события (5+ XP)
    
    
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 z-50 animate-slideIn';
    notification.innerHTML = `
        <div class="bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <span class="text-2xl">⚡</span>
            <div>
                <p class="font-bold">+${xp} XP</p>
                <p class="text-xs">${message}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate-slideOut');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Показать уведомление о новом уровне
function showLevelUpNotification(newLevel) {
    const levelInfo = TreeAPI.getLevelInfo(newLevel);
    
    const notification = document.createElement('div');
    notification.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    notification.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center max-w-md animate-bounce">
            <div class="text-6xl mb-4">🎉</div>
            <h2 class="text-3xl font-bold text-gray-800 mb-2">НОВЫЙ УРОВЕНЬ!</h2>
            <p class="text-5xl font-bold text-blue-600 mb-2">${newLevel}</p>
            <p class="text-xl text-gray-600 mb-6">${levelInfo.name}</p>
            <button onclick="this.closest('.fixed').remove()" class="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-bold hover:from-blue-600 hover:to-purple-700">
                Продолжить
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
}

async function refreshProfile() {
    if (currentTab === 'profile') {
        await loadProfile();
    }
    await updateAchievementsCount();
}
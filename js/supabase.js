// ========== ИНИЦИАЛИЗАЦИЯ SUPABASE ==========
const SUPABASE_URL = 'https://pyibgdenhyxtetcdykdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5aWJnZGVuaHl4dGV0Y2R5a2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDgxMTksImV4cCI6MjA4MTM4NDExOX0.Q_rZuNreW3ytgh3XekTbvct_xu2_ccfsb4BnnjZjaQU';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
// ========== REALTIME СИНХРОНИЗАЦИЯ ==========
const RealtimeSync = {
    channels: new Map(),
    callbacks: new Map(),
    
    subscribe(table, callback) {
        if (this.channels.has(table)) {
            // Добавить callback к существующей подписке
            const existingCallbacks = this.callbacks.get(table) || [];
            existingCallbacks.push(callback);
            this.callbacks.set(table, existingCallbacks);
            return;
        }
        
        const userId = getUserId();
        
        const channel = supabaseClient
            .channel(`public:${table}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: table,
                filter: table === 'tasks' ? `user_id=eq.${userId}` : undefined
            }, (payload) => {
                console.log(`📡 Realtime [${table}]:`, payload.eventType, payload.new || payload.old);
                
                // Вызвать все callback'и для этой таблицы
                const callbacks = this.callbacks.get(table) || [callback];
                callbacks.forEach(cb => cb(payload));
                
                // Очистить кеш прав при изменениях в project_members или member_permissions
                if (table === 'project_members' || table === 'member_permissions') {
                    clearPermissionCache();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ Подписка на ${table} активна`);
                }
            });
        
        this.channels.set(table, channel);
        this.callbacks.set(table, [callback]);
    },
    
    unsubscribe(table) {
        const channel = this.channels.get(table);
        if (channel) {
            supabaseClient.removeChannel(channel);
            this.channels.delete(table);
            this.callbacks.delete(table);
            console.log(`❌ Отписка от ${table}`);
        }
    },
    
    unsubscribeAll() {
        this.channels.forEach((channel, table) => {
            supabaseClient.removeChannel(channel);
        });
        this.channels.clear();
        this.callbacks.clear();
        console.log('❌ Все подписки отменены');
    }
};
// ========== OPTIMISTIC UI ==========
const OptimisticCache = {
    pending: new Map(), // Временные данные
    
    add(table, tempItem) {
        if (!this.pending.has(table)) {
            this.pending.set(table, []);
        }
        this.pending.get(table).push(tempItem);
    },
    
    remove(table, tempId) {
        if (!this.pending.has(table)) return;
        const items = this.pending.get(table);
        const filtered = items.filter(item => item.id !== tempId);
        this.pending.set(table, filtered);
    },
    
    replace(table, tempId, realItem) {
        this.remove(table, tempId);
    },
    
    get(table) {
        return this.pending.get(table) || [];
    },
    
    clear(table) {
        this.pending.delete(table);
    }
};

window.OptimisticCache = OptimisticCache;

// Глобальная функция для уведомлений об ошибках
function showNotification(message, type = 'info') {
    // Используем существующую функцию или создаём простую
    if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(message);
    } else if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    }
}
window.RealtimeSync = RealtimeSync;
// Получить ID пользователя
function getUserId() {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        return String(window.Telegram.WebApp.initDataUnsafe.user.id);
    }
    
    let userId = localStorage.getItem('fixed_user_id');
    if (!userId) {
        userId = 'test_user_demo';
        localStorage.setItem('fixed_user_id', userId);
    }
    return userId;
}

// ========== КЕШ ПРАВ ДОСТУПА ==========
const permissionCache = new Map();

function getCacheKey(projectId, userId, resourceType, resourceId, needEdit) {
    return `${projectId}_${userId}_${resourceType}_${resourceId || 'null'}_${needEdit}`;
}

function clearPermissionCache() {
    permissionCache.clear();
}

// ========== API ЗАДАЧ ==========
// ========== API ЗАДАЧ (с Optimistic UI и версионированием) ==========
const TaskAPI = {
    async getAll() {
        const userId = getUserId();
        
        try {
            const { data: myTasks } = await supabaseClient
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            // Объединить с optimistic данными
            const optimisticTasks = OptimisticCache.get('tasks');
            return [...optimisticTasks, ...(myTasks || [])];
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            return OptimisticCache.get('tasks');
        }
    },
    
    async create(task) {
        const userId = getUserId();
        
        // Optimistic: показать сразу
        const tempTask = {
            ...task,
            id: `temp_${Date.now()}_${Math.random()}`,
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            version: 1,
            _optimistic: true
        };
        
        OptimisticCache.add('tasks', tempTask);
        
        // Триггер обновления UI
        if (typeof window.loadTasks === 'function') {
            window.loadTasks();
        }
        
        try {
            const { data, error } = await supabaseClient
                .from('tasks')
                .insert([{ ...task, user_id: userId, version: 1 }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Заменить временную на настоящую
            OptimisticCache.replace('tasks', tempTask.id, data);
            
            return data;
        } catch (error) {
            // Откатить optimistic обновление
            OptimisticCache.remove('tasks', tempTask.id);
            
            // Триггер обновления UI
            if (typeof window.loadTasks === 'function') {
                window.loadTasks();
            }
            
            showNotification('Ошибка создания задачи: ' + error.message, 'error');
            throw error;
        }
    },

    async update(id, updates) {
        // Если это временная задача - игнорировать
        if (String(id).startsWith('temp_')) {
            console.warn('Попытка обновить временную задачу');
            return null;
        }
        
        try {
            // Получить текущую версию
            const { data: current } = await supabaseClient
                .from('tasks')
                .select('version')
                .eq('id', id)
                .single();
            
            const currentVersion = current?.version || 1;
            const newVersion = currentVersion + 1;
            
            const { data, error } = await supabaseClient
                .from('tasks')
                .update({ ...updates, version: newVersion })
                .eq('id', id)
                .eq('version', currentVersion) // Проверка версии!
                .select()
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    // Версия изменилась - конфликт!
                    const { data: latest } = await supabaseClient
                        .from('tasks')
                        .select('*')
                        .eq('id', id)
                        .single();
                    
                    throw {
                        type: 'CONFLICT',
                        message: 'Задача была изменена другим пользователем',
                        latest: latest,
                        attempted: updates
                    };
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            if (error.type === 'CONFLICT') {
                // Показать модальное окно разрешения конфликта
                if (typeof window.handleTaskConflict === 'function') {
                    await window.handleTaskConflict(id, error.latest, error.attempted);
                } else {
                    showNotification(error.message, 'error');
                }
            } else {
                showNotification('Ошибка обновления задачи', 'error');
            }
            throw error;
        }
    },

    async delete(id) {
        // Если это временная задача - просто убрать из кеша
        if (String(id).startsWith('temp_')) {
            OptimisticCache.remove('tasks', id);
            if (typeof window.loadTasks === 'function') {
                window.loadTasks();
            }
            return;
        }
        
        // Optimistic: убрать сразу из UI
        const tempId = `deleting_${id}`;
        OptimisticCache.add('tasks_deleting', { id: tempId, original_id: id });
        
        // Триггер обновления UI (задача должна исчезнуть)
        if (typeof window.loadTasks === 'function') {
            window.loadTasks();
        }
        
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            OptimisticCache.remove('tasks_deleting', tempId);
        } catch (error) {
            // Откатить удаление
            OptimisticCache.remove('tasks_deleting', tempId);
            
            if (typeof window.loadTasks === 'function') {
                window.loadTasks();
            }
            
            showNotification('Ошибка удаления задачи', 'error');
            throw error;
        }
    }
};

// ========== API ПРОЕКТОВ ==========
const ProjectAPI = {
    async getAll() {
        const userId = getUserId();
        
        try {
            // 1. Свои проекты
            const { data: myProjects } = await supabaseClient
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            // 2. Проекты где я участник
            const { data: memberRecords } = await supabaseClient
                .from('project_members')
                .select('project_id, role')
                .eq('user_id', userId);
            
            if (!memberRecords || memberRecords.length === 0) {
                return myProjects || [];
            }
            
            // Найти ID расшаренных проектов (где я не владелец)
            const sharedProjectIds = memberRecords
                .filter(m => m.role !== 'owner')
                .map(m => m.project_id);
            
            if (sharedProjectIds.length === 0) {
                return myProjects || [];
            }
            
            // 3. Загрузить расшаренные проекты
            const { data: sharedProjects } = await supabaseClient
                .from('projects')
                .select('*')
                .in('id', sharedProjectIds);
            
            // 4. Объединить
            const allProjects = [...(myProjects || [])];
            
            (sharedProjects || []).forEach(sp => {
                const member = memberRecords.find(m => m.project_id === sp.id);
                sp.memberRole = member?.role; // Пометить роль
                sp.isShared = true; // Пометить что расшарен
                allProjects.push(sp);
            });
            
            return allProjects;
            
        } catch (error) {
            console.error('Ошибка загрузки проектов:', error);
            return [];
        }
    },
    
    async create(project) {
        const userId = getUserId();
        
        const { data, error } = await supabaseClient
            .from('projects')
            .insert([{ ...project, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        
        await supabaseClient
            .from('project_members')
            .insert([{
                project_id: data.id,
                user_id: userId,
                role: 'owner',
                invited_by: userId
            }]);
        
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabaseClient
            .from('projects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabaseClient
            .from('projects')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// ========== API ЗАМЕТОК ==========
const NoteAPI = {
    async getAll() {
        const userId = getUserId();
        
        const { data, error } = await supabaseClient
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },
    
    async create(note) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('notes')
            .insert([{ ...note, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabaseClient
            .from('notes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// ========== API ПОДПРОЕКТОВ ==========
const SubprojectAPI = {
    async getAll(projectId) {
        const userId = getUserId();
        
        try {
            // ✅ ИСПРАВЛЕНО: Один запрос для member данных
            const { data: memberData } = await supabaseClient
                .from('project_members')
                .select('id, role')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .maybeSingle(); // maybeSingle вместо single - не ошибка если нет записи
            
            // Если не участник или владелец - только свои подпроекты
            if (!memberData || memberData.role === 'owner') {
                const { data: mySubprojects } = await supabaseClient
                    .from('subprojects')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('project_id', projectId)
                    .order('created_at', { ascending: false });
                
                return mySubprojects || [];
            }
            
            // ✅ ИСПРАВЛЕНО: Один запрос для всех прав
            const { data: permissions } = await supabaseClient
                .from('member_permissions')
                .select('*')
                .eq('member_id', memberData.id);
            
            const allowedSubprojectIds = (permissions || [])
                .filter(p => p.resource_type === 'subproject' && p.can_view && p.resource_id !== null)
                .map(p => p.resource_id);
            
            // Свои подпроекты
            const { data: mySubprojects } = await supabaseClient
                .from('subprojects')
                .select('*')
                .eq('user_id', userId)
                .eq('project_id', projectId);
            
            if (allowedSubprojectIds.length === 0) {
                return mySubprojects || [];
            }
            
            // ✅ ИСПРАВЛЕНО: Один запрос для расшаренных подпроектов
            const { data: sharedSubprojects } = await supabaseClient
                .from('subprojects')
                .select('*')
                .eq('project_id', projectId)
                .in('id', allowedSubprojectIds);
            
            // Объединить
            const all = [...(mySubprojects || [])];
            (sharedSubprojects || []).forEach(sp => {
                const perm = permissions.find(p => p.resource_id === sp.id);
                sp.canEdit = perm?.can_edit || false;
                sp.isShared = true;
                all.push(sp);
            });
            
            return all;
            
        } catch (error) {
            console.error('Ошибка загрузки подпроектов:', error);
            return [];
        }
    },
    
    async create(subproject) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('subprojects')
            .insert([{ ...subproject, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabaseClient
            .from('subprojects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabaseClient
            .from('subprojects')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// ========== API ЭТАПОВ ==========
const MilestoneAPI = {
    async getAll(projectId) {
        const { data, error } = await supabaseClient
            .from('milestones')
            .select('*')
            .eq('project_id', projectId)
            .order('end_date', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },
    
    async create(milestone) {
        const { data, error } = await supabaseClient
            .from('milestones')
            .insert([milestone])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async update(id, updates) {
        const { data, error } = await supabaseClient
            .from('milestones')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async delete(id) {
        const { error } = await supabaseClient
            .from('milestones')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },
    
    async toggleComplete(id) {
        const userId = getUserId();
        const { data: milestones } = await supabaseClient
            .from('milestones')
            .select('*')
            .eq('user_id', userId);
        
        const milestone = milestones.find(m => m.id === id);
        
        if (!milestone) throw new Error('Milestone not found');
        
        return await this.update(id, { completed: !milestone.completed });
    }
};

// ========== API ПОЛЕЙ ==========
const CustomFieldAPI = {
    async getAll(subprojectId) {
        try {
            const { data, error } = await supabaseClient
                .from('custom_fields')
                .select('*')
                .eq('subproject_id', subprojectId)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Ошибка загрузки полей:', error);
            return [];
        }
    },
    
    async create(field) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('custom_fields')
            .insert([{ ...field, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabaseClient
            .from('custom_fields')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// ========== API ТАБЛИЦ ==========
const SpTableAPI = {
    async getAll(subprojectId) {
        try {
            const { data, error } = await supabaseClient
                .from('sp_tables')
                .select('*')
                .eq('subproject_id', subprojectId)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Ошибка загрузки таблиц:', error);
            return [];
        }
    },

    async create(table) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('sp_tables')
            .insert([{ ...table, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabaseClient
            .from('sp_tables')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    async getRows(tableId) {
        try {
            const { data, error } = await supabaseClient
                .from('sp_table_rows')
                .select('*')
                .eq('table_id', tableId)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Ошибка загрузки строк таблицы:', error);
            return [];
        }
    },

    async createRow(tableId, rowData) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('sp_table_rows')
            .insert([{
                table_id: tableId,
                row_data: rowData,
                user_id: userId
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async updateRow(rowId, rowData) {
        const { data, error } = await supabaseClient
            .from('sp_table_rows')
            .update({ row_data: rowData })
            .eq('id', rowId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async deleteRow(rowId) {
        const { error } = await supabaseClient
            .from('sp_table_rows')
            .delete()
            .eq('id', rowId);
        
        if (error) throw error;
    }
};

// ========== API ЗАМЕТОК ПОДПРОЕКТА ==========
const SubprojectNoteAPI = {
    async getAll(subprojectId) {
        try {
            const { data, error } = await supabaseClient
                .from('subproject_notes')
                .select('*')
                .eq('subproject_id', subprojectId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Ошибка загрузки заметок подпроекта:', error);
            return [];
        }
    },

    async create(note) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('subproject_notes')
            .insert([{ ...note, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabaseClient
            .from('subproject_notes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// ========== API ЗАМЕТОК ПРОЕКТА ==========
const ProjectNoteAPI = {
    async getAll(projectId) {
        const { data, error } = await supabaseClient
            .from('project_notes')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },
    
    async create(projectId, title, content) {
        const { data, error } = await supabaseClient
            .from('project_notes')
            .insert([{
                user_id: getUserId(),
                project_id: projectId,
                title: title,
                content: content
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async update(id, updates) {
        const { data, error } = await supabaseClient
            .from('project_notes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async delete(id) {
        const { error } = await supabaseClient
            .from('project_notes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// ========== API УЧАСТНИКОВ ПРОЕКТА ==========
const ProjectMemberAPI = {
    async add(projectId, userId, role) {
        const currentUserId = getUserId();
        
        const { data, error } = await supabaseClient
            .from('project_members')
            .insert([{
                project_id: projectId,
                user_id: String(userId),
                role: role,
                invited_by: currentUserId
            }])
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                throw new Error('Пользователь уже добавлен в проект');
            }
            throw error;
        }
        return data;
    },

    async getMembers(projectId) {
        const { data, error } = await supabaseClient
            .from('project_members')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    async remove(projectId, userId) {
        const { error } = await supabaseClient
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);
        
        if (error) throw error;
    },

    async updateRole(projectId, userId, newRole) {
        const { data, error } = await supabaseClient
            .from('project_members')
            .update({ role: newRole })
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async isOwner(projectId, userId) {
        const { data } = await supabaseClient
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();
        
        return data?.role === 'owner';
    },

    async getRole(projectId, userId) {
        const { data } = await supabaseClient
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();
        
        return data?.role || null;
    },

    async getMemberId(projectId, userId) {
        const { data } = await supabaseClient
            .from('project_members')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();
        
        return data?.id || null;
    }
};

// ========== API ПРАВ УЧАСТНИКОВ ==========
const MemberPermissionAPI = {
    async set(memberId, resourceType, canView, canEdit, resourceId = null) {
        const { data, error } = await supabaseClient
            .from('member_permissions')
            .upsert([{
                member_id: memberId,
                resource_type: resourceType,
                resource_id: resourceId,
                can_view: canView,
                can_edit: canEdit
            }], { onConflict: 'member_id,resource_type,resource_id' })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async get(memberId) {
        const { data, error } = await supabaseClient
            .from('member_permissions')
            .select('*')
            .eq('member_id', memberId);
        
        if (error) throw error;
        return data || [];
    },

    async canAccess(projectId, userId, resourceType, resourceId = null, needEdit = false) {
        try {
            const cacheKey = getCacheKey(projectId, userId, resourceType, resourceId, needEdit);
            if (permissionCache.has(cacheKey)) {
                return permissionCache.get(cacheKey);
            }
            
            const role = await ProjectMemberAPI.getRole(projectId, userId);
            
            if (role === 'owner') {
                permissionCache.set(cacheKey, true);
                return true;
            }
            
            if (!role) {
                permissionCache.set(cacheKey, false);
                return false;
            }
            
            const memberId = await ProjectMemberAPI.getMemberId(projectId, userId);
            if (!memberId) {
                permissionCache.set(cacheKey, false);
                return false;
            }
            
            let query = supabaseClient
                .from('member_permissions')
                .select('can_view, can_edit')
                .eq('member_id', memberId)
                .eq('resource_type', resourceType);
            
            if (resourceId) {
                const { data: specific } = await query.eq('resource_id', resourceId).single();
                if (specific) {
                    const result = needEdit ? specific.can_edit : specific.can_view;
                    permissionCache.set(cacheKey, result);
                    return result;
                }
            }
            
            const { data: general } = await query.is('resource_id', null).single();
            if (general) {
                const result = needEdit ? general.can_edit : general.can_view;
                permissionCache.set(cacheKey, result);
                return result;
            }
            
            permissionCache.set(cacheKey, false);
            return false;
            
        } catch (error) {
            console.error('Ошибка проверки прав:', error);
            return false;
        }
    },

    async remove(memberId, resourceType, resourceId = null) {
        let query = supabaseClient
            .from('member_permissions')
            .delete()
            .eq('member_id', memberId)
            .eq('resource_type', resourceType);
        
        if (resourceId) {
            query = query.eq('resource_id', resourceId);
        } else {
            query = query.is('resource_id', null);
        }
        
        const { error } = await query;
        if (error) throw error;
    }
};

// ========== API ДЕРЕВА ПРОГРЕССА ==========

// Таблица уровней дерева
const TREE_LEVELS = [
    { level: 0, name: 'Семя', xp: 0 },
    { level: 1, name: 'Росток', xp: 100 },
    { level: 2, name: 'Саженец', xp: 500 },
    { level: 3, name: 'Молодое дерево', xp: 1500 },
    { level: 4, name: 'Крепкое дерево', xp: 3500 },
    { level: 5, name: 'Цветущее дерево', xp: 7000 },
    { level: 6, name: 'Плодоносящее', xp: 12000 },
    { level: 7, name: 'Величественное', xp: 20000 },
    { level: 8, name: 'Древнее', xp: 35000 },
    { level: 9, name: 'Легендарное', xp: 60000 },
    { level: 10, name: 'Мировое Древо', xp: 100000 }
];

// Таблица начисления XP
const XP_REWARDS = {
    // Задачи
    task_created: 2,
    task_edited: 1,
    task_completed: 5,
    task_completed_on_time: 3, // бонус
    task_completed_high_priority: 2, // бонус
    
    // Проекты
    project_created: 10,
    project_edited: 2,
    subproject_created: 8,
    milestone_created: 5,
    milestone_completed: 15,
    
    // Заметки
    note_created: 3,
    project_note_created: 5,
    subproject_note_created: 4,
    
    // Таблицы
    table_created: 8,
    table_row_created: 1,
    table_row_edited: 1,
    
    // Кастомные поля
    custom_field_created: 3,
    custom_field_edited: 1,
    
    // Социальное
    member_invited: 10,
    permissions_set: 5,
    
    // Ежедневная активность
    daily_login: 5
};

const TreeAPI = {   
    // ✅ КЕШ СТАТИСТИКИ
    _statsCache: null,
    _statsCacheTime: 0,
    _statsCacheTimeout: 2000, // 2 секунды
    
    // ✅ DEBOUNCE ДЛЯ ПРОФИЛЯ
    _profileReloadTimeout: null,
    
    // ✅ ОЧИСТИТЬ КЕШ
    clearStatsCache() {
        this._statsCache = null;
        this._statsCacheTime = 0;
    },
    
    // ✅ ОБНОВИТЬ ПРОФИЛЬ С DEBOUNCE
    refreshProfileDebounced() {
        if (this._profileReloadTimeout) {
            clearTimeout(this._profileReloadTimeout);
        }
        
        this._profileReloadTimeout = setTimeout(() => {
            this.clearStatsCache();
            if (currentTab === 'profile' && typeof loadProfile === 'function') {
                loadProfile();
            }
        }, 500);
    },
    
    // Получить статистику (С КЕШИРОВАНИЕМ)
    async getStats(userId) {
        try {
            const now = Date.now();
            
            // ✅ ВЕРНУТЬ КЕШ ЕСЛИ СВЕЖИЙ
            if (this._statsCache && 
                this._statsCache.user_id === userId && 
                now - this._statsCacheTime < this._statsCacheTimeout) {
                return this._statsCache;
            }
            
            // Загрузить из базы
            let { data, error } = await supabaseClient
                .from('user_tree_stats')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code === 'PGRST116') {
                data = await this.initStats(userId);
            } else if (error) {
                throw error;
            }
            
            // ✅ СОХРАНИТЬ В КЕШ
            this._statsCache = data;
            this._statsCacheTime = now;
            
            console.log('✅ Статистика загружена:', data);
            return data;
            
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            throw error;
        }
    },
    
    
    // Инициализировать статистику
    // Инициализировать статистику
    // Инициализировать статистику
    // Инициализировать статистику
    async initStats(userId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { data, error } = await supabaseClient
                .from('user_tree_stats')
                .insert([{
                    user_id: userId,
                    total_xp: 0,
                    tree_level: 0,
                    current_streak: 1,
                    max_streak: 1,
                    last_activity_date: today,
                    tasks_created: 0,
                    tasks_completed: 0,
                    tasks_edited: 0,
                    projects_created: 0,
                    subprojects_created: 0,
                    notes_created: 0,
                    tables_created: 0,
                    table_rows_created: 0,
                    members_invited: 0,
                    custom_fields_created: 0,
                    achievements_migrated: false // ← ДОБАВИТЬ
                }])
                .select()
                .single();
            
            if (error) {
                console.error('Ошибка создания статистики:', error);
                throw error;
            }
            
            console.log('✅ Статистика создана:', data);
            return data;
        } catch (error) {
            console.error('Критическая ошибка initStats:', error);
            throw error;
        }
    },
    
    // Начислить XP
    async addXP(userId, actionType, extraXP = 0) {
        try {
            const baseXP = XP_REWARDS[actionType] || 0;
            const totalXP = baseXP + extraXP;
            
            if (totalXP === 0) return;
            
            // Получить текущую статистику
            const stats = await this.getStats(userId);
            const newTotalXP = stats.total_xp + totalXP;
            
            // Вычислить новый уровень
            const newLevel = this.calculateLevel(newTotalXP);
            const leveledUp = newLevel > stats.tree_level;
            
            // Обновить streak
            const today = new Date().toISOString().split('T')[0];
            const lastDate = stats.last_activity_date;
            let newStreak = stats.current_streak || 0;
    
            if (lastDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                if (lastDate === yesterdayStr) {
                    // Продолжаем streak
                    newStreak += 1;
                } else if (!lastDate) {
                    // Первый вход
                    newStreak = 1;
                } else {
                    // Пропустили дни - сброс
                    newStreak = 1;
                }
            } else {
                // Сегодня уже заходили - не меняем streak
                newStreak = stats.current_streak || 1;
            }
    
            const maxStreak = Math.max(stats.max_streak || 0, newStreak);
            
            // Обновить статистику
            const updates = {
                total_xp: newTotalXP,
                tree_level: newLevel,
                current_streak: newStreak,
                max_streak: maxStreak,
                last_activity_date: today,
                updated_at: new Date().toISOString()
            };
            
            // Обновить счётчик действия
            const actionCounters = {
                task_created: 'tasks_created',
                task_edited: 'tasks_edited',
                task_completed: 'tasks_completed',
                project_created: 'projects_created',
                subproject_created: 'subprojects_created',
                note_created: 'notes_created',
                project_note_created: 'notes_created',
                subproject_note_created: 'notes_created',
                table_created: 'tables_created',
                table_row_created: 'table_rows_created',
                member_invited: 'members_invited',
                custom_field_created: 'custom_fields_created'
            };
            
            if (actionCounters[actionType]) {
                const counterField = actionCounters[actionType];
                updates[counterField] = (stats[counterField] || 0) + 1;
            }
            
            // ✅ ОБНОВИТЬ БАЗУ
            await supabaseClient
                .from('user_tree_stats')
                .update(updates)
                .eq('user_id', userId);
            
            // ✅ ОЧИСТИТЬ КЕШ СТАТИСТИКИ
            this.clearStatsCache();
            
            // Логировать XP
            await supabaseClient
                .from('xp_log')
                .insert([{
                    user_id: userId,
                    action_type: actionType,
                    xp_earned: totalXP
                }]);
            
            // Проверить достижения (НЕ для бонусного XP, чтобы избежать рекурсии)
            if (actionType !== 'achievement_bonus') {
                await this.checkAchievements(userId, false);
            }
            
            return { 
                totalXP: totalXP, 
                leveledUp, 
                newLevel, 
                newStreak 
            };
            
        } catch (error) {
            console.error('Ошибка начисления XP:', error);
        }
    },
    
    // Вычислить уровень по XP
    calculateLevel(xp) {
        for (let i = TREE_LEVELS.length - 1; i >= 0; i--) {
            if (xp >= TREE_LEVELS[i].xp) {
                return TREE_LEVELS[i].level;
            }
        }
        return 0;
    },
    
    // Получить информацию об уровне
    getLevelInfo(level) {
        return TREE_LEVELS[level] || TREE_LEVELS[0];
    },
    
    // Получить прогресс до следующего уровня
    getProgress(xp, level) {
        const currentLevel = TREE_LEVELS[level];
        const nextLevel = TREE_LEVELS[level + 1];
        
        if (!nextLevel) {
            return { progress: 100, current: xp, total: xp };
        }
        
        const xpInLevel = xp - currentLevel.xp;
        const xpNeeded = nextLevel.xp - currentLevel.xp;
        const progress = Math.floor((xpInLevel / xpNeeded) * 100);
        
        return { progress, current: xpInLevel, total: xpNeeded };
    },
    
    // Проверить достижения
    // Проверить достижения
    // Проверить достижения
    async checkAchievements(userId, skipXP = false) { // ← Добавить параметр
        try {
            const stats = await this.getStats(userId);
            
            // Получить все достижения
            const { data: allAchievements } = await supabaseClient
                .from('achievements')
                .select('*');
            
            // Получить разблокированные
            const { data: unlockedIds } = await supabaseClient
                .from('user_achievements')
                .select('achievement_id')
                .eq('user_id', userId);
            
            const unlockedSet = new Set(unlockedIds?.map(u => u.achievement_id) || []);
            
            console.log('🔍 Проверка достижений. Уже разблокировано:', unlockedSet.size);
            
            let newUnlocked = 0;
            
            // Проверить каждое достижение
            for (const ach of allAchievements) {
                // Пропустить уже разблокированные
                if (unlockedSet.has(ach.id)) {
                    continue;
                }
                
                const statValue = stats[ach.condition_target] || 0;
                
                if (statValue >= ach.condition_value) {
                    try {
                        // Разблокировать!
                        await supabaseClient
                            .from('user_achievements')
                            .insert([{
                                user_id: userId,
                                achievement_id: ach.id
                            }]);
                        
                        console.log('🏆 Разблокировано:', ach.name);
                        newUnlocked++;
                        
                        // Показать уведомление
                        showAchievementUnlocked(ach);
                        
                        // ✅ НАЧИСЛИТЬ XP ТОЛЬКО ЕСЛИ НЕ МИГРАЦИЯ
                        if (!skipXP && ach.xp_reward > 0) {
                            await this.addXP(userId, 'achievement_bonus', ach.xp_reward);
                        }
                    } catch (insertError) {
                        // Игнорировать ошибки дубликатов (409)
                        if (insertError.code !== '23505') {
                            console.error('Ошибка разблокировки достижения:', insertError);
                        }
                    }
                }
            }
            
            console.log(`✅ Проверка завершена. Новых: ${newUnlocked}`);
            
        } catch (error) {
            console.error('Ошибка проверки достижений:', error);
        }
    },
    
    // Получить достижения пользователя
    async getAchievements(userId) {
        const { data, error } = await supabaseClient
            .from('user_achievements')
            .select(`
                achievement_id,
                unlocked_at,
                achievements (*)
            `)
            .eq('user_id', userId);
        
        if (error) throw error;
        return data || [];
    },
    
    // Получить все достижения с прогрессом
    async getAllAchievementsWithProgress(userId) {
        const stats = await this.getStats(userId);
        
        const { data: allAchievements } = await supabaseClient
            .from('achievements')
            .select('*')
            .order('xp_reward', { ascending: true });
        
        const { data: unlocked } = await supabaseClient
            .from('user_achievements')
            .select('achievement_id, unlocked_at')
            .eq('user_id', userId);
        
        const unlockedMap = new Map(unlocked?.map(u => [u.achievement_id, u.unlocked_at]) || []);
        
        return allAchievements.map(ach => {
            const isUnlocked = unlockedMap.has(ach.id);
            const currentValue = stats[ach.condition_target] || 0;
            const progress = Math.min(100, Math.floor((currentValue / ach.condition_value) * 100));
            
            return {
                ...ach,
                unlocked: isUnlocked,
                unlocked_at: unlockedMap.get(ach.id),
                progress,
                current: currentValue,
                target: ach.condition_value
            };
        });
    }
};

let profileReloadTimeout = null;

function reloadProfileDebounced() {
    if (profileReloadTimeout) clearTimeout(profileReloadTimeout);
    
    profileReloadTimeout = setTimeout(() => {
        TreeAPI.refreshProfileDebounced();
    }, 500); // Обновлять не чаще раза в 500ms
}

// В realtime подписке:
RealtimeSync.subscribe('tasks', (payload) => {
    reloadProfileDebounced(); // Вместо loadProfile()
});
console.log('🔍 TreeAPI перед экспортом:', typeof TreeAPI);
console.log('🔍 TreeAPI.getStats:', typeof TreeAPI?.getStats);


// ========== ЭКСПОРТ ==========
window.TaskAPI = TaskAPI;
window.ProjectAPI = ProjectAPI;
window.NoteAPI = NoteAPI;
window.SubprojectAPI = SubprojectAPI;
window.MilestoneAPI = MilestoneAPI;
window.CustomFieldAPI = CustomFieldAPI;
window.SpTableAPI = SpTableAPI;
window.SubprojectNoteAPI = SubprojectNoteAPI;
window.ProjectNoteAPI = ProjectNoteAPI;
window.ProjectMemberAPI = ProjectMemberAPI;
window.MemberPermissionAPI = MemberPermissionAPI;
window.TreeAPI = TreeAPI; // ← ДОБАВИТЬ
window.getUserId = getUserId;
window.clearPermissionCache = clearPermissionCache;

console.log('✅ Supabase API с деревом загружен успешно');
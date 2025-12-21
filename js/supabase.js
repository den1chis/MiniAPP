// Supabase конфигурация
const SUPABASE_URL = 'https://pyibgdenhyxtetcdykdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5aWJnZGVuaHl4dGV0Y2R5a2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDgxMTksImV4cCI6MjA4MTM4NDExOX0.Q_rZuNreW3ytgh3XekTbvct_xu2_ccfsb4BnnjZjaQU';

// Инициализация клиента
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Получить ID пользователя из Telegram
// Получить ID пользователя из Telegram
function getUserId() {
    // Попытка получить ID из Telegram WebApp
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        return String(window.Telegram.WebApp.initDataUnsafe.user.id);
    }
    
    // Для тестирования вне Telegram - фиксированный ID
    let userId = localStorage.getItem('fixed_user_id');
    if (!userId) {
        userId = 'test_user_demo'; // Фиксированный ID для теста
        localStorage.setItem('fixed_user_id', userId);
    }
    return userId;
}
// API функции для задач
const TaskAPI = {
    async getAll() {
        const userId = getUserId();
        
        try {
            // Свои задачи
            const { data: myTasks, error: myError } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (myError) throw myError;
            
            // Проекты, где я участник
            const { data: memberRecords } = await supabase
                .from('project_members')
                .select('project_id, id')
                .eq('user_id', userId)
                .neq('role', 'owner');
            
            if (!memberRecords || memberRecords.length === 0) {
                return myTasks || [];
            }
            
            let sharedTasks = [];
            
            // Для каждого проекта проверить права
            for (const member of memberRecords) {
                try {
                    const canView = await MemberPermissionAPI.canAccess(member.project_id, userId, 'tasks');
                    
                    if (canView) {
                        const { data: projectTasks } = await supabase
                            .from('tasks')
                            .select('*')
                            .eq('project_id', member.project_id);
                        
                        if (projectTasks) {
                            projectTasks.forEach(t => {
                                t.isShared = true;
                                sharedTasks.push(t);
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Ошибка загрузки задач проекта ${member.project_id}:`, err);
                    // Продолжить загрузку остальных
                }
            }
            
            return [...(myTasks || []), ...sharedTasks];
            
        } catch (error) {
            console.error('Критическая ошибка загрузки задач:', error);
            return [];
        }
    },
    
    async create(task) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('tasks')
            .insert([{ ...task, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};
// ========== API для управления участниками проекта ==========
// ========== КЕШ ПРАВ ДОСТУПА ==========
const permissionCache = new Map();

function getCacheKey(projectId, userId, resourceType, resourceId, needEdit) {
    return `${projectId}_${userId}_${resourceType}_${resourceId || 'null'}_${needEdit}`;
}

// Очистить кеш (вызывать при изменении прав)
function clearPermissionCache() {
    permissionCache.clear();
}
const ProjectMemberAPI = {
    // Добавить участника с ролью
    async add(projectId, userId, role) {
        const currentUserId = getUserId();
        
        // Проверить, что текущий пользователь - владелец
        const isOwner = await this.isOwner(projectId, currentUserId);
        if (!isOwner) {
            throw new Error('Только владелец может добавлять участников');
        }
        
        const { data, error } = await supabase
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

    // Получить участников проекта
    async getMembers(projectId) {
        const { data, error } = await supabase
            .from('project_members')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    // Удалить участника
    async remove(projectId, userId) {
        const currentUserId = getUserId();
        const isOwner = await this.isOwner(projectId, currentUserId);
        
        if (!isOwner) {
            throw new Error('Только владелец может удалять участников');
        }
        
        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);
        
        if (error) throw error;
    },

    // Обновить роль
    async updateRole(projectId, userId, newRole) {
        const currentUserId = getUserId();
        const isOwner = await this.isOwner(projectId, currentUserId);
        
        if (!isOwner) {
            throw new Error('Только владелец может изменять роли');
        }
        
        const { data, error } = await supabase
            .from('project_members')
            .update({ role: newRole })
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Проверить, является ли пользователь владельцем
    async isOwner(projectId, userId) {
        const { data, error } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data?.role === 'owner';
    },

    // Получить роль пользователя в проекте
    async getRole(projectId, userId) {
        const { data, error } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data?.role || null;
    },

    // Получить ID участника
    async getMemberId(projectId, userId) {
        const { data, error } = await supabase
            .from('project_members')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data?.id || null;
    }
};

const MemberPermissionAPI = {
    // Установить права на ресурс
    async set(memberId, resourceType, canView, canEdit, resourceId = null) {
        const { data, error } = await supabase
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

    // Получить права участника
    async get(memberId) {
        const { data, error } = await supabase
            .from('member_permissions')
            .select('*')
            .eq('member_id', memberId);
        
        if (error) throw error;
        return data || [];
    },

    // Проверить доступ к конкретному ресурсу
    async canAccess(projectId, userId, resourceType, resourceId = null, needEdit = false) {
        try {
            // Проверить кеш
            const cacheKey = getCacheKey(projectId, userId, resourceType, resourceId, needEdit);
            if (permissionCache.has(cacheKey)) {
                return permissionCache.get(cacheKey);
            }
            
            const role = await ProjectMemberAPI.getRole(projectId, userId);
            
            // Владелец имеет полный доступ
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
            
            // Проверить права
            let query = supabase
                .from('member_permissions')
                .select('can_view, can_edit')
                .eq('member_id', memberId)
                .eq('resource_type', resourceType);
            
            if (resourceId) {
                const { data: specific, error: specError } = await query.eq('resource_id', resourceId).single();
                if (!specError && specific) {
                    const result = needEdit ? specific.can_edit : specific.can_view;
                    permissionCache.set(cacheKey, result);
                    return result;
                }
            }
            
            const { data: general, error: genError } = await query.is('resource_id', null).single();
            if (!genError && general) {
                const result = needEdit ? general.can_edit : general.can_view;
                permissionCache.set(cacheKey, result);
                return result;
            }
            
            permissionCache.set(cacheKey, false);
            return false;
            
        } catch (error) {
            console.error('Ошибка проверки прав доступа:', error);
            // При ошибке запретить доступ
            return false;
        }
    },  

    // Удалить права
    async remove(memberId, resourceType, resourceId = null) {
        let query = supabase
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
// API функции для проектов
// API для шаринга проектов
const ProjectShareAPI = {
    async share(projectId, telegramId) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('project_shares')
            .insert([{
                project_id: projectId,
                owner_id: userId,
                shared_with_id: String(telegramId),
                can_edit: true
            }])
            .select()
            .single();
        
        if (error) {
            // Если уже расшарен, игнорируем ошибку
            if (error.code === '23505') {
                throw new Error('Проект уже расшарен с этим пользователем');
            }
            throw error;
        }
        return data;
    },

    async getSharedProjects() {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('project_shares')
            .select('project_id')
            .eq('shared_with_id', userId);
        
        if (error) throw error;
        return data || [];
    },

    async getProjectShares(projectId) {
        const { data, error } = await supabase
            .from('project_shares')
            .select('*')
            .eq('project_id', projectId);
        
        if (error) throw error;
        return data || [];
    },

    async removeShare(projectId, sharedWithId) {
        const { error } = await supabase
            .from('project_shares')
            .delete()
            .eq('project_id', projectId)
            .eq('shared_with_id', sharedWithId);
        
        if (error) throw error;
    }
};

// Обновите ProjectAPI.getAll:
const ProjectAPI = {
    async getAll() {
        const userId = getUserId();
        
        try {
            // 1. Свои проекты
            const { data: myProjects, error: myError } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (myError) throw myError;
            
            // 2. Проекты, где я участник
            const { data: memberRecords, error: memberError } = await supabase
                .from('project_members')
                .select('project_id, role')
                .eq('user_id', userId);
            
            if (memberError) {
                console.error('Ошибка загрузки участников:', memberError);
                // Не критично - просто вернуть свои проекты
                return myProjects || [];
            }
            
            // Если нет записей участников - вернуть только свои
            if (!memberRecords || memberRecords.length === 0) {
                return myProjects || [];
            }
            
            const sharedProjectIds = memberRecords
                .filter(m => m.role !== 'owner')
                .map(m => m.project_id);
            
            if (sharedProjectIds.length === 0) {
                return myProjects || [];
            }
            
            // 3. Загрузить расшаренные проекты
            const { data: sharedProjects, error: sharedError } = await supabase
                .from('projects')
                .select('*')
                .in('id', sharedProjectIds);
            
            if (sharedError) {
                console.error('Ошибка загрузки расшаренных проектов:', sharedError);
                return myProjects || [];
            }
            
            // 4. Объединить
            const allProjects = [...(myProjects || [])];
            (sharedProjects || []).forEach(sp => {
                const member = memberRecords.find(m => m.project_id === sp.id);
                sp.memberRole = member?.role;
                sp.isShared = true;
                allProjects.push(sp);
            });
            
            return allProjects;
            
        } catch (error) {
            console.error('Критическая ошибка загрузки проектов:', error);
            // Вернуть пустой массив вместо падения
            return [];
        }
    },
    
    async create(project) {
        const userId = getUserId();
        
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert([{ ...project, user_id: userId }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Добавить создателя как владельца
            await supabase
                .from('project_members')
                .insert([{
                    project_id: data.id,
                    user_id: userId,
                    role: 'owner',
                    invited_by: userId
                }]);
            
            return data;
        } catch (error) {
            console.error('Ошибка создания проекта:', error);
            throw error;
        }
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};
// API функции для заметок
const NoteAPI = {
    async getAll() {
        const userId = getUserId();
        
        // Свои заметки
        const { data: myNotes, error } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Заметки из расшаренных проектов будут загружаться отдельно в ProjectNoteAPI
        return myNotes || [];
    },
    
    async create(note) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('notes')
            .insert([{ ...note, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('notes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// API для подпроектов
const SubprojectAPI = {
    async getAll(projectId) {
        const userId = getUserId();
        
        // Свои подпроекты
        const { data: mySubprojects, error: myError } = await supabase
            .from('subprojects')
            .select('*')
            .eq('user_id', userId)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        
        if (myError) throw myError;
        
        // Проверить, участник ли пользователь этого проекта
        const role = await ProjectMemberAPI.getRole(projectId, userId);
        
        if (!role || role === 'owner') {
            // Владелец или не участник - только свои подпроекты
            return mySubprojects || [];
        }
        
        // Получить ID участника
        const memberId = await ProjectMemberAPI.getMemberId(projectId, userId);
        if (!memberId) return mySubprojects || [];
        
        // Получить разрешения на подпроекты
        const permissions = await MemberPermissionAPI.get(memberId);
        const allowedSubprojectIds = permissions
            .filter(p => p.resource_type === 'subproject' && p.can_view && p.resource_id !== null)
            .map(p => p.resource_id);
        
        if (allowedSubprojectIds.length === 0) {
            return mySubprojects || [];
        }
        
        // Загрузить расшаренные подпроекты
        const { data: sharedSubprojects, error: sharedError } = await supabase
            .from('subprojects')
            .select('*')
            .in('id', allowedSubprojectIds)
            .eq('project_id', projectId);
        
        if (sharedError) throw sharedError;
        
        const allSubprojects = [...(mySubprojects || [])];
        (sharedSubprojects || []).forEach(sp => {
            sp.isShared = true;
            allSubprojects.push(sp);
        });
        
        return allSubprojects;
    },

    async create(subproject) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('subprojects')
            .insert([{ ...subproject, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('subprojects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('subprojects')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// API для milestones
const MilestoneAPI = {
    async getAll(projectId) {
        const userId = getUserId();
        
        // Проверить права на roadmap
        const canView = await MemberPermissionAPI.canAccess(projectId, userId, 'roadmap');
        
        if (!canView) {
            // Нет прав - вернуть пустой массив
            return [];
        }
        
        const { data, error } = await supabase
            .from('milestones')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },
    
    async create(milestone) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('milestones')
            .insert([{ ...milestone, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('milestones')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('milestones')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    async toggleComplete(id) {
        const { data, error } = await supabase
            .from('milestones')
            .select('completed')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        const { data: updated, error: updateError } = await supabase
            .from('milestones')
            .update({ completed: !data.completed })
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) throw updateError;
        return updated;
    }
};

const CustomFieldAPI = {
    async getAll(subprojectId) {
        const userId = getUserId();
        
        // Проверить доступ к подпроекту
        const { data: subproject } = await supabase
            .from('subprojects')
            .select('project_id')
            .eq('id', subprojectId)
            .single();
        
        if (!subproject) return [];
        
        const canView = await MemberPermissionAPI.canAccess(subproject.project_id, userId, 'subproject', subprojectId);
        
        if (!canView) return [];
        
        const { data, error } = await supabase
            .from('custom_fields')
            .select('*')
            .eq('subproject_id', subprojectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },
    
    async create(field) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('custom_fields')
            .insert([{ ...field, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('custom_fields')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('custom_fields')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// API для таблиц подпроектов
const SpTableAPI = {
    async getAll(subprojectId) {
        const userId = getUserId();
        
        // Проверить доступ к подпроекту
        const { data: subproject } = await supabase
            .from('subprojects')
            .select('project_id')
            .eq('id', subprojectId)
            .single();
        
        if (!subproject) return [];
        
        const canView = await MemberPermissionAPI.canAccess(subproject.project_id, userId, 'subproject', subprojectId);
        
        if (!canView) return [];
        
        const { data, error } = await supabase
            .from('sp_tables')
            .select('*')
            .eq('subproject_id', subprojectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    async create(table) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('sp_tables')
            .insert([{ ...table, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('sp_tables')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    async getRows(tableId) {
        const userId = getUserId();
        
        // Получить таблицу и проверить доступ
        const { data: table } = await supabase
            .from('sp_tables')
            .select('subproject_id')
            .eq('id', tableId)
            .single();
        
        if (!table) return [];
        
        const { data: subproject } = await supabase
            .from('subprojects')
            .select('project_id')
            .eq('id', table.subproject_id)
            .single();
        
        if (!subproject) return [];
        
        const canView = await MemberPermissionAPI.canAccess(subproject.project_id, userId, 'subproject', table.subproject_id);
        
        if (!canView) return [];
        
        const { data, error } = await supabase
            .from('sp_table_rows')
            .select('*')
            .eq('table_id', tableId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    async createRow(tableId, rowData) {
        const userId = getUserId();
        const { data, error } = await supabase
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
        const { data, error } = await supabase
            .from('sp_table_rows')
            .update({ row_data: rowData })
            .eq('id', rowId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async deleteRow(rowId) {
        const { error } = await supabase
            .from('sp_table_rows')
            .delete()
            .eq('id', rowId);
        
        if (error) throw error;
    }
};

// API для заметок подпроектов
const SubprojectNoteAPI = {
    async getAll(subprojectId) {
        const userId = getUserId();
        
        // Проверить доступ к подпроекту
        const { data: subproject } = await supabase
            .from('subprojects')
            .select('project_id')
            .eq('id', subprojectId)
            .single();
        
        if (!subproject) return [];
        
        const canView = await MemberPermissionAPI.canAccess(subproject.project_id, userId, 'subproject', subprojectId);
        
        if (!canView) return [];
        
        const { data, error } = await supabase
            .from('subproject_notes')
            .select('*')
            .eq('subproject_id', subprojectId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async create(note) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('subproject_notes')
            .insert([{ ...note, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('subproject_notes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// API для заметок проектов
const ProjectNoteAPI = {
    async getAll(projectId) {
        const userId = getUserId();
        
        // Проверить права на заметки
        const canView = await MemberPermissionAPI.canAccess(projectId, userId, 'notes');
        
        if (!canView) {
            return [];
        }
        
        const { data, error } = await supabase
            .from('project_notes')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },
    
    async create(note) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('project_notes')
            .insert([{ ...note, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('project_notes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};



// ========== ИНИЦИАЛИЗАЦИЯ SUPABASE ==========
const SUPABASE_URL = 'https://pyibgdenhyxtetcdykdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5aWJnZGVuaHl4dGV0Y2R5a2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDgxMTksImV4cCI6MjA4MTM4NDExOX0.Q_rZuNreW3ytgh3XekTbvct_xu2_ccfsb4BnnjZjaQU';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

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
const TaskAPI = {
    async getAll() {
        const userId = getUserId();
        
        try {
            const { data: myTasks } = await supabaseClient
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            return myTasks || [];
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            return [];
        }
    },
    
    async create(task) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('tasks')
            .insert([{ ...task, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabaseClient
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabaseClient
            .from('tasks')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
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
            // Свои подпроекты
            const { data: mySubprojects } = await supabaseClient
                .from('subprojects')
                .select('*')
                .eq('user_id', userId)
                .eq('project_id', projectId)
                .order('created_at', { ascending: false});
            
            // Проверить роль в проекте
            const role = await ProjectMemberAPI.getRole(projectId, userId);
            
            // Если владелец или не участник - только свои
            if (!role || role === 'owner') {
                return mySubprojects || [];
            }
            
            // Если участник - получить разрешенные подпроекты
            const memberId = await ProjectMemberAPI.getMemberId(projectId, userId);
            if (!memberId) return mySubprojects || [];
            
            const permissions = await MemberPermissionAPI.get(memberId);
            const allowedSubprojectIds = permissions
                .filter(p => p.resource_type === 'subproject' && p.can_view && p.resource_id !== null)
                .map(p => p.resource_id);
            
            if (allowedSubprojectIds.length === 0) {
                return mySubprojects || [];
            }
            
            // Загрузить расшаренные подпроекты
            const { data: sharedSubprojects } = await supabaseClient
                .from('subprojects')
                .select('*')
                .in('id', allowedSubprojectIds)
                .eq('project_id', projectId);
            
            const allSubprojects = [...(mySubprojects || [])];
            (sharedSubprojects || []).forEach(sp => {
                sp.isShared = true;
                allSubprojects.push(sp);
            });
            
            return allSubprojects;
            
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
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },
    
    async create(milestone) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('milestones')
            .insert([{ ...milestone, user_id: userId }])
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
        const { data } = await supabaseClient
            .from('milestones')
            .select('completed')
            .eq('id', id)
            .single();
        
        const { data: updated, error } = await supabaseClient
            .from('milestones')
            .update({ completed: !data.completed })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return updated;
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
    
    async create(note) {
        const userId = getUserId();
        const { data, error } = await supabaseClient
            .from('project_notes')
            .insert([{ ...note, user_id: userId }])
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
window.getUserId = getUserId;
window.clearPermissionCache = clearPermissionCache;

console.log('✅ Supabase API с шарингом загружен успешно');
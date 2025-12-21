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
            const { data: myProjects } = await supabaseClient
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            return myProjects || [];
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
        
        const { data, error } = await supabaseClient
            .from('subprojects')
            .select('*')
            .eq('user_id', userId)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false});
        
        if (error) throw error;
        return data || [];
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
        const { data, error } = await supabaseClient
            .from('custom_fields')
            .select('*')
            .eq('subproject_id', subprojectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
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
        const { data, error } = await supabaseClient
            .from('sp_tables')
            .select('*')
            .eq('subproject_id', subprojectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
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
        const { data, error } = await supabaseClient
            .from('sp_table_rows')
            .select('*')
            .eq('table_id', tableId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
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
        const { data, error } = await supabaseClient
            .from('subproject_notes')
            .select('*')
            .eq('subproject_id', subprojectId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
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

// ========== API УЧАСТНИКОВ (УПРОЩЕННЫЙ) ==========
// ========== API УЧАСТНИКОВ ПРОЕКТА (ПОЛНЫЙ) ==========
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
            const role = await ProjectMemberAPI.getRole(projectId, userId);
            
            if (role === 'owner') {
                return true;
            }
            
            if (!role) {
                return false;
            }
            
            const memberId = await ProjectMemberAPI.getMemberId(projectId, userId);
            if (!memberId) {
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
                    return needEdit ? specific.can_edit : specific.can_view;
                }
            }
            
            const { data: general } = await query.is('resource_id', null).single();
            if (general) {
                return needEdit ? general.can_edit : general.can_view;
            }
            
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

console.log('✅ Supabase API загружен успешно');
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
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
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
        
        // Получить свои проекты
        const { data: myProjects, error: myError } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (myError) throw myError;
        
        // Получить расшаренные проекты
        const sharedProjectIds = await ProjectShareAPI.getSharedProjects();
        
        if (sharedProjectIds.length === 0) {
            return myProjects || [];
        }
        
        const { data: sharedProjects, error: sharedError } = await supabase
            .from('projects')
            .select('*')
            .in('id', sharedProjectIds.map(s => s.project_id));
        
        if (sharedError) throw sharedError;
        
        // Объединить и пометить расшаренные
        const allProjects = [...(myProjects || [])];
        (sharedProjects || []).forEach(sp => {
            sp.isShared = true; // Пометка что проект расшарен
            allProjects.push(sp);
        });
        
        return allProjects;
    },
    
    // Остальные методы без изменений...
    async create(project) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('projects')
            .insert([{ ...project, user_id: userId }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
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
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
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
        const { data, error } = await supabase
            .from('subprojects')
            .select('*')
            .eq('user_id', userId)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
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
        const { data, error } = await supabase
            .from('milestones')
            .select('*')
            .eq('user_id', userId)
            .eq('project_id', projectId)
            .order('start_date', { ascending: true });
        
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
    }
};

// API для кастомных полей
const CustomFieldAPI = {
    async getAll(subprojectId) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('custom_fields')
            .select('*')
            .eq('user_id', userId)
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
        const { data, error } = await supabase
            .from('sp_tables')
            .select('*')
            .eq('user_id', userId)
            .eq('subproject_id', subprojectId);
        
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

    // Строки таблицы
    async getRows(tableId) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('sp_table_rows')
            .select('*')
            .eq('user_id', userId)
            .eq('table_id', tableId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    async createRow(tableId, rowData) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('sp_table_rows')
            .insert([{ table_id: tableId, row_data: rowData, user_id: userId }])
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
        const { data, error } = await supabase
            .from('subproject_notes')
            .select('*')
            .eq('user_id', userId)
            .eq('subproject_id', subprojectId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async create(subprojectId, content) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('subproject_notes')
            .insert([{ subproject_id: subprojectId, content, user_id: userId }])
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
        const { data, error } = await supabase
            .from('project_notes')
            .select('*')
            .eq('user_id', userId)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async create(projectId, title, content) {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('project_notes')
            .insert([{ project_id: projectId, title, content, user_id: userId }])
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



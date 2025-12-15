from django.contrib import admin
from .models import TelegramUser, Project, Task, Note, Milestone, Document, Sprint

@admin.register(TelegramUser)
class TelegramUserAdmin(admin.ModelAdmin):
    list_display = ['telegram_id', 'first_name', 'username', 'created_at']
    search_fields = ['telegram_id', 'first_name', 'username']
    list_filter = ['created_at']
    readonly_fields = ['created_at']

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'color', 'icon', 'archived', 'created_at']
    list_filter = ['archived', 'created_at']
    search_fields = ['name', 'user__first_name']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'parent', 'order', 'completed', 'start_date', 'end_date']
    list_filter = ['completed', 'start_date']
    search_fields = ['name', 'project__name']
    readonly_fields = ['created_at']

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'project', 'milestone', 'priority', 'deadline', 'completed', 'created_at']
    list_filter = ['priority', 'completed', 'created_at', 'deadline']
    search_fields = ['title', 'description', 'user__first_name']
    readonly_fields = ['created_at', 'updated_at']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user', 'project', 'milestone')

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'milestone', 'doc_type', 'created_at']
    list_filter = ['doc_type', 'created_at']
    search_fields = ['title', 'project__name']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'start_date', 'end_date', 'completed']
    list_filter = ['completed', 'start_date']
    search_fields = ['name', 'project__name']
    readonly_fields = ['created_at']

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'created_at']
    list_filter = ['created_at']
    search_fields = ['title', 'content', 'user__first_name']
    readonly_fields = ['created_at', 'updated_at']



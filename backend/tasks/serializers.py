from rest_framework import serializers
from .models import Task, Project, Note, Milestone, Document, Sprint, SubProjectTable, SubProjectNote, SubProject

class MilestoneSerializer(serializers.ModelSerializer):
    progress = serializers.ReadOnlyField()
    tasks_count = serializers.SerializerMethodField()
    sub_milestones = serializers.SerializerMethodField()
    
    class Meta:
        model = Milestone
        fields = ['id', 'name', 'description', 'order', 'start_date', 'end_date', 
                  'completed', 'progress', 'tasks_count', 'parent', 'sub_milestones', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_tasks_count(self, obj):
        return obj.tasks.count()
    
    def get_sub_milestones(self, obj):
        # Вложенные этапы (один уровень)
        sub = obj.sub_milestones.all()
        return MilestoneSerializer(sub, many=True).data


class ProjectSerializer(serializers.ModelSerializer):
    tasks_count = serializers.SerializerMethodField()
    milestones_count = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'color', 'icon', 'archived', 
                  'tasks_count', 'milestones_count', 'documents_count', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_tasks_count(self, obj):
        return obj.tasks.filter(completed=False).count()
    
    def get_milestones_count(self, obj):
        return obj.milestones.count()
    
    def get_documents_count(self, obj):
        return obj.documents.count()


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Полная информация о проекте для workspace"""
    milestones = MilestoneSerializer(many=True, read_only=True)
    tasks_count = serializers.SerializerMethodField()
    completed_tasks_count = serializers.SerializerMethodField()  # ← УЖЕ ЕСТЬ
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'color', 'icon', 'archived',
                  'milestones', 'tasks_count', 'completed_tasks_count',  # ← ПРОВЕРЬТЕ ЭТО ПОЛЕ
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_tasks_count(self, obj):
        return obj.tasks.count()
    
    def get_completed_tasks_count(self, obj):  # ← ДОБАВЬТЕ ЭТОТ МЕТОД ЕСЛИ ЕГО НЕТ
        return obj.tasks.filter(completed=True).count()


class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    milestone_name = serializers.CharField(source='milestone.name', read_only=True)
    subproject_name = serializers.CharField(source='subproject.name', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'priority', 'status', 'deadline', 'completed',
                  'order', 'project', 'project_name', 'milestone', 'milestone_name', 
                  'subproject', 'subproject_name',
                  'is_overdue', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        # user НЕ включён в fields, передаётся через save(user=...)
    
    def get_is_overdue(self, obj):
        if not obj.deadline or obj.completed:
            return False
        from django.utils import timezone
        return timezone.now() > obj.deadline
class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'project', 'milestone', 'title', 'doc_type', 'content', 
                  'order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SprintSerializer(serializers.ModelSerializer):
    tasks_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Sprint
        fields = ['id', 'project', 'name', 'goal', 'start_date', 'end_date', 
                  'completed', 'tasks_count', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_tasks_count(self, obj):
        # Задачи связаны через milestone, пока просто 0
        return 0


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'title', 'content', 'tags', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


        

class SubProjectNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubProjectNote
        fields = ['id', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class SubProjectTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubProjectTable
        fields = ['id', 'name', 'columns', 'rows', 'order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SubProjectSerializer(serializers.ModelSerializer):
    tasks_count = serializers.IntegerField(read_only=True)
    active_tasks_count = serializers.IntegerField(read_only=True)
    notes = SubProjectNoteSerializer(many=True, read_only=True)
    tables = SubProjectTableSerializer(many=True, read_only=True)
    
    class Meta:
        model = SubProject
        fields = ['id', 'name', 'description', 'icon', 'color', 'custom_fields',
                  'order', 'tasks_count', 'active_tasks_count', 'notes', 'tables',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        # project НЕ включен в fields, он передаётся через save(project=...)
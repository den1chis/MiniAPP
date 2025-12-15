from django.db import models

class TelegramUser(models.Model):
    telegram_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=255, blank=True)
    first_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.first_name} ({self.telegram_id})"
    
    class Meta:
        verbose_name = 'Пользователь Telegram'
        verbose_name_plural = 'Пользователи Telegram'


class Project(models.Model):
    user = models.ForeignKey(TelegramUser, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default='#3B82F6')
    icon = models.CharField(max_length=10, default='📁')
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Проект'
        verbose_name_plural = 'Проекты'
    
    def __str__(self):
        return f"{self.icon} {self.name}"


class Milestone(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, related_name='sub_milestones', null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'Этап (Milestone)'
        verbose_name_plural = 'Этапы (Milestones)'
    
    def __str__(self):
        return self.name
    
    @property
    def progress(self):
        """Прогресс выполнения этапа в процентах"""
        tasks = self.tasks.all()
        if not tasks:
            return 0
        completed = tasks.filter(completed=True).count()
        return int((completed / tasks.count()) * 100)


class Document(models.Model):
    DOCUMENT_TYPES = [
        ('text', 'Текст'),
        ('checklist', 'Чек-лист'),
        ('table', 'Таблица'),
    ]
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='documents')
    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name='documents', null=True, blank=True)
    title = models.CharField(max_length=255)
    doc_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES, default='text')
    content = models.JSONField(default=dict)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'Документ'
        verbose_name_plural = 'Документы'
    
    def __str__(self):
        return self.title


class Sprint(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='sprints')
    name = models.CharField(max_length=255)
    goal = models.TextField(blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-start_date']
        verbose_name = 'Спринт'
        verbose_name_plural = 'Спринты'
    
    def __str__(self):
        return f"{self.name} ({self.start_date} - {self.end_date})"


class Note(models.Model):
    user = models.ForeignKey(TelegramUser, on_delete=models.CASCADE, related_name='notes')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='notes', null=True, blank=True)  # ← ДОБАВЛЕНО
    title = models.CharField(max_length=255)
    content = models.TextField()
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Заметка'
        verbose_name_plural = 'Заметки'
    
    def __str__(self):
        return self.title
    
class SubProject(models.Model):
    """Подпроект"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='subprojects')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=10, default='📁')
    color = models.CharField(max_length=7, default='#3B82F6')
    
    # Кастомные поля данных
    custom_fields = models.JSONField(default=list, blank=True)
    
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name
    
    @property
    def tasks_count(self):
        return self.tasks.count()
    
    @property
    def active_tasks_count(self):
        return self.tasks.filter(completed=False).count()


class Task(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Низкий'),
        ('medium', 'Средний'),
        ('high', 'Высокий'),
    ]
    
    STATUS_CHOICES = [
        ('todo', 'К выполнению'),
        ('in_progress', 'В работе'),
        ('done', 'Завершено'),
    ]
    
    user = models.ForeignKey(TelegramUser, on_delete=models.CASCADE, related_name='tasks')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    subproject = models.ForeignKey(SubProject, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='todo')
    deadline = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', '-created_at']
    
    def __str__(self):
        return self.title
    
    @property
    def is_overdue(self):
        if not self.deadline or self.completed:
            return False
        from django.utils import timezone
        return timezone.now() > self.deadline


class SubProjectNote(models.Model):
    """Заметки к подпроекту"""
    subproject = models.ForeignKey(SubProject, on_delete=models.CASCADE, related_name='notes')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']


class SubProjectTable(models.Model):
    """Таблица в подпроекте"""
    subproject = models.ForeignKey(SubProject, on_delete=models.CASCADE, related_name='tables')
    name = models.CharField(max_length=200)
    columns = models.JSONField(default=list)
    rows = models.JSONField(default=list)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', 'name']
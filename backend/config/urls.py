from django.contrib import admin
from django.urls import path
from tasks import views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Глобальный поиск
    path('api/search/', views.global_search, name='global-search'),
    path('api/dashboard/', views.dashboard_stats, name='dashboard-stats'),

    
    # Проекты
    path('api/projects/', views.project_list, name='project-list'),
    path('api/projects/<int:pk>/', views.project_detail, name='project-detail'),
    
    # Подпроекты
    path('api/projects/<int:project_id>/subprojects/', views.subproject_list, name='subproject-list'),
    path('api/subprojects/<int:pk>/', views.subproject_detail, name='subproject-detail'),
    
    # Заметки подпроектов
    path('api/subprojects/<int:subproject_id>/notes/', views.subproject_note_create, name='subproject-note-create'),
    path('api/subproject-notes/<int:pk>/', views.subproject_note_delete, name='subproject-note-delete'),
    
    # Таблицы подпроектов
    path('api/subprojects/<int:subproject_id>/tables/', views.subproject_table_list, name='subproject-table-list'),
    path('api/tables/<int:pk>/', views.subproject_table_detail, name='subproject-table-detail'),
    

    # Milestones (этапы)
    path('api/projects/<int:project_id>/milestones/', views.milestone_list, name='milestone-list'),
    path('api/milestones/<int:pk>/', views.milestone_detail, name='milestone-detail'),
    
    # Документы
    path('api/projects/<int:project_id>/notes/', views.project_note_list, name='project-note-list'),
    path('api/project-notes/<int:pk>/', views.project_note_delete, name='project-note-delete'),
    # Задачи
    path('api/tasks/', views.task_list, name='task-list'),
    path('api/tasks/<int:pk>/', views.task_detail, name='task-detail'),
    
    # Заметки
    path('api/notes/', views.note_list, name='note-list'),
    path('api/notes/<int:pk>/', views.note_detail, name='note-detail'),
]
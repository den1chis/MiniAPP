from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db import models
from django.utils import timezone
import hmac
import hashlib
import json
from urllib.parse import parse_qs

from .models import (
    TelegramUser, Project, Milestone, Task, Document, Sprint, Note,
    SubProject, SubProjectNote, SubProjectTable
)
from .serializers import (
    ProjectSerializer, MilestoneSerializer, TaskSerializer, 
    DocumentSerializer, NoteSerializer,
    SubProjectSerializer, SubProjectNoteSerializer, SubProjectTableSerializer
)


def get_user_from_request(request):
    """Получить пользователя из Telegram init data"""
    init_data = request.headers.get('X-Telegram-Init-Data')
    
    if not init_data:
        return None
    
    try:
        params = dict(parse_qs(init_data))
        user_data = params.get('user', [None])[0]
        if not user_data:
            return None
        
        user_info = json.loads(user_data)
        telegram_id = user_info.get('id')
        if not telegram_id:
            return None
        
        user, created = TelegramUser.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                'username': user_info.get('username', ''),
                'first_name': user_info.get('first_name', ''),
                'last_name': user_info.get('last_name', ''),
            }
        )
        
        return user
    except Exception as e:
        print(f"Ошибка авторизации: {e}")
        return None


# ========== ПРОЕКТЫ ==========

@api_view(['GET', 'POST'])
def project_list(request):
    """Список проектов"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if request.method == 'GET':
        projects = Project.objects.filter(user=user)
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = ProjectSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def project_detail(request, pk):
    """Детали проекта"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        project = Project.objects.get(id=pk, user=user)
    except Project.DoesNotExist:
        return Response({'error': 'Проект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = ProjectSerializer(project)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = ProjectSerializer(project, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ========== ЗАДАЧИ ==========

@api_view(['GET', 'POST'])
def task_list(request):
    """Список задач"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if request.method == 'GET':
        tasks = Task.objects.filter(user=user)
        
        project_id = request.query_params.get('project')
        milestone_id = request.query_params.get('milestone')
        subproject_id = request.query_params.get('subproject')
        priority = request.query_params.get('priority')
        completed = request.query_params.get('completed')
        
        if project_id:
            tasks = tasks.filter(project_id=project_id)
        if milestone_id:
            tasks = tasks.filter(milestone_id=milestone_id)
        if subproject_id:
            tasks = tasks.filter(subproject_id=subproject_id)
        if priority:
            tasks = tasks.filter(priority=priority)
        if completed is not None:
            tasks = tasks.filter(completed=completed.lower() == 'true')
        
        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def task_detail(request, pk):
    """Детали задачи"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        task = Task.objects.get(id=pk, user=user)
    except Task.DoesNotExist:
        return Response({'error': 'Задача не найдена'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = TaskSerializer(task)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = TaskSerializer(task, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ========== MILESTONES ==========

@api_view(['GET', 'POST'])
def milestone_list(request, project_id):
    """Список этапов"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        project = Project.objects.get(id=project_id, user=user)
    except Project.DoesNotExist:
        return Response({'error': 'Проект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        milestones = Milestone.objects.filter(project=project)
        serializer = MilestoneSerializer(milestones, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = MilestoneSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project=project)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def milestone_detail(request, pk):
    """Детали этапа"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        milestone = Milestone.objects.get(id=pk, project__user=user)
    except Milestone.DoesNotExist:
        return Response({'error': 'Этап не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = MilestoneSerializer(milestone)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = MilestoneSerializer(milestone, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        milestone.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ========== ДОКУМЕНТЫ ==========

@api_view(['GET', 'POST'])
def document_list(request, project_id):
    """Список документов"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        project = Project.objects.get(id=project_id, user=user)
    except Project.DoesNotExist:
        return Response({'error': 'Проект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        documents = Document.objects.filter(project=project)
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = DocumentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def document_detail(request, pk):
    """Детали документа"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        document = Document.objects.get(id=pk, project__user=user)
    except Document.DoesNotExist:
        return Response({'error': 'Документ не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = DocumentSerializer(document)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = DocumentSerializer(document, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ========== ЗАМЕТКИ ==========

@api_view(['GET', 'POST'])
def note_list(request):
    """Список заметок"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if request.method == 'GET':
        notes = Note.objects.filter(user=user)
        serializer = NoteSerializer(notes, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = NoteSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def note_detail(request, pk):
    """Детали заметки"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        note = Note.objects.get(id=pk, user=user)
    except Note.DoesNotExist:
        return Response({'error': 'Заметка не найдена'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = NoteSerializer(note)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = NoteSerializer(note, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ========== ПОДПРОЕКТЫ ==========

@api_view(['GET', 'POST'])
def subproject_list(request, project_id):
    """Список подпроектов"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        project = Project.objects.get(id=project_id, user=user)
    except Project.DoesNotExist:
        return Response({'error': 'Проект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        subprojects = SubProject.objects.filter(project=project)
        serializer = SubProjectSerializer(subprojects, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = SubProjectSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project=project)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def subproject_detail(request, pk):
    """Детали подпроекта"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        subproject = SubProject.objects.get(id=pk, project__user=user)
    except SubProject.DoesNotExist:
        return Response({'error': 'Подпроект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = SubProjectSerializer(subproject)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = SubProjectSerializer(subproject, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        subproject.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
def subproject_note_create(request, subproject_id):
    """Добавить заметку"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        subproject = SubProject.objects.get(id=subproject_id, project__user=user)
    except SubProject.DoesNotExist:
        return Response({'error': 'Подпроект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = SubProjectNoteSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(subproject=subproject)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def subproject_note_delete(request, pk):
    """Удалить заметку"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        note = SubProjectNote.objects.get(id=pk, subproject__project__user=user)
    except SubProjectNote.DoesNotExist:
        return Response({'error': 'Заметка не найдена'}, status=status.HTTP_404_NOT_FOUND)
    
    note.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
def subproject_table_list(request, subproject_id):
    """Таблицы подпроекта"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        subproject = SubProject.objects.get(id=subproject_id, project__user=user)
    except SubProject.DoesNotExist:
        return Response({'error': 'Подпроект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        tables = SubProjectTable.objects.filter(subproject=subproject)
        serializer = SubProjectTableSerializer(tables, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = SubProjectTableSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(subproject=subproject)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
def subproject_table_detail(request, pk):
    """Детали таблицы"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        table = SubProjectTable.objects.get(id=pk, subproject__project__user=user)
    except SubProjectTable.DoesNotExist:
        return Response({'error': 'Таблица не найдена'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = SubProjectTableSerializer(table)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = SubProjectTableSerializer(table, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        table.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ========== ПОИСК ==========

@api_view(['GET'])
def global_search(request):
    """Глобальный поиск"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    query = request.query_params.get('q', '').strip()
    if not query or len(query) < 2:
        return Response({
            'tasks': [],
            'projects': [],
            'notes': [],
            'milestones': []
        })
    
    tasks = Task.objects.filter(user=user, title__icontains=query)[:10]
    projects = Project.objects.filter(user=user, name__icontains=query)[:10]
    notes = Note.objects.filter(user=user).filter(
        models.Q(title__icontains=query) | models.Q(content__icontains=query)
    )[:10]
    milestones = Milestone.objects.filter(project__user=user, name__icontains=query)[:10]
    
    return Response({
        'tasks': TaskSerializer(tasks, many=True).data,
        'projects': ProjectSerializer(projects, many=True).data,
        'notes': NoteSerializer(notes, many=True).data,
        'milestones': [{
            'id': m.id,
            'name': m.name,
            'project_id': m.project.id,
            'project_name': m.project.name
        } for m in milestones]
    })


# ========== СТАТИСТИКА ==========

@api_view(['GET'])
def dashboard_stats(request):
    """Статистика для дашборда"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    tasks = Task.objects.filter(user=user)
    
    total_tasks = tasks.count()
    completed_tasks = tasks.filter(completed=True).count()
    active_tasks = tasks.filter(completed=False).count()
    completion_rate = round((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
    
    from datetime import timedelta
    today = timezone.now().date()
    week_ago = today - timedelta(days=6)
    
    tasks_by_day = []
    for i in range(7):
        date = week_ago + timedelta(days=i)
        count = tasks.filter(
            completed=True,
            updated_at__date=date
        ).count()
        
        tasks_by_day.append({
            'date': date.strftime('%d.%m'),
            'count': count
        })
    
    priority_stats = {
        'high': tasks.filter(priority='high', completed=False).count(),
        'medium': tasks.filter(priority='medium', completed=False).count(),
        'low': tasks.filter(priority='low', completed=False).count(),
    }
    
    overdue_tasks = tasks.filter(
        deadline__lt=timezone.now(),
        completed=False
    ).count()
    
    week_later = today + timedelta(days=7)
    week_tasks = tasks.filter(
        deadline__date__lte=week_later,
        deadline__date__gte=today,
        completed=False
    ).count()
    
    active_projects = Project.objects.filter(user=user).count()
    
    return Response({
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'active_tasks': active_tasks,
        'completion_rate': completion_rate,
        'tasks_by_day': tasks_by_day,
        'priority_stats': priority_stats,
        'overdue_tasks': overdue_tasks,
        'week_tasks': week_tasks,
        'active_projects': active_projects,
    })


@api_view(['GET', 'POST'])
def project_note_list(request, project_id):
    """Список/создание заметок проекта"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        project = Project.objects.get(id=project_id, user=user)
    except Project.DoesNotExist:
        return Response({'error': 'Проект не найден'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        # Получаем заметки связанные с проектом напрямую через ForeignKey
        notes = Note.objects.filter(user=user, project=project)
        serializer = NoteSerializer(notes, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = NoteSerializer(data=request.data)
        if serializer.is_valid():
            # Сохраняем с привязкой к проекту
            serializer.save(user=user, project=project)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def project_note_delete(request, pk):
    """Удаление заметки проекта"""
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Неверные данные авторизации'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        note = Note.objects.get(id=pk, user=user)
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Note.DoesNotExist:
        return Response({'error': 'Заметка не найдена'}, status=status.HTTP_404_NOT_FOUND)
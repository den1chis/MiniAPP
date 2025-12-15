# Планировщик задач - Telegram Mini App

Простой планировщик задач, работающий как Telegram Mini App.

## Запуск локально

1. Активируйте виртуальное окружение:
```
.\venv\Scripts\Activate.ps1
```

2. Запустите backend:
```
cd backend
python manage.py runserver
```

3. В новом терминале запустите frontend:
```
cd frontend
python -m http.server 8001
```

4. Откройте http://localhost:8001

## Структура

- `backend/` - Django REST API
- `frontend/` - Telegram Mini App (HTML/JS)
- `venv/` - виртуальное окружение Python
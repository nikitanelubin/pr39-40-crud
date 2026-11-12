# Практическая работа №39-40. CRUD-операции в Express.js

Работа выполнена на базе данных `scholarships_db` из практической работы №38.

## Запуск

1. Запустить MySQL в Open Server (база `scholarships_db` из практической работы №38)
2. Скопировать `.env.example` в `.env`
3. `npm install`
4. `node index.js`

Сервер: http://localhost:3002

Все запросы для Postman с описаниями: `ПР39-40.postman_collection.json` (Postman -> Import).

## Маршруты

| Метод | Адрес | Описание |
|-------|-------|----------|
| GET | /scholarships?type= | список стипендий с фильтром по типу |
| GET | /scholarships/:id | стипендия по ID |
| POST | /scholarships | создание |
| PUT | /scholarships/:id | обновление |
| DELETE | /scholarships/:id | удаление |

Для фронтенда из практической работы №41-42 есть маршруты студентов: `GET /students`, `POST /students`, `PUT /students/:id`, `DELETE /students/:id`.

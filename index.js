require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// фронтенд работает на другом порту, без CORS браузер заблокирует его запросы
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'scholarships_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // без этих настроек DATE пришла бы объектом Date со сдвигом часового пояса
  // (2026-08-31T19:00:00.000Z), а DECIMAL - строкой '3500.00'. С ними: '2026-09-01' и 3500
  dateStrings: true,
  decimalNumbers: true,
});

// id из адреса приходит строкой, поэтому в маршрутах сначала Number(req.params.id):
// '5' -> 5, 'abc' -> NaN. Подходит только целое число больше нуля: NaN, 1.5 и -1 не пройдут
const isValidId = (id) => Number.isInteger(id) && id > 0;

// ===== Стипендии =====

app.get('/scholarships', async (req, res) => {
  // /scholarships?type=Социальная -> type = 'Социальная', без параметра type = undefined
  const { type } = req.query;
  // JOIN добавляет к каждой стипендии ФИО студента из таблицы students
  let sql = `SELECT sc.*, s.full_name
             FROM scholarships sc
             JOIN students s ON s.id = sc.student_id`;
  const params = [];
  // WHERE дописываем, только если фильтр передан. В SQL пишем ?, а значение кладём отдельно в params:
  // драйвер сам подставит его в кавычках и экранирует, поэтому SQL-инъекция невозможна
  if (type) {
    sql += ' WHERE sc.type = ?';
    params.push(type);
  }
  // в SQL ORDER BY всегда стоит после WHERE, поэтому он дописывается последним
  sql += ' ORDER BY sc.id';
  try {
    // query возвращает [строки, описание колонок]; [rows] забирает только строки - массив объектов
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scholarships' });
  }
});

app.get('/scholarships/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!isValidId(id)) {
    // return останавливает функцию: дальше код не пойдёт в базу и не отправит второй ответ
    return res.status(400).json({ error: 'Invalid ID' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM scholarships WHERE id = ?', [id]);
    // SELECT всегда возвращает массив, даже для одной записи: пустой массив значит, что записи нет
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Scholarship not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scholarship' });
  }
});

// Проверка данных для POST и PUT. Возвращает текст ошибки или null, если всё правильно.
// В скобках сразу достаём поля из req.body. = {} нужен, если тело запроса не прислали совсем:
// тогда req.body = undefined, а из undefined поля не достать
const validateScholarship = ({ student_id, type, amount, start_date, end_date } = {}) => {
  if (!isValidId(student_id)) return 'student_id must be a positive integer';
  if (typeof type !== 'string' || type.trim() === '') return 'type is required';
  if (typeof amount !== 'number' || amount <= 0) return 'amount must be a positive number';
  // шаблон даты: 4 цифры, дефис, 2 цифры, дефис, 2 цифры, например 2026-09-01
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormat.test(start_date)) return 'start_date must be in YYYY-MM-DD format';
  if (!dateFormat.test(end_date)) return 'end_date must be in YYYY-MM-DD format';
  return null;
};

app.post('/scholarships', async (req, res) => {
  // req.body уже объект: JSON из тела запроса разобрал app.use(express.json())
  const error = validateScholarship(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { student_id, type, amount, start_date, end_date } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO scholarships (student_id, type, amount, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [student_id, type.trim(), amount, start_date, end_date]
    );
    // INSERT возвращает не запись, а сводку: result.insertId - id, который база выдала новой строке.
    // По нему читаем созданную запись и возвращаем её клиенту
    const [rows] = await pool.query('SELECT * FROM scholarships WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    // сюда попадём и при несуществующем student_id: внешний ключ не даст базе сохранить такую запись
    res.status(500).json({ error: 'Failed to create scholarship' });
  }
});

app.put('/scholarships/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const error = validateScholarship(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { student_id, type, amount, start_date, end_date } = req.body;
  try {
    // PUT - полная замена: обновляем все поля записи
    const [result] = await pool.query(
      'UPDATE scholarships SET student_id = ?, type = ?, amount = ?, start_date = ?, end_date = ? WHERE id = ?',
      [student_id, type.trim(), amount, start_date, end_date, id]
    );
    // affectedRows - сколько строк нашлось по WHERE id = ?. 0 значит, что записи с таким id нет
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Scholarship not found' });
    }
    const [rows] = await pool.query('SELECT * FROM scholarships WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update scholarship' });
  }
});

app.delete('/scholarships/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  try {
    const [result] = await pool.query('DELETE FROM scholarships WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Scholarship not found' });
    }
    // 204 No Content: удалено, тело ответа пустое, поэтому send(), а не json()
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete scholarship' });
  }
});

// ===== Студенты (нужны фронтенду в ПР 41-42) =====

const validateStudent = ({ full_name } = {}) => {
  if (typeof full_name !== 'string' || full_name.trim() === '') return 'full_name is required';
  return null;
};

app.get('/students', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM students ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.post('/students', async (req, res) => {
  const error = validateStudent(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  try {
    const [result] = await pool.query('INSERT INTO students (full_name) VALUES (?)', [req.body.full_name.trim()]);
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

app.put('/students/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const error = validateStudent(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  try {
    const [result] = await pool.query('UPDATE students SET full_name = ? WHERE id = ?', [req.body.full_name.trim(), id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

app.delete('/students/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  try {
    // ON DELETE CASCADE в database.sql: вместе со студентом база сама удалит его стипендии
    const [result] = await pool.query('DELETE FROM students WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

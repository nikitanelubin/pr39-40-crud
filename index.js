require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

-- База данных по варианту 7: стипендии и студенты
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE scholarships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO students (full_name) VALUES
  ('Иванов Алексей Петрович'),
  ('Смирнова Анна Сергеевна'),
  ('Кузнецов Дмитрий Андреевич'),
  ('Попова Мария Игоревна'),
  ('Соколов Артём Викторович'),
  ('Лебедева Екатерина Олеговна');

INSERT INTO scholarships (student_id, type, amount, start_date, end_date) VALUES
  (1, 'Академическая', 3500.00, '2026-09-01', '2027-01-31'),
  (1, 'Именная', 7000.00, '2026-09-01', '2027-06-30'),
  (2, 'Академическая', 3500.00, '2026-09-01', '2027-01-31'),
  (3, 'Социальная', 5200.00, '2026-09-01', '2027-06-30'),
  (4, 'Повышенная', 9000.00, '2026-09-01', '2027-01-31'),
  (5, 'Академическая', 3500.00, '2026-09-01', '2027-01-31'),
  (6, 'Социальная', 5200.00, '2026-02-01', '2026-06-30');

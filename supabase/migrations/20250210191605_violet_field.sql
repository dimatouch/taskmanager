SQL функції коректні, але враховуючи дані з скріншоту таблиці task_roles, проблема може бути в тому, що:

1. Не всі viewer-записи правильно додані в таблицю task_roles
2. Умова в функції занадто обмежувальна:
```sql
AND t.owner_id != p_user_id
AND t.responsible_id != p_user_id
AND NOT (p_user_id = ANY(t.coworkers))
```

Спростіть функцію для тестування:
```sql
CREATE OR REPLACE FUNCTION get_viewer_only_tasks(p_user_id uuid)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.*
  FROM tasks t
  JOIN task_roles tr ON tr.task_id = t.id
  WHERE tr.user_id = p_user_id
  AND tr.role = 'viewer'
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;
```

Після тестування додайте додаткові умови поступово, перевіряючи результати на кожному кроці.
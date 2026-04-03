<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$config = require __DIR__ . '/config/config.php';

try {
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']);
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    ensure_runtime_tables($pdo);
} catch (Throwable $e) {
    json_response(['message' => 'Database connection failed', 'error' => $e->getMessage()], 500);
}

$method = $_SERVER['REQUEST_METHOD'];
$uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
$baseDir = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
$path = '/' . ltrim(substr($uriPath, strlen($baseDir)), '/');
if (str_starts_with($path, '/index.php')) {
    $path = substr($path, strlen('/index.php'));
}
$path = '/' . trim($path, '/');
$segments = array_values(array_filter(explode('/', trim($path, '/'))));

if (count($segments) === 0) {
    json_response(['message' => 'PHP API is running']);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    $input = [];
}

try {
    route_request($pdo, $config, $method, $segments, $input);
} catch (HttpError $e) {
    json_response(['message' => $e->getMessage()], $e->statusCode);
} catch (Throwable $e) {
    json_response(['message' => 'Internal server error', 'error' => $e->getMessage()], 500);
}

function route_request(PDO $pdo, array $config, string $method, array $segments, array $input): void
{
    if ($segments[0] === 'auth') {
        handle_auth($pdo, $config, $method, $segments, $input);
        return;
    }

    if ($segments[0] === 'health') {
        json_response(['status' => 'ok', 'timestamp' => date(DATE_ATOM)]);
    }

    $user = require_auth_user($pdo);
    $isAdmin = (($user['role'] ?? '') === 'ADMIN');

    switch ($segments[0]) {
        case 'students':
            if (!$isAdmin) {
                throw new HttpError('Forbidden', 403);
            }
            handle_students($pdo, $method, $segments, $input);
            return;
        case 'companies':
            if (!$isAdmin) {
                throw new HttpError('Forbidden', 403);
            }
            handle_companies($pdo, $method, $segments, $input);
            return;
        case 'universities':
            if (!$isAdmin) {
                throw new HttpError('Forbidden', 403);
            }
            handle_universities($pdo, $method, $segments, $input);
            return;
        case 'jobs':
            if ($method !== 'GET' && !$isAdmin && (($user['role'] ?? '') !== 'COMPANY')) {
                throw new HttpError('Forbidden', 403);
            }
            handle_jobs($pdo, $method, $segments, $input, $user, $isAdmin);
            return;
        case 'skills':
            if (!$isAdmin) {
                throw new HttpError('Forbidden', 403);
            }
            handle_skills($pdo, $method, $segments, $input);
            return;
        case 'applications':
            if (!in_array(($user['role'] ?? ''), ['ADMIN', 'STUDENT', 'COMPANY'], true)) {
                throw new HttpError('Forbidden', 403);
            }
            handle_applications($pdo, $method, $segments, $input, $user, $isAdmin);
            return;
        case 'dashboard':
            json_response(['user' => $user, 'stats' => dashboard_stats($pdo)]);
            return;
        default:
        case 'profile':
            handle_profile($pdo, $method, $segments, $input, $user);
            return;
        default:
            throw new HttpError('Not found', 404);
    }
}

function handle_auth(PDO $pdo, array $config, string $method, array $segments, array $input): void
{
    $action = $segments[1] ?? '';

    if ($action === 'register' && $method === 'POST') {
        $fullName = trim((string)($input['fullName'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        $role = strtoupper(trim((string)($input['role'] ?? 'STUDENT')));

        if ($fullName === '' || $email === '' || strlen($password) < 8) {
            throw new HttpError('بيانات التسجيل غير مكتملة', 422);
        }

        if (!in_array($role, ['ADMIN', 'STUDENT', 'COMPANY', 'UNIVERSITY'], true)) {
            throw new HttpError('نوع الحساب غير صالح', 422);
        }

        $exists = query_one($pdo, 'SELECT id FROM users WHERE email = ?', [$email]);
        if ($exists) {
            throw new HttpError('البريد الإلكتروني مستخدم بالفعل', 409);
        }

        $pdo->beginTransaction();
        try {
            exec_stmt($pdo, 'INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)', [
                $fullName,
                $email,
                password_hash($password, PASSWORD_BCRYPT),
                $role,
                $role === 'ADMIN' ? 'ACTIVE' : 'PENDING'
            ]);
            $userId = (int)$pdo->lastInsertId();

            if ($role === 'COMPANY') {
                $name = trim((string)($input['companyName'] ?? 'Company'));
                exec_stmt($pdo, 'INSERT INTO companies (user_id, name, industry, status) VALUES (?, ?, ?, ?)', [$userId, $name, 'General', 'PENDING']);
            } elseif ($role === 'UNIVERSITY') {
                $name = trim((string)($input['universityName'] ?? 'University'));
                exec_stmt($pdo, 'INSERT INTO universities (user_id, name, location, status) VALUES (?, ?, ?, ?)', [$userId, $name, 'Unknown', 'PENDING']);
            } elseif ($role === 'STUDENT') {
                exec_stmt($pdo, 'INSERT INTO students (user_id, bio, status) VALUES (?, ?, ?)', [$userId, null, 'PENDING']);
            }

            $tokens = issue_tokens($pdo, $config, $userId);
            $pdo->commit();

            $user = query_one($pdo, 'SELECT id, full_name, email, role, status FROM users WHERE id = ?', [$userId]);
            json_response([
                'accessToken' => $tokens['accessToken'],
                'refreshToken' => $tokens['refreshToken'],
                'user' => map_user($user)
            ], 201);
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    if ($action === 'login' && $method === 'POST') {
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');

        $user = query_one($pdo, 'SELECT id, full_name, email, role, status, password_hash FROM users WHERE email = ?', [$email]);
        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            throw new HttpError('بيانات الدخول غير صحيحة', 401);
        }

        $tokens = issue_tokens($pdo, $config, (int)$user['id']);
        json_response([
            'accessToken' => $tokens['accessToken'],
            'refreshToken' => $tokens['refreshToken'],
            'user' => map_user($user)
        ]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $auth = get_bearer_token();
        if ($auth) {
            exec_stmt($pdo, 'DELETE FROM auth_tokens WHERE access_token = ?', [$auth]);
        }
        json_response(['message' => 'Logged out']);
    }

    throw new HttpError('Not found', 404);
}

function handle_students(PDO $pdo, string $method, array $segments, array $input): void
{
    if ($method === 'POST' && count($segments) === 1) {
        $fullName = trim((string)($input['fullName'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? 'Aa123456');
        $bio = trim((string)($input['bio'] ?? ''));
        $universityId = isset($input['universityId']) ? (int)$input['universityId'] : null;

        if ($fullName === '' || $email === '') {
            throw new HttpError('بيانات الطالب غير مكتملة', 422);
        }

        if (query_one($pdo, 'SELECT id FROM users WHERE email = ?', [$email])) {
            throw new HttpError('البريد الإلكتروني مستخدم بالفعل', 409);
        }

        $pdo->beginTransaction();
        try {
            exec_stmt($pdo, 'INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)', [
                $fullName,
                $email,
                password_hash($password, PASSWORD_BCRYPT),
                'STUDENT',
                'ACTIVE'
            ]);
            $userId = (int)$pdo->lastInsertId();
            exec_stmt($pdo, 'INSERT INTO students (user_id, university_id, bio, status) VALUES (?, ?, ?, ?)', [
                $userId,
                $universityId,
                $bio !== '' ? $bio : null,
                'ACTIVE'
            ]);
            $pdo->commit();
            json_response(['message' => 'Created'], 201);
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    if ($method === 'GET' && count($segments) === 2) {
        $id = (int)$segments[1];
        $row = query_one($pdo, 'SELECT s.id, s.status, s.bio,
                                       u.id AS user_id, u.full_name, u.email,
                                       un.id AS university_id, un.name AS university_name
                                FROM students s
                                JOIN users u ON u.id = s.user_id
                                LEFT JOIN universities un ON un.id = s.university_id
                                WHERE s.id = ?', [$id]);
        if (!$row) {
            throw new HttpError('Not found', 404);
        }
        $skills = query_all($pdo, 'SELECT sk.id, sk.name FROM student_skills ss JOIN skills sk ON sk.id = ss.skill_id WHERE ss.student_id = ?', [$id]);
        json_response([
            'id' => (string)$row['id'],
            'status' => $row['status'],
            'bio' => $row['bio'],
            'user' => ['id' => (string)$row['user_id'], 'fullName' => $row['full_name'], 'email' => $row['email']],
            'university' => $row['university_id'] ? ['id' => (string)$row['university_id'], 'name' => $row['university_name']] : null,
            'skills' => array_map(static fn($s) => ['skill' => ['id' => (string)$s['id'], 'name' => $s['name']]], $skills)
        ]);
    }

    if ($method === 'GET' && count($segments) === 1) {
        [$limit, $offset, $page] = pagination();
        $q = trim((string)($_GET['q'] ?? ''));
        $like = '%' . $q . '%';

        $countSql = 'SELECT COUNT(*) AS c
                     FROM students s
                     JOIN users u ON u.id = s.user_id
                     LEFT JOIN universities un ON un.id = s.university_id
                     WHERE (? = "" OR u.full_name LIKE ? OR u.email LIKE ? OR COALESCE(s.bio, "") LIKE ? OR COALESCE(un.name, "") LIKE ?)';
        $total = (int)query_one($pdo, $countSql, [$q, $like, $like, $like, $like])['c'];

        $sql = 'SELECT s.id, s.status, s.bio,
                       u.id AS user_id, u.full_name, u.email,
                       un.id AS university_id, un.name AS university_name
                FROM students s
                JOIN users u ON u.id = s.user_id
                LEFT JOIN universities un ON un.id = s.university_id
                WHERE (? = "" OR u.full_name LIKE ? OR u.email LIKE ? OR COALESCE(s.bio, "") LIKE ? OR COALESCE(un.name, "") LIKE ?)
                ORDER BY s.id DESC
            LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset;
        $rows = query_all($pdo, $sql, [$q, $like, $like, $like, $like]);

        $items = [];
        foreach ($rows as $row) {
            $skills = query_all($pdo, 'SELECT sk.id, sk.name FROM student_skills ss JOIN skills sk ON sk.id = ss.skill_id WHERE ss.student_id = ?', [(int)$row['id']]);
            $items[] = [
                'id' => (string)$row['id'],
                'status' => $row['status'],
                'bio' => $row['bio'],
                'user' => [
                    'id' => (string)$row['user_id'],
                    'fullName' => $row['full_name'],
                    'email' => $row['email']
                ],
                'university' => $row['university_id'] ? ['id' => (string)$row['university_id'], 'name' => $row['university_name']] : null,
                'skills' => array_map(static fn($s) => ['skill' => ['id' => (string)$s['id'], 'name' => $s['name']]], $skills)
            ];
        }

        json_response(['items' => $items, 'pagination' => pagination_payload($page, $limit, $total)]);
    }

    if ($method === 'PUT' && count($segments) === 2) {
        $id = (int)$segments[1];
        exec_stmt($pdo, 'UPDATE students SET status = COALESCE(?, status), bio = COALESCE(?, bio), university_id = COALESCE(?, university_id) WHERE id = ?', [
            $input['status'] ?? null,
            $input['bio'] ?? null,
            isset($input['universityId']) ? (int)$input['universityId'] : null,
            $id
        ]);

        if (isset($input['fullName']) || isset($input['email'])) {
            $student = query_one($pdo, 'SELECT user_id FROM students WHERE id = ?', [$id]);
            if ($student) {
                exec_stmt($pdo, 'UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email) WHERE id = ?', [
                    $input['fullName'] ?? null,
                    isset($input['email']) ? strtolower(trim((string)$input['email'])) : null,
                    (int)$student['user_id']
                ]);
            }
        }

        json_response(['message' => 'Updated']);
    }

    if ($method === 'DELETE' && count($segments) === 2) {
        exec_stmt($pdo, 'DELETE FROM students WHERE id = ?', [(int)$segments[1]]);
        json_response(['message' => 'Deleted']);
    }

    throw new HttpError('Not found', 404);
}

function handle_companies(PDO $pdo, string $method, array $segments, array $input): void
{
    if ($method === 'POST' && count($segments) === 1) {
        $name = trim((string)($input['name'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? 'Aa123456');
        $industry = trim((string)($input['industry'] ?? 'General'));

        if ($name === '' || $email === '') {
            throw new HttpError('بيانات الشركة غير مكتملة', 422);
        }
        if (query_one($pdo, 'SELECT id FROM users WHERE email = ?', [$email])) {
            throw new HttpError('البريد الإلكتروني مستخدم بالفعل', 409);
        }

        $pdo->beginTransaction();
        try {
            exec_stmt($pdo, 'INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)', [
                $name,
                $email,
                password_hash($password, PASSWORD_BCRYPT),
                'COMPANY',
                'ACTIVE'
            ]);
            $userId = (int)$pdo->lastInsertId();
            exec_stmt($pdo, 'INSERT INTO companies (user_id, name, industry, status) VALUES (?, ?, ?, ?)', [$userId, $name, $industry, 'ACTIVE']);
            $pdo->commit();
            json_response(['message' => 'Created'], 201);
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    if ($method === 'GET' && count($segments) === 2) {
        $row = query_one($pdo, 'SELECT c.id, c.name, c.industry, c.status, u.email
                                FROM companies c
                                JOIN users u ON u.id = c.user_id
                                WHERE c.id = ?', [(int)$segments[1]]);
        if (!$row) {
            throw new HttpError('Not found', 404);
        }
        json_response([
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'industry' => $row['industry'],
            'status' => $row['status'],
            'user' => ['email' => $row['email']]
        ]);
    }

    if ($method === 'GET' && count($segments) === 1) {
        [$limit, $offset, $page] = pagination();
        $q = trim((string)($_GET['q'] ?? ''));
        $like = '%' . $q . '%';

        $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM companies c WHERE (? = "" OR c.name LIKE ? OR c.industry LIKE ?)', [$q, $like, $like])['c'];
        $rows = query_all($pdo, 'SELECT c.id, c.name, c.industry, c.status, u.email
                                 FROM companies c
                                 JOIN users u ON u.id = c.user_id
                                 WHERE (? = "" OR c.name LIKE ? OR c.industry LIKE ?)
                                 ORDER BY c.id DESC
                                 LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, [$q, $like, $like]);

        $items = array_map(static fn($r) => [
            'id' => (string)$r['id'],
            'name' => $r['name'],
            'industry' => $r['industry'],
            'status' => $r['status'],
            'user' => ['email' => $r['email']]
        ], $rows);

        json_response(['items' => $items, 'pagination' => pagination_payload($page, $limit, $total)]);
    }

    if ($method === 'PUT' && count($segments) === 2) {
        exec_stmt($pdo, 'UPDATE companies SET status = COALESCE(?, status), name = COALESCE(?, name), industry = COALESCE(?, industry) WHERE id = ?', [
            $input['status'] ?? null,
            $input['name'] ?? null,
            $input['industry'] ?? null,
            (int)$segments[1]
        ]);
        json_response(['message' => 'Updated']);
    }

    if ($method === 'DELETE' && count($segments) === 2) {
        exec_stmt($pdo, 'DELETE FROM companies WHERE id = ?', [(int)$segments[1]]);
        json_response(['message' => 'Deleted']);
    }

    throw new HttpError('Not found', 404);
}

function handle_universities(PDO $pdo, string $method, array $segments, array $input): void
{
    if ($method === 'POST' && count($segments) === 1) {
        $name = trim((string)($input['name'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? 'Aa123456');
        $location = trim((string)($input['location'] ?? 'Unknown'));

        if ($name === '' || $email === '') {
            throw new HttpError('بيانات الجامعة غير مكتملة', 422);
        }
        if (query_one($pdo, 'SELECT id FROM users WHERE email = ?', [$email])) {
            throw new HttpError('البريد الإلكتروني مستخدم بالفعل', 409);
        }

        $pdo->beginTransaction();
        try {
            exec_stmt($pdo, 'INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)', [
                $name,
                $email,
                password_hash($password, PASSWORD_BCRYPT),
                'UNIVERSITY',
                'ACTIVE'
            ]);
            $userId = (int)$pdo->lastInsertId();
            exec_stmt($pdo, 'INSERT INTO universities (user_id, name, location, status) VALUES (?, ?, ?, ?)', [$userId, $name, $location, 'ACTIVE']);
            $pdo->commit();
            json_response(['message' => 'Created'], 201);
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    if ($method === 'GET' && count($segments) === 2) {
        $row = query_one($pdo, 'SELECT u.id, u.name, u.location, u.status,
                                       (SELECT COUNT(*) FROM students s WHERE s.university_id = u.id) AS students_count
                                FROM universities u
                                WHERE u.id = ?', [(int)$segments[1]]);
        if (!$row) {
            throw new HttpError('Not found', 404);
        }
        json_response([
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'location' => $row['location'],
            'status' => $row['status'],
            'studentsCount' => (int)$row['students_count']
        ]);
    }

    if ($method === 'GET' && count($segments) === 1) {
        [$limit, $offset, $page] = pagination();
        $q = trim((string)($_GET['q'] ?? ''));
        $like = '%' . $q . '%';

        $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM universities u WHERE (? = "" OR u.name LIKE ?)', [$q, $like])['c'];
        $rows = query_all($pdo, 'SELECT u.id, u.name, u.location, u.status,
                                         (SELECT COUNT(*) FROM students s WHERE s.university_id = u.id) AS students_count
                                  FROM universities u
                                  WHERE (? = "" OR u.name LIKE ?)
                                  ORDER BY u.id DESC
                          LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, [$q, $like]);

        $items = array_map(static fn($r) => [
            'id' => (string)$r['id'],
            'name' => $r['name'],
            'location' => $r['location'],
            'status' => $r['status'],
            'studentsCount' => (int)$r['students_count']
        ], $rows);

        json_response(['items' => $items, 'pagination' => pagination_payload($page, $limit, $total)]);
    }

    if ($method === 'PUT' && count($segments) === 2) {
        exec_stmt($pdo, 'UPDATE universities SET status = COALESCE(?, status), name = COALESCE(?, name), location = COALESCE(?, location) WHERE id = ?', [
            $input['status'] ?? null,
            $input['name'] ?? null,
            $input['location'] ?? null,
            (int)$segments[1]
        ]);
        json_response(['message' => 'Updated']);
    }

    if ($method === 'DELETE' && count($segments) === 2) {
        exec_stmt($pdo, 'DELETE FROM universities WHERE id = ?', [(int)$segments[1]]);
        json_response(['message' => 'Deleted']);
    }

    throw new HttpError('Not found', 404);
}

function handle_jobs(PDO $pdo, string $method, array $segments, array $input, array $currentUser, bool $isAdmin): void
{
    $currentRole = (string)($currentUser['role'] ?? '');
    $companyScopeId = null;

    if (!$isAdmin && $currentRole === 'COMPANY') {
        $companyRow = query_one($pdo, 'SELECT id FROM companies WHERE user_id = ?', [(int)$currentUser['id']]);
        if (!$companyRow) {
            throw new HttpError('Forbidden', 403);
        }
        $companyScopeId = (int)$companyRow['id'];
    }

    if ($method === 'POST' && count($segments) === 1) {
        $companyId = $isAdmin
            ? (int)($input['companyId'] ?? 0)
            : (int)$companyScopeId;
        $title = trim((string)($input['title'] ?? ''));
        $location = trim((string)($input['location'] ?? 'Remote'));
        $type = strtoupper(trim((string)($input['type'] ?? 'FULL_TIME')));
        $description = trim((string)($input['description'] ?? ''));

        if ($companyId < 1 || $title === '') {
            throw new HttpError('بيانات الوظيفة غير مكتملة', 422);
        }

        if (!in_array($type, ['FULL_TIME', 'PART_TIME', 'INTERNSHIP'], true)) {
            $type = 'FULL_TIME';
        }

        exec_stmt($pdo, 'INSERT INTO jobs (company_id, title, location, type, status, description) VALUES (?, ?, ?, ?, ?, ?)', [
            $companyId,
            $title,
            $location,
            $type,
            'OPEN',
            $description !== '' ? $description : null
        ]);
        json_response(['message' => 'Created'], 201);
    }

    if ($method === 'GET' && count($segments) === 2) {
        $jobId = (int)$segments[1];
        if (!$isAdmin && $currentRole === 'COMPANY' && (($_GET['mine'] ?? '') === '1')) {
            $row = query_one($pdo, 'SELECT j.id, j.title, j.location, j.type, j.status, j.description, c.name AS company_name
                                    FROM jobs j
                                    JOIN companies c ON c.id = j.company_id
                                    WHERE j.id = ? AND j.company_id = ?', [$jobId, (int)$companyScopeId]);
        } else {
            $row = query_one($pdo, 'SELECT j.id, j.title, j.location, j.type, j.status, j.description, c.name AS company_name
                                    FROM jobs j
                                    JOIN companies c ON c.id = j.company_id
                                    WHERE j.id = ?', [$jobId]);
        }
        if (!$row) {
            throw new HttpError('Not found', 404);
        }
        json_response([
            'id' => (string)$row['id'],
            'title' => $row['title'],
            'location' => $row['location'],
            'type' => $row['type'],
            'status' => $row['status'],
            'description' => $row['description'],
            'company' => ['name' => $row['company_name']]
        ]);
    }

    if ($method === 'GET' && count($segments) === 1) {
        [$limit, $offset, $page] = pagination();
        $q = trim((string)($_GET['q'] ?? ''));
        $like = '%' . $q . '%';
        $mineOnly = (!$isAdmin && $currentRole === 'COMPANY' && (($_GET['mine'] ?? '') === '1'));

        if ($mineOnly) {
            $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM jobs j WHERE j.company_id = ? AND (? = "" OR j.title LIKE ? OR j.location LIKE ?)', [(int)$companyScopeId, $q, $like, $like])['c'];
            $rows = query_all($pdo, 'SELECT j.id, j.title, j.location, j.type, j.status, c.name AS company_name
                                     FROM jobs j
                                     JOIN companies c ON c.id = j.company_id
                                     WHERE j.company_id = ? AND (? = "" OR j.title LIKE ? OR j.location LIKE ?)
                                     ORDER BY j.id DESC
                                     LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, [(int)$companyScopeId, $q, $like, $like]);
        } else {
            $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM jobs j WHERE (? = "" OR j.title LIKE ? OR j.location LIKE ?)', [$q, $like, $like])['c'];
            $rows = query_all($pdo, 'SELECT j.id, j.title, j.location, j.type, j.status, c.name AS company_name
                                     FROM jobs j
                                     JOIN companies c ON c.id = j.company_id
                                     WHERE (? = "" OR j.title LIKE ? OR j.location LIKE ?)
                                     ORDER BY j.id DESC
                                     LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, [$q, $like, $like]);
        }

        $items = array_map(static fn($r) => [
            'id' => (string)$r['id'],
            'title' => $r['title'],
            'location' => $r['location'],
            'type' => $r['type'],
            'status' => $r['status'],
            'company' => ['name' => $r['company_name']]
        ], $rows);

        json_response(['items' => $items, 'pagination' => pagination_payload($page, $limit, $total)]);
    }

    if ($method === 'PUT' && count($segments) === 2) {
        $jobId = (int)$segments[1];
        if (!$isAdmin) {
            $owned = query_one($pdo, 'SELECT id FROM jobs WHERE id = ? AND company_id = ?', [$jobId, (int)$companyScopeId]);
            if (!$owned) {
                throw new HttpError('Forbidden', 403);
            }
        }

        exec_stmt($pdo, 'UPDATE jobs SET status = COALESCE(?, status), title = COALESCE(?, title), location = COALESCE(?, location), type = COALESCE(?, type), description = COALESCE(?, description) WHERE id = ?', [
            $input['status'] ?? null,
            $input['title'] ?? null,
            $input['location'] ?? null,
            $input['type'] ?? null,
            $input['description'] ?? null,
            $jobId
        ]);
        json_response(['message' => 'Updated']);
    }

    if ($method === 'DELETE' && count($segments) === 2) {
        $jobId = (int)$segments[1];
        if (!$isAdmin) {
            $owned = query_one($pdo, 'SELECT id FROM jobs WHERE id = ? AND company_id = ?', [$jobId, (int)$companyScopeId]);
            if (!$owned) {
                throw new HttpError('Forbidden', 403);
            }
        }

        exec_stmt($pdo, 'DELETE FROM jobs WHERE id = ?', [$jobId]);
        json_response(['message' => 'Deleted']);
    }

    throw new HttpError('Not found', 404);
}

function handle_applications(PDO $pdo, string $method, array $segments, array $input, array $currentUser, bool $isAdmin): void
{
    $role = (string)($currentUser['role'] ?? '');
    $studentId = null;
    $companyId = null;

    if ($role === 'STUDENT') {
        $row = query_one($pdo, 'SELECT id FROM students WHERE user_id = ?', [(int)$currentUser['id']]);
        if (!$row) {
            throw new HttpError('Forbidden', 403);
        }
        $studentId = (int)$row['id'];
    }

    if ($role === 'COMPANY') {
        $row = query_one($pdo, 'SELECT id FROM companies WHERE user_id = ?', [(int)$currentUser['id']]);
        if (!$row) {
            throw new HttpError('Forbidden', 403);
        }
        $companyId = (int)$row['id'];
    }

    if ($method === 'POST' && count($segments) === 1) {
        if ($role !== 'STUDENT') {
            throw new HttpError('Forbidden', 403);
        }

        $jobId = (int)($input['jobId'] ?? 0);
        if ($jobId < 1) {
            throw new HttpError('بيانات الطلب غير مكتملة', 422);
        }

        $job = query_one($pdo, 'SELECT id, status FROM jobs WHERE id = ?', [$jobId]);
        if (!$job || ($job['status'] ?? '') !== 'OPEN') {
            throw new HttpError('الوظيفة غير متاحة', 422);
        }

        if (query_one($pdo, 'SELECT id FROM job_applications WHERE job_id = ? AND student_id = ?', [$jobId, $studentId])) {
            throw new HttpError('تم التقديم على هذه الوظيفة مسبقاً', 409);
        }

        exec_stmt($pdo, 'INSERT INTO job_applications (job_id, student_id, status, cover_letter) VALUES (?, ?, ?, ?)', [
            $jobId,
            $studentId,
            'PENDING',
            isset($input['coverLetter']) ? trim((string)$input['coverLetter']) : null
        ]);

        json_response(['message' => 'تم تقديم الطلب بنجاح'], 201);
    }

    if ($method === 'GET' && count($segments) === 3 && $segments[2] === 'history') {
        $applicationId = (int)$segments[1];
        $application = query_one($pdo, 'SELECT a.id, a.student_id, j.company_id
                                       FROM job_applications a
                                       JOIN jobs j ON j.id = a.job_id
                                       WHERE a.id = ?', [$applicationId]);
        if (!$application) {
            throw new HttpError('Not found', 404);
        }

        if (!$isAdmin) {
            if ($role === 'STUDENT' && (int)$application['student_id'] !== (int)$studentId) {
                throw new HttpError('Forbidden', 403);
            }
            if ($role === 'COMPANY' && (int)$application['company_id'] !== (int)$companyId) {
                throw new HttpError('Forbidden', 403);
            }
        }

        $rows = query_all($pdo, 'SELECT l.id, l.from_status, l.to_status, l.changed_by_role, l.changed_at,
                                        u.id AS changed_by_user_id, u.full_name AS changed_by_full_name, u.email AS changed_by_email
                                 FROM application_status_logs l
                                 LEFT JOIN users u ON u.id = l.changed_by_user_id
                                 WHERE l.application_id = ?
                                 ORDER BY l.id DESC', [$applicationId]);

        $items = array_map(static function (array $row): array {
            return [
                'id' => (string)$row['id'],
                'fromStatus' => $row['from_status'],
                'toStatus' => $row['to_status'],
                'changedAt' => $row['changed_at'],
                'changedBy' => [
                    'id' => $row['changed_by_user_id'] !== null ? (string)$row['changed_by_user_id'] : null,
                    'fullName' => $row['changed_by_full_name'] ?? null,
                    'email' => $row['changed_by_email'] ?? null,
                    'role' => $row['changed_by_role'] ?? null,
                ],
            ];
        }, $rows);

        json_response(['items' => $items]);
    }

    if ($method === 'GET' && count($segments) === 1) {
        [$limit, $offset, $page] = pagination();
        $status = strtoupper(trim((string)($_GET['status'] ?? '')));
        $hasStatus = in_array($status, ['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED'], true);

        if ($isAdmin) {
            $where = $hasStatus ? 'WHERE a.status = ?' : '';
            $countParams = $hasStatus ? [$status] : [];
            $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM job_applications a ' . $where, $countParams)['c'];
            $params = $hasStatus ? [$status] : [];
            $rows = query_all($pdo, 'SELECT a.id, a.status, a.cover_letter, a.created_at,
                                         j.id AS job_id, j.title, c.name AS company_name,
                                         s.id AS student_id, u.full_name AS student_name, u.email AS student_email
                                  FROM job_applications a
                                  JOIN jobs j ON j.id = a.job_id
                                  JOIN companies c ON c.id = j.company_id
                                  JOIN students s ON s.id = a.student_id
                                  JOIN users u ON u.id = s.user_id
                                  ' . $where . '
                                  ORDER BY a.id DESC
                                  LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, $params);
        } elseif ($role === 'STUDENT') {
            $where = 'WHERE a.student_id = ?' . ($hasStatus ? ' AND a.status = ?' : '');
            $countParams = $hasStatus ? [$studentId, $status] : [$studentId];
            $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM job_applications a ' . $where, $countParams)['c'];
            $params = $hasStatus ? [$studentId, $status] : [$studentId];
            $rows = query_all($pdo, 'SELECT a.id, a.status, a.cover_letter, a.created_at,
                                         j.id AS job_id, j.title, c.name AS company_name
                                  FROM job_applications a
                                  JOIN jobs j ON j.id = a.job_id
                                  JOIN companies c ON c.id = j.company_id
                                  ' . $where . '
                                  ORDER BY a.id DESC
                                  LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, $params);
        } else {
            $where = 'WHERE j.company_id = ?' . ($hasStatus ? ' AND a.status = ?' : '');
            $countParams = $hasStatus ? [$companyId, $status] : [$companyId];
            $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM job_applications a JOIN jobs j ON j.id = a.job_id ' . $where, $countParams)['c'];
            $params = $hasStatus ? [$companyId, $status] : [$companyId];
            $rows = query_all($pdo, 'SELECT a.id, a.status, a.cover_letter, a.created_at,
                                         j.id AS job_id, j.title,
                                         s.id AS student_id, u.full_name AS student_name, u.email AS student_email
                                  FROM job_applications a
                                  JOIN jobs j ON j.id = a.job_id
                                  JOIN students s ON s.id = a.student_id
                                  JOIN users u ON u.id = s.user_id
                                  ' . $where . '
                                  ORDER BY a.id DESC
                                  LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, $params);
        }

        $items = array_map(static function (array $r): array {
            return [
                'id' => (string)$r['id'],
                'status' => $r['status'],
                'coverLetter' => $r['cover_letter'] ?? null,
                'createdAt' => $r['created_at'],
                'job' => [
                    'id' => (string)$r['job_id'],
                    'title' => $r['title'],
                    'companyName' => $r['company_name'] ?? null,
                ],
                'student' => isset($r['student_id']) ? [
                    'id' => (string)$r['student_id'],
                    'fullName' => $r['student_name'] ?? null,
                    'email' => $r['student_email'] ?? null,
                ] : null,
            ];
        }, $rows);

        json_response(['items' => $items, 'pagination' => pagination_payload($page, $limit, $total)]);
    }

    if ($method === 'PUT' && count($segments) === 2) {
        $applicationId = (int)$segments[1];
        $nextStatus = strtoupper(trim((string)($input['status'] ?? '')));
        if (!in_array($nextStatus, ['REVIEWED', 'ACCEPTED', 'REJECTED'], true)) {
            throw new HttpError('حالة الطلب غير صالحة', 422);
        }

        $current = query_one($pdo, 'SELECT a.id, a.status, j.company_id
                                    FROM job_applications a
                                    JOIN jobs j ON j.id = a.job_id
                                    WHERE a.id = ?', [$applicationId]);
        if (!$current) {
            throw new HttpError('Not found', 404);
        }

        if (!$isAdmin) {
            if ($role !== 'COMPANY') {
                throw new HttpError('Forbidden', 403);
            }
            if ((int)$current['company_id'] !== (int)$companyId) {
                throw new HttpError('Forbidden', 403);
            }
        }

        $currentStatus = (string)$current['status'];
        $allowedTransitions = [
            'PENDING' => ['REVIEWED', 'ACCEPTED', 'REJECTED'],
            'REVIEWED' => ['ACCEPTED', 'REJECTED'],
            'ACCEPTED' => [],
            'REJECTED' => [],
        ];

        if (!in_array($nextStatus, $allowedTransitions[$currentStatus] ?? [], true)) {
            throw new HttpError('الانتقال بين الحالات غير مسموح', 409);
        }

        $pdo->beginTransaction();
        try {
            exec_stmt($pdo, 'UPDATE job_applications SET status = ? WHERE id = ?', [$nextStatus, $applicationId]);
            exec_stmt($pdo, 'INSERT INTO application_status_logs (application_id, from_status, to_status, changed_by_user_id, changed_by_role) VALUES (?, ?, ?, ?, ?)', [
                $applicationId,
                $currentStatus,
                $nextStatus,
                (int)$currentUser['id'],
                $role,
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        json_response(['message' => 'Updated']);
    }

    if ($method === 'DELETE' && count($segments) === 2) {
        $applicationId = (int)$segments[1];
        if ($role !== 'STUDENT') {
            throw new HttpError('Forbidden', 403);
        }

        $own = query_one($pdo, 'SELECT id, status FROM job_applications WHERE id = ? AND student_id = ?', [$applicationId, $studentId]);
        if (!$own) {
            throw new HttpError('Forbidden', 403);
        }

        if (($own['status'] ?? 'PENDING') !== 'PENDING') {
            throw new HttpError('لا يمكن حذف الطلب بعد بدء مراجعته', 409);
        }

        exec_stmt($pdo, 'DELETE FROM job_applications WHERE id = ?', [$applicationId]);
        json_response(['message' => 'Deleted']);
    }

    throw new HttpError('Not found', 404);
}

function handle_skills(PDO $pdo, string $method, array $segments, array $input): void
{
    if ($method === 'GET' && count($segments) === 2) {
        $row = query_one($pdo, 'SELECT id, name, category, status FROM skills WHERE id = ?', [(int)$segments[1]]);
        if (!$row) {
            throw new HttpError('Not found', 404);
        }
        json_response([
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'category' => $row['category'],
            'status' => $row['status']
        ]);
    }

    if ($method === 'GET' && count($segments) === 1) {
        [$limit, $offset, $page] = pagination();
        $q = trim((string)($_GET['q'] ?? ''));
        $like = '%' . $q . '%';

        $total = (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM skills s WHERE (? = "" OR s.name LIKE ? OR s.category LIKE ?)', [$q, $like, $like])['c'];
        $rows = query_all($pdo, 'SELECT id, name, category, status FROM skills s
                                 WHERE (? = "" OR s.name LIKE ? OR s.category LIKE ?)
                                 ORDER BY s.id DESC
                                 LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset, [$q, $like, $like]);
        $items = array_map(static fn($r) => [
            'id' => (string)$r['id'],
            'name' => $r['name'],
            'category' => $r['category'],
            'status' => $r['status']
        ], $rows);

        json_response(['items' => $items, 'pagination' => pagination_payload($page, $limit, $total)]);
    }

    if ($method === 'POST' && count($segments) === 1) {
        $name = trim((string)($input['name'] ?? ''));
        $category = trim((string)($input['category'] ?? ''));
        if ($name === '' || $category === '') {
            throw new HttpError('يرجى إدخال جميع الحقول', 422);
        }
        exec_stmt($pdo, 'INSERT INTO skills (name, category, status) VALUES (?, ?, ?)', [$name, $category, 'ACTIVE']);
        json_response(['message' => 'Created'], 201);
    }

    if ($method === 'PUT' && count($segments) === 2) {
        $id = (int)$segments[1];
        exec_stmt($pdo, 'UPDATE skills SET name = COALESCE(?, name), category = COALESCE(?, category), status = COALESCE(?, status) WHERE id = ?', [
            $input['name'] ?? null,
            $input['category'] ?? null,
            $input['status'] ?? null,
            $id
        ]);
        json_response(['message' => 'Updated']);
    }

    if ($method === 'DELETE' && count($segments) === 2) {
        exec_stmt($pdo, 'DELETE FROM skills WHERE id = ?', [(int)$segments[1]]);
        json_response(['message' => 'Deleted']);
    }

    throw new HttpError('Not found', 404);
}

function dashboard_stats(PDO $pdo): array
{
    return [
        'students' => (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM students')['c'],
        'companies' => (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM companies')['c'],
        'universities' => (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM universities')['c'],
        'jobs' => (int)query_one($pdo, 'SELECT COUNT(*) AS c FROM jobs')['c'],
    ];
}

function require_admin(PDO $pdo): array
{
    $row = require_auth_user($pdo);

    if (($row['role'] ?? '') !== 'ADMIN') {
        throw new HttpError('Forbidden', 403);
    }

    return $row;
}

function require_auth_user(PDO $pdo): array
{
    $token = get_bearer_token();
    if (!$token) {
        throw new HttpError('Unauthorized', 401);
    }

    $row = query_one($pdo, 'SELECT u.id, u.full_name, u.email, u.role, u.status
                           FROM auth_tokens t
                           JOIN users u ON u.id = t.user_id
                           WHERE t.access_token = ? AND t.expires_at > NOW()', [$token]);
    if (!$row) {
        throw new HttpError('Unauthorized', 401);
    }

    return map_user($row);
}

function issue_tokens(PDO $pdo, array $config, int $userId): array
{
    $accessToken = bin2hex(random_bytes(32));
    $refreshToken = bin2hex(random_bytes(32));
    $expiresAt = (new DateTimeImmutable())->modify('+' . (int)$config['token_ttl_hours'] . ' hours')->format('Y-m-d H:i:s');

    exec_stmt($pdo, 'DELETE FROM auth_tokens WHERE user_id = ?', [$userId]);
    exec_stmt($pdo, 'INSERT INTO auth_tokens (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)', [$userId, $accessToken, $refreshToken, $expiresAt]);

    return ['accessToken' => $accessToken, 'refreshToken' => $refreshToken];
}

function ensure_runtime_tables(PDO $pdo): void
function handle_profile(PDO $pdo, string $method, array $segments, array $input, array $user): void
{
    $role = $user['role'] ?? '';

    // GET /profile
    if ($method === 'GET' && count($segments) === 1) {
        if ($role === 'STUDENT') {
            $student = query_one($pdo,
                'SELECT s.id, s.bio, un.id AS university_id, un.name AS university_name
                 FROM students s
                 LEFT JOIN universities un ON un.id = s.university_id
                 WHERE s.user_id = ?',
                [(int)$user['id']]
            );
            if (!$student) throw new HttpError('Profile not found', 404);
            $skills = query_all($pdo,
                'SELECT sk.id, sk.name, sk.category
                 FROM student_skills ss JOIN skills sk ON sk.id = ss.skill_id
                 WHERE ss.student_id = ?',
                [(int)$student['id']]
            );
            json_response([
                'id'         => (string)$student['id'],
                'fullName'   => $user['fullName'],
                'email'      => $user['email'],
                'bio'        => $student['bio'],
                'university' => $student['university_id'] ? ['id' => (string)$student['university_id'], 'name' => $student['university_name']] : null,
                'skills'     => array_map(static fn($s) => ['id' => (string)$s['id'], 'name' => $s['name'], 'category' => $s['category']], $skills)
            ]);
        }
        json_response(['fullName' => $user['fullName'], 'email' => $user['email'], 'role' => $user['role']]);
    }

    // PUT /profile  (update bio / fullName)
    if ($method === 'PUT' && count($segments) === 1) {
        if ($role !== 'STUDENT') throw new HttpError('Forbidden', 403);
        $student = query_one($pdo, 'SELECT id FROM students WHERE user_id = ?', [(int)$user['id']]);
        if (!$student) throw new HttpError('Profile not found', 404);
        $bio = isset($input['bio']) ? trim((string)$input['bio']) : null;
        $fullName = isset($input['fullName']) ? trim((string)$input['fullName']) : null;
        if ($bio !== null) {
            exec_stmt($pdo, 'UPDATE students SET bio = ? WHERE id = ?', [$bio !== '' ? $bio : null, (int)$student['id']]);
        }
        if ($fullName !== null && $fullName !== '') {
            exec_stmt($pdo, 'UPDATE users SET full_name = ? WHERE id = ?', [$fullName, (int)$user['id']]);
        }
        json_response(['message' => 'Updated']);
    }

    // POST /profile/skills  (add skill)
    if ($method === 'POST' && ($segments[1] ?? '') === 'skills') {
        if ($role !== 'STUDENT') throw new HttpError('Forbidden', 403);
        $student = query_one($pdo, 'SELECT id FROM students WHERE user_id = ?', [(int)$user['id']]);
        if (!$student) throw new HttpError('Profile not found', 404);
        $skillId = (int)($input['skillId'] ?? 0);
        if (!$skillId) throw new HttpError('skillId مطلوب', 422);
        $skill = query_one($pdo, 'SELECT id FROM skills WHERE id = ?', [$skillId]);
        if (!$skill) throw new HttpError('المهارة غير موجودة', 404);
        exec_stmt($pdo, 'INSERT IGNORE INTO student_skills (student_id, skill_id) VALUES (?, ?)', [(int)$student['id'], $skillId]);
        json_response(['message' => 'تمت إضافة المهارة'], 201);
    }

    // DELETE /profile/skills/{skillId}  (remove skill)
    if ($method === 'DELETE' && ($segments[1] ?? '') === 'skills' && isset($segments[2])) {
        if ($role !== 'STUDENT') throw new HttpError('Forbidden', 403);
        $student = query_one($pdo, 'SELECT id FROM students WHERE user_id = ?', [(int)$user['id']]);
        if (!$student) throw new HttpError('Profile not found', 404);
        exec_stmt($pdo, 'DELETE FROM student_skills WHERE student_id = ? AND skill_id = ?', [(int)$student['id'], (int)$segments[2]]);
        json_response(['message' => 'تم حذف المهارة']);
    }

    throw new HttpError('Not found', 404);
}

function ensure_runtime_tables(PDO $pdo): void
{
    exec_stmt($pdo, 'CREATE TABLE IF NOT EXISTS application_status_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        from_status ENUM("PENDING","REVIEWED","ACCEPTED","REJECTED") NOT NULL,
        to_status ENUM("PENDING","REVIEWED","ACCEPTED","REJECTED") NOT NULL,
        changed_by_user_id INT NOT NULL,
        changed_by_role ENUM("ADMIN","COMPANY") NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_audit_application FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
        CONSTRAINT fk_audit_changed_by FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_audit_application (application_id),
        INDEX idx_audit_changed_at (changed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function map_user(array $row): array
{
    return [
        'id' => (string)$row['id'],
        'fullName' => (string)$row['full_name'],
        'email' => (string)$row['email'],
        'role' => (string)$row['role'],
        'status' => (string)$row['status'],
    ];
}

function pagination(): array
{
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 10)));
    $offset = ($page - 1) * $limit;
    return [$limit, $offset, $page];
}

function pagination_payload(int $page, int $limit, int $total): array
{
    return [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'totalPages' => max(1, (int)ceil($total / $limit)),
    ];
}

function query_one(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row ?: [];
}

function query_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function exec_stmt(PDO $pdo, string $sql, array $params = []): void
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}

function get_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? '';
    if (!preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
        return null;
    }
    return trim($matches[1]);
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

final class HttpError extends RuntimeException
{
    public int $statusCode;

    public function __construct(string $message, int $statusCode)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
    }
}

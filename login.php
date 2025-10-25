<?php
header('Content-Type: application/json');
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $usuario = trim($_POST['usuario']);
    $password = $_POST['password'];

    if (empty($usuario) || empty($password)) {
        echo json_encode([
            'success' => false,
            'message' => 'Todos los campos son requeridos'
        ]);
        exit;
    }

    $sql = "SELECT * FROM administradores WHERE usuario = ? AND estado = 'activo'";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $usuario);
    $stmt->execute();
    $result = $stmt->get_result();
    $admin = $result->fetch_assoc();

    if ($admin && password_verify($password, $admin['password'])) {
        $token = bin2hex(random_bytes(32));
    
        // Guardar el token en la base de datos
        $updateSql = "UPDATE administradores SET 
                      token = ?,
                      ultimo_acceso = CURRENT_TIMESTAMP 
                      WHERE id = ?";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bind_param("si", $token, $admin['id']);
        $updateStmt->execute();
    
        echo json_encode([
            'success' => true,
            'token' => $token,
            'nombre' => $admin['nombre'],
            'usuario' => $admin['usuario']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Credenciales inválidas'
        ]);
    }
    exit;
}

echo json_encode([
    'success' => false,
    'message' => 'Método no permitido'
]);

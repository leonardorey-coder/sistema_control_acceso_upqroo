<?php
header('Content-Type: application/json');
require_once 'config.php';

// Obtener el token del header
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

// Verificar si existe el token
if (!$token) {
    http_response_code(401);
    echo json_encode([
        'success' => false, 
        'message' => 'No autorizado'
    ]);
    exit;
}

try {
    // Verificar el administrador por usuario y estado
    $query = "SELECT id, nombre, usuario, estado, ultimo_acceso 
              FROM administradores 
              WHERE usuario = ? AND estado = 'activo'";
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param("s", $token); // Usando el token como usuario en este caso
    $stmt->execute();
    $resultado = $stmt->get_result();

    if ($resultado->num_rows > 0) {
        $admin = $resultado->fetch_assoc();
        
        // Actualizar último acceso
        $update_query = "UPDATE administradores 
                        SET ultimo_acceso = CURRENT_TIMESTAMP 
                        WHERE id = ?";
        $update_stmt = $conn->prepare($update_query);
        $update_stmt->bind_param("i", $admin['id']);
        $update_stmt->execute();

        echo json_encode([
            'success' => true,
            'data' => [
                'id' => $admin['id'],
                'nombre' => $admin['nombre'],
                'usuario' => $admin['usuario'],
                'ultimo_acceso' => $admin['ultimo_acceso']
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Sesión inválida o usuario inactivo'
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al verificar el administrador'
    ]);
}

if (isset($stmt)) $stmt->close();
if (isset($update_stmt)) $update_stmt->close();
if (isset($conn)) $conn->close();
?>

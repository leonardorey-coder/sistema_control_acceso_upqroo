<?php
require_once 'config.php';
header('Content-Type: application/json');

function obtenerIdAdmin($conn, $token) {
    $sql = "SELECT id FROM administradores WHERE token = ? AND estado = 'activo'";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Sesión de administrador no válida');
    }
    
    $admin = $result->fetch_assoc();
    return $admin['id'];
}

function sanitizeOutput($persona) {
    // Convertir foto_perfil BLOB a base64 si existe
    if (isset($persona['foto_perfil']) && $persona['foto_perfil'] !== null) {
        $persona['foto_perfil'] = base64_encode($persona['foto_perfil']);
    } else {
        $persona['foto_perfil'] = null;
    }
    
    // Sanitizar otros campos para asegurar codificación UTF-8 correcta
    $persona['nombres'] = mb_convert_encoding($persona['nombres'], 'UTF-8', 'auto');
    $persona['apellidos'] = mb_convert_encoding($persona['apellidos'], 'UTF-8', 'auto');
    if (isset($persona['nombre_carrera'])) {
        $persona['nombre_carrera'] = mb_convert_encoding($persona['nombre_carrera'], 'UTF-8', 'auto');
    }
    
    return $persona;
}

function registrarAcceso($conn, $matricula, $tipo, $id_admin) {
    $procedimiento = ($tipo === 'entrada') ? "registrar_entrada" : "registrar_salida";
    $stmt = $conn->prepare("CALL {$procedimiento}(?, ?)");
    if (!$stmt) {
        throw new Exception("Error preparando el procedimiento: " . $conn->error);
    }
    $stmt->bind_param("si", $matricula, $id_admin);
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando el procedimiento: " . $stmt->error);
    }
    $stmt->close();
}

try {
    if (!isset($_POST['matricula']) || !isset($_POST['admin_token'])) {
        throw new Exception('No se recibió matrícula o ID de administrador');
    }

    $matricula = $conn->real_escape_string($_POST['matricula']);
    $adminToken = $_POST['admin_token'];
    
    // Obtener el ID del administrador a partir del token
    $idAdmin = obtenerIdAdmin($conn, $adminToken);
    
    // Consultar información de la persona incluyendo la foto
    $query = "SELECT p.*, c.nombre_carrera 
              FROM personas p 
              LEFT JOIN carreras c ON p.id_carrera = c.id_carrera 
              WHERE p.matricula = ?";
    
    $stmt = $conn->prepare($query);
    if (!$stmt) {
        throw new Exception("Error preparando la consulta: " . $conn->error);
    }

    $stmt->bind_param("s", $matricula);
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando la consulta: " . $stmt->error);
    }

    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Matrícula no encontrada');
    }

    $persona = $result->fetch_assoc();
    
    // Verificar estado activo
    if ($persona['estado'] === 'inactivo') {
        echo json_encode([
            'success' => false,
            'message' => 'Matrícula inactiva. Acceso denegado.',
            'data' => sanitizeOutput($persona)
        ]);
        exit;
    }

    // Verificar registro existente
    $queryCheck = "SELECT id_registro, hora_entrada 
                  FROM registros_acceso 
                  WHERE matricula = ? 
                  AND DATE(hora_entrada) = CURRENT_DATE 
                  AND hora_salida IS NULL";
    
    $stmtCheck = $conn->prepare($queryCheck);
    if (!$stmtCheck) {
        throw new Exception("Error preparando la verificación: " . $conn->error);
    }

    $stmtCheck->bind_param("s", $matricula);
    $stmtCheck->execute();
    $resultCheck = $stmtCheck->get_result();

    // Determinar tipo de registro y registrar
    // Al registrar acceso, usar el ID del administrador obtenido
    if ($resultCheck->num_rows > 0) {
        registrarAcceso($conn, $matricula, 'salida', $idAdmin);
        $persona['tipo_registro'] = 'salida';
    } else {
        registrarAcceso($conn, $matricula, 'entrada', $idAdmin);
        $persona['tipo_registro'] = 'entrada';
    }

       // Consultar el último registro incluyendo los nombres de los administradores
       $queryUltimoRegistro = "
       SELECT r.hora_entrada, r.hora_salida,
              a1.nombre as nombre_admin_entrada,
              a2.nombre as nombre_admin_salida
       FROM registros_acceso r
       LEFT JOIN administradores a1 ON r.id_admin_entrada = a1.id
       LEFT JOIN administradores a2 ON r.id_admin_salida = a2.id
       WHERE r.matricula = ?
       ORDER BY r.id_registro DESC
       LIMIT 1";
   
   $stmtUltimo = $conn->prepare($queryUltimoRegistro);
   $stmtUltimo->bind_param("s", $matricula);
   $stmtUltimo->execute();
   $ultimoRegistro = $stmtUltimo->get_result()->fetch_assoc();
   
   // Agregar información al resultado
   $persona['hora_entrada'] = $ultimoRegistro['hora_entrada'];
   $persona['hora_salida'] = $ultimoRegistro['hora_salida'];
   $persona['admin_entrada'] = $ultimoRegistro['nombre_admin_entrada'];
   $persona['admin_salida'] = $ultimoRegistro['nombre_admin_salida'];

   // Enviar respuesta exitosa
   echo json_encode([
       'success' => true,
       'data' => sanitizeOutput($persona)
   ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}

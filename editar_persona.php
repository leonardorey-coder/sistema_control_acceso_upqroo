<?php
require_once 'config.php';
header('Content-Type: application/json');

try {
    // Validar que se recibieron todos los datos necesarios
    if (!isset($_POST['matricula_original']) || !isset($_POST['matricula']) || 
        !isset($_POST['nombres']) || !isset($_POST['apellidos']) || 
        !isset($_POST['curp']) || !isset($_POST['tipo_persona']) || 
        !isset($_POST['estado'])) {
        throw new Exception('Faltan datos requeridos');
    }

    $matriculaOriginal = $conn->real_escape_string($_POST['matricula_original']);
    $matricula = $conn->real_escape_string($_POST['matricula']);
    $nombres = $conn->real_escape_string($_POST['nombres']);
    $apellidos = $conn->real_escape_string($_POST['apellidos']);
    $curp = strtoupper($conn->real_escape_string($_POST['curp']));
    $tipopersona = $conn->real_escape_string($_POST['tipo_persona']);
    $estado = $conn->real_escape_string($_POST['estado']);
    $idCarrera = isset($_POST['id_carrera']) && $_POST['id_carrera'] !== '' ? 
                 intval($_POST['id_carrera']) : null;

    // Validar formato de matrícula
    if (!preg_match('/^\d{9}$/', $matricula)) {
        throw new Exception('La matrícula debe tener exactamente 9 dígitos');
    }

    // Validar formato de CURP
    if (!preg_match('/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$/', $curp)) {
        throw new Exception('El CURP no tiene el formato correcto');
    }

    // Validar que el tipo de persona sea válido
    $tiposValidos = ['estudiante', 'docente', 'administrativo'];
    if (!in_array($tipopersona, $tiposValidos)) {
        throw new Exception('Tipo de persona no válido');
    }

    // Validar que el estado sea válido
    if ($estado !== 'activo' && $estado !== 'inactivo') {
        throw new Exception('Estado no válido');
    }

    // Si es estudiante, validar que tenga carrera
    if ($tipopersona === 'estudiante' && !$idCarrera) {
        throw new Exception('Debe seleccionar una carrera para estudiantes');
    }

    // Verificar si la persona existe
    $checkQuery = "SELECT matricula FROM personas WHERE matricula = ?";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bind_param("s", $matriculaOriginal);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows === 0) {
        throw new Exception('La persona no existe en el sistema');
    }

    // Si se cambió la matrícula, verificar que la nueva no exista
    if ($matricula !== $matriculaOriginal) {
        $checkNewQuery = "SELECT matricula FROM personas WHERE matricula = ?";
        $checkNewStmt = $conn->prepare($checkNewQuery);
        $checkNewStmt->bind_param("s", $matricula);
        $checkNewStmt->execute();
        $checkNewResult = $checkNewStmt->get_result();
        
        if ($checkNewResult->num_rows > 0) {
            throw new Exception('La nueva matrícula ya está registrada');
        }
    }

    // Verificar si se cambió el CURP y validar que no exista
    if ($curp !== '') {
        $checkCurpQuery = "SELECT matricula FROM personas WHERE curp = ? AND matricula != ?";
        $checkCurpStmt = $conn->prepare($checkCurpQuery);
        $checkCurpStmt->bind_param("ss", $curp, $matriculaOriginal);
        $checkCurpStmt->execute();
        $checkCurpResult = $checkCurpStmt->get_result();
        
        if ($checkCurpResult->num_rows > 0) {
            throw new Exception('El CURP ya está registrado para otra persona');
        }
    }

    // Procesar foto de perfil si se envió
    $fotoPerfil = null;
    $updateFoto = false;
    if (isset($_FILES['foto_perfil']) && $_FILES['foto_perfil']['error'] === UPLOAD_ERR_OK) {
        $tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        $tipoArchivo = $_FILES['foto_perfil']['type'];
        
        if (!in_array($tipoArchivo, $tiposPermitidos)) {
            throw new Exception('Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG o GIF');
        }
        
        $maxSize = 5 * 1024 * 1024; // 5MB
        if ($_FILES['foto_perfil']['size'] > $maxSize) {
            throw new Exception('La imagen es demasiado grande. Tamaño máximo: 5MB');
        }
        
        $fotoPerfil = file_get_contents($_FILES['foto_perfil']['tmp_name']);
        $updateFoto = true;
    }

    // Construir la consulta de actualización
    if ($updateFoto) {
        $updateQuery = "UPDATE personas SET 
                       matricula = ?, 
                       nombres = ?, 
                       apellidos = ?, 
                       curp = ?, 
                       tipo_persona = ?, 
                       id_carrera = ?, 
                       estado = ?,
                       foto_perfil = ? 
                       WHERE matricula = ?";
        $stmt = $conn->prepare($updateQuery);
        $stmt->bind_param("sssssisss", $matricula, $nombres, $apellidos, $curp, 
                         $tipopersona, $idCarrera, $estado, $fotoPerfil, $matriculaOriginal);
    } else {
        $updateQuery = "UPDATE personas SET 
                       matricula = ?, 
                       nombres = ?, 
                       apellidos = ?, 
                       curp = ?, 
                       tipo_persona = ?, 
                       id_carrera = ?, 
                       estado = ? 
                       WHERE matricula = ?";
        $stmt = $conn->prepare($updateQuery);
        $stmt->bind_param("sssssiss", $matricula, $nombres, $apellidos, $curp, 
                         $tipopersona, $idCarrera, $estado, $matriculaOriginal);
    }

    if (!$stmt->execute()) {
        throw new Exception('Error al actualizar la persona: ' . $stmt->error);
    }

    // Si se cambió la matrícula, actualizar también en registros_acceso
    if ($matricula !== $matriculaOriginal) {
        $updateRegistrosQuery = "UPDATE registros_acceso SET matricula = ? WHERE matricula = ?";
        $stmtRegistros = $conn->prepare($updateRegistrosQuery);
        $stmtRegistros->bind_param("ss", $matricula, $matriculaOriginal);
        $stmtRegistros->execute();
    }

    echo json_encode([
        'success' => true,
        'message' => 'Persona actualizada exitosamente'
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


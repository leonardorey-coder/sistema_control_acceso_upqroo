<?php
require_once 'config.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

$matricula = $_POST['matricula'] ?? '';
$nombres = $_POST['nombres'] ?? '';
$apellidos = $_POST['apellidos'] ?? '';
$curp = strtoupper($_POST['curp'] ?? '');
$tipo_persona = $_POST['tipo_persona'] ?? '';
$id_carrera = $_POST['id_carrera'] ?? null;

// Validaciones
if (empty($matricula) || empty($nombres) || empty($apellidos) || empty($curp) || empty($tipo_persona)) {
    echo json_encode(['success' => false, 'message' => 'Todos los campos obligatorios deben ser completados']);
    exit;
}

if (!preg_match('/^\d{9}$/', $matricula)) {
    echo json_encode(['success' => false, 'message' => 'La matrícula debe tener 9 dígitos']);
    exit;
}

if (!preg_match('/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$/', $curp)) {
    echo json_encode(['success' => false, 'message' => 'El CURP no tiene el formato correcto']);
    exit;
}

if ($tipo_persona === 'estudiante' && empty($id_carrera)) {
    echo json_encode(['success' => false, 'message' => 'Debe seleccionar una carrera para estudiantes']);
    exit;
}

// Si no es estudiante, establecer id_carrera como NULL
if ($tipo_persona !== 'estudiante') {
    $id_carrera = null;
}

// Verificar si la matrícula ya existe
$stmt_check = $conn->prepare("SELECT matricula FROM personas WHERE matricula = ?");
$stmt_check->bind_param("s", $matricula);
$stmt_check->execute();
$result = $stmt_check->get_result();

if ($result->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'La matrícula ya está registrada en el sistema']);
    exit;
}
$stmt_check->close();

// Procesar foto de perfil
$foto_perfil = null;
if (isset($_FILES['foto_perfil']) && $_FILES['foto_perfil']['error'] === UPLOAD_ERR_OK) {
    $allowed_types = ['image/jpeg', 'image/png', 'image/jpg'];
    $file_type = $_FILES['foto_perfil']['type'];
    
    if (!in_array($file_type, $allowed_types)) {
        echo json_encode(['success' => false, 'message' => 'Solo se permiten imágenes JPG o PNG']);
        exit;
    }
    
    if ($_FILES['foto_perfil']['size'] > 2097152) { // 2MB
        echo json_encode(['success' => false, 'message' => 'La imagen no debe superar los 2MB']);
        exit;
    }
    
    $foto_perfil = file_get_contents($_FILES['foto_perfil']['tmp_name']);
}

// Insertar la persona
$stmt = $conn->prepare("INSERT INTO personas (matricula, nombres, apellidos, curp, id_carrera, foto_perfil, tipo_persona, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')");
$stmt->bind_param("ssssiss", $matricula, $nombres, $apellidos, $curp, $id_carrera, $foto_perfil, $tipo_persona);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true, 
        'message' => 'Persona registrada exitosamente',
        'data' => [
            'matricula' => $matricula,
            'nombres' => $nombres,
            'apellidos' => $apellidos,
            'tipo_persona' => $tipo_persona
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al registrar la persona: ' . $conn->error]);
}

$stmt->close();
$conn->close();
?>

<?php
header('Content-Type: application/json');
require_once 'config.php';

try {
    // Verificar que se recibió la matrícula
    if (!isset($_GET['matricula']) || empty($_GET['matricula'])) {
        echo json_encode([
            'success' => false,
            'message' => 'Matrícula no proporcionada'
        ]);
        exit;
    }

    $matricula = $_GET['matricula'];

    // Validar formato de matrícula
    if (!preg_match('/^\d{9}$/', $matricula)) {
        echo json_encode([
            'success' => false,
            'message' => 'Formato de matrícula inválido'
        ]);
        exit;
    }

    // Buscar la persona en la base de datos
    $stmt = $conn->prepare("
        SELECT 
            p.matricula,
            p.nombres,
            p.apellidos,
            p.curp,
            p.tipo_persona,
            p.estado,
            p.id_carrera,
            c.nombre_carrera
        FROM personas p
        LEFT JOIN carreras c ON p.id_carrera = c.id_carrera
        WHERE p.matricula = ?
    ");
    
    $stmt->bind_param("s", $matricula);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $persona = $result->fetch_assoc();
        
        echo json_encode([
            'success' => true,
            'message' => 'Persona encontrada',
            'data' => $persona
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Persona no encontrada',
            'data' => null
        ]);
    }

    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error al buscar la persona: ' . $e->getMessage()
    ]);
}
?>

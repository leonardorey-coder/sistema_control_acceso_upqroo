<?php
header('Content-Type: application/json');
include 'config.php';

try {
    // Consulta simple para obtener datos de la vista
    $query = "SELECT * FROM registros_hoy";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $resultado = $stmt->get_result();

    $registros = [];
    while ($row = $resultado->fetch_assoc()) {
        // Formatear las fechas si existen
        $hora_entrada = $row['hora_entrada'] ? date('H:i:s', strtotime($row['hora_entrada'])) : null;
        $hora_salida = $row['hora_salida'] ? date('H:i:s', strtotime($row['hora_salida'])) : null;

        $registros[] = [
            'matricula' => $row['matricula'],
            'nombres' => $row['nombres'],
            'apellidos' => $row['apellidos'],
            'nombre_carrera' => $row['nombre_carrera'] ?? 'N/A',
            'hora_entrada' => $hora_entrada,
            'hora_salida' => $hora_salida,
            'admin_entrada' => $row['admin_entrada'],
            'admin_salida' => $row['admin_salida']
        ];
    }

    if (!empty($registros)) {
        echo json_encode([
            'success' => true,
            'data' => $registros
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'No hay registros para el día de hoy'
        ]);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener los registros: ' . $e->getMessage()
    ]);
}

$conn->close();
<?php
require_once 'config.php';
header('Content-Type: application/json');

$sql = "SELECT id_carrera, nombre_carrera FROM carreras ORDER BY id_carrera ASC";
$result = $conn->query($sql);

if ($result) {
    $carreras = [];
    while ($row = $result->fetch_assoc()) {
        $carreras[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $carreras
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener las carreras'
    ]);
}

$conn->close();
?>

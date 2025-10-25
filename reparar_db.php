<?php
require_once 'config.php';

echo "=== Diagnóstico y Reparación de Base de Datos ===\n";

try {
    // 1. Verificar el estado de la tabla registros_acceso
    echo "1. Verificando estado de la tabla registros_acceso...\n";
    $result = $conn->query("CHECK TABLE registros_acceso");
    while ($row = $result->fetch_assoc()) {
        echo "   - {$row['Table']}: {$row['Msg_type']} - {$row['Msg_text']}\n";
    }
    
    // 2. Obtener información sobre AUTO_INCREMENT actual
    echo "\n2. Verificando AUTO_INCREMENT actual...\n";
    $result = $conn->query("SHOW TABLE STATUS LIKE 'registros_acceso'");
    $status = $result->fetch_assoc();
    echo "   - AUTO_INCREMENT actual: " . ($status['Auto_increment'] ?? 'NULL') . "\n";
    
    // 3. Obtener el máximo ID actual
    echo "\n3. Verificando máximo ID en la tabla...\n";
    $result = $conn->query("SELECT MAX(id_registro) as max_id FROM registros_acceso");
    $max_row = $result->fetch_assoc();
    $max_id = $max_row['max_id'] ?? 0;
    echo "   - Máximo ID actual: $max_id\n";
    
    // 4. Reparar la tabla si es necesario
    echo "\n4. Reparando tabla...\n";
    $result = $conn->query("REPAIR TABLE registros_acceso");
    while ($row = $result->fetch_assoc()) {
        echo "   - {$row['Table']}: {$row['Msg_type']} - {$row['Msg_text']}\n";
    }
    
    // 5. Resetear AUTO_INCREMENT
    $new_auto_increment = $max_id + 1;
    echo "\n5. Reseteando AUTO_INCREMENT a $new_auto_increment...\n";
    $conn->query("ALTER TABLE registros_acceso AUTO_INCREMENT = $new_auto_increment");
    
    // 6. Verificar que se aplicó correctamente
    echo "\n6. Verificando cambios...\n";
    $result = $conn->query("SHOW TABLE STATUS LIKE 'registros_acceso'");
    $status = $result->fetch_assoc();
    echo "   - Nuevo AUTO_INCREMENT: " . ($status['Auto_increment'] ?? 'NULL') . "\n";
    
    // 7. Probar inserción
    echo "\n7. Probando inserción de prueba...\n";
    $test_query = "INSERT INTO registros_acceso (matricula, hora_entrada, id_admin_entrada) VALUES ('TEST', NOW(), 1)";
    if ($conn->query($test_query)) {
        $test_id = $conn->insert_id;
        echo "   - Inserción exitosa con ID: $test_id\n";
        
        // Eliminar el registro de prueba
        $conn->query("DELETE FROM registros_acceso WHERE id_registro = $test_id");
        echo "   - Registro de prueba eliminado\n";
    } else {
        echo "   - Error en inserción: " . $conn->error . "\n";
    }
    
    echo "\n=== Reparación completada ===\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
} finally {
    $conn->close();
}
?>

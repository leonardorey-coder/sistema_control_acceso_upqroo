<?php
require_once 'config.php';

// Datos del nuevo administrador
$usuario = 'admin1';
$password = '123';
$nombre = 'Don Prestegui';

// Verificar si el usuario ya existe
$stmt_check = $conn->prepare("SELECT id FROM administradores WHERE usuario = ?");
$stmt_check->bind_param("s", $usuario);
$stmt_check->execute();
$stmt_check->store_result();

if ($stmt_check->num_rows > 0) {
    echo "El usuario '$usuario' ya existe en la base de datos.<br>";
} else {
    // Generar hash de la contraseña
    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Insertar el nuevo administrador
    $stmt_insert = $conn->prepare("INSERT INTO administradores (usuario, password, nombre) VALUES (?, ?, ?)");
    $stmt_insert->bind_param("sss", $usuario, $hash, $nombre);

    if ($stmt_insert->execute()) {
        echo "Administrador creado exitosamente<br>";
        echo "Usuario: " . $usuario . "<br>";
        echo "Contraseña: " . $password . "<br>";
        echo "Hash generado: " . $hash . "<br>";
    } else {
        echo "Error al crear el administrador: " . $conn->error;
    }
}

// Cerrar conexiones
$stmt_check->close();
if (isset($stmt_insert)) $stmt_insert->close();
$conn->close();
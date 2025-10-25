<?php
session_start();
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $matricula = $_POST['matricula'];
    $password = $_POST['password'];

    try {
        $sql = "SELECT * FROM personas WHERE matricula = ? AND tipo_persona = 'administrativo'";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$matricula]);
        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

        // Aquí deberías tener una columna password en tu tabla personas
        // y usar password_verify para comparar contraseñas hasheadas
        if ($usuario && password_verify($password, $usuario['password'])) {
            $_SESSION['logged_in'] = true;
            $_SESSION['usuario_id'] = $usuario['matricula'];
            $_SESSION['tipo_persona'] = $usuario['tipo_persona'];
            $_SESSION['nombre'] = $usuario['nombres'] . ' ' . $usuario['apellidos'];
            
            header('Location: index.php');
            exit;
        } else {
            $_SESSION['error'] = 'Credenciales inválidas';
            header('Location: login.php');
            exit;
        }
    } catch(PDOException $e) {
        $_SESSION['error'] = 'Error al procesar el login';
        header('Location: login.php');
        exit;
    }
}

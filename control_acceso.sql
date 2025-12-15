CREATE DEFINER=`root`@`localhost` PROCEDURE `registrar_entrada` (IN `p_matricula` VARCHAR(10), IN `p_id_admin` INT)  BEGIN
    INSERT INTO registros_acceso (matricula, hora_entrada, id_admin_entrada)
    VALUES (p_matricula, NOW(), p_id_admin);
CREATE DEFINER=`root`@`localhost` PROCEDURE `registrar_salida` (IN `p_matricula` VARCHAR(10), IN `p_id_admin` INT)  BEGIN
    UPDATE registros_acceso 
    SET hora_salida = NOW(),
        id_admin_salida = p_id_admin
    WHERE matricula = p_matricula 
    AND DATE(hora_entrada) = CURRENT_DATE 
    AND hora_salida IS NULL;
  `tipo_persona` enum('estudiante','docente','administrativo','otro','invitado') NOT NULL,
  `notas` text DEFAULT NULL,
  `qr_caduca` tinyint(1) NOT NULL DEFAULT 0,
  `qr_expiracion` datetime DEFAULT NULL,
CREATE TRIGGER `validar_curp_before_insert` BEFORE INSERT ON `personas` FOR EACH ROW BEGIN
    IF LENGTH(NEW.curp) != 18 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La CURP debe tener exactamente 18 caracteres';
    END IF;

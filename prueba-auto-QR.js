// Prueba de escaneo QR
async function testQRScan(matricula) {
    const formData = new FormData();
    formData.append('matricula', matricula);
    formData.append('admin_token', '29c335f9cc3dc791c4b58271f720585c81cbf045ff4ce93927aaa17d7aaa16f8');
    
    const response = await fetch('procesar_qr.php', {
        method: 'POST',
        body: formData
    });
    return await response.json();
}

// Ejecutar pruebas
testQRScan('202300097').then(result => {
    console.log('Resultado completo:', result);
    console.log('Prueba exitosa:', result.success);
    if (!result.success) {
        console.log('Mensaje de error:', result.message);
    }
}).catch(error => {
    console.error('Error en la petición:', error);
});
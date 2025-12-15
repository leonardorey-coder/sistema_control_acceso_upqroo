let html5QrCode = null;
let isScanning = true;

function mostrarAlerta(mensaje, tipo = 'info') {
  const alert = document.getElementById('alert');
  if (!alert) return;
  alert.textContent = mensaje;
  alert.className = `alert alert-${tipo}`;
  alert.style.display = 'block';
  setTimeout(() => {
    alert.style.display = 'none';
  }, 3000);
}

function inicializarScanner() {
  const readerElement = document.getElementById('reader');
  const resultElement = document.getElementById('result');

  if (!readerElement || !resultElement) return;

  html5QrCode = new Html5Qrcode('reader');
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  html5QrCode.start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure)
    .catch(err => {
      console.error('Error al iniciar el escáner:', err);
      resultElement.innerHTML = `
        <div class="resultado-escaneo">
          <div class="estado-container estado-inactivo">
            <h3>Error</h3>
            <p>Error al acceder a la cámara. Por favor, verifique los permisos.</p>
          </div>
        </div>
      `;
    });
}

async function onScanSuccess(decodedText) {
  if (!isScanning) return;
  isScanning = false;
  html5QrCode.pause();
  const continueButton = document.getElementById('continueButton');
  if (continueButton) continueButton.style.display = 'inline-block';

  const resultElement = document.getElementById('result');
  if (!resultElement) return;

  resultElement.innerHTML = `
    <div class="loading"></div>
    <p>Procesando código QR...</p>
  `;

  try {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Inicia sesión como administrador para registrar accesos.');
    }

    const formData = new FormData();
    formData.append('matricula', decodedText);
    formData.append('admin_token', adminToken);

    const response = await fetch('/api/procesar_qr', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();

    if (data.success) {
      const persona = data.data;
      const tipoRegistro = persona.tipo_registro;
      const estadoClase = persona.estado === 'activo' ? 'resultado-activo' : 'resultado-inactivo';

      if (persona.estado === 'inactivo') {
        mostrarAlerta('Esta matrícula está inactiva. Acceso denegado.', 'error');
      }

      resultElement.innerHTML = `
        <div class="resultado-escaneo ${estadoClase}">
          <div class="tipo-registro ${tipoRegistro === 'entrada' ? 'registro-entrada' : 'registro-salida'}">
            ${tipoRegistro === 'entrada' ? 'Entrada Registrada' : 'Salida Registrada'}
          </div>
          <div class="perfil-container">
            ${persona.foto_perfil
              ? `<img width="100" height="100" style="border-radius: 50%; object-fit: cover;" src="data:image/jpeg;base64,${persona.foto_perfil}" alt="Foto de perfil" class="foto-perfil">`
              : `<div class="foto-perfil-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>`
            }
            <div>
              <h3>${persona.nombres} ${persona.apellidos}</h3>
              <p>${persona.tipo_persona.charAt(0).toUpperCase() + persona.tipo_persona.slice(1)}</p>
            </div>
          </div>
          <div class="estado-container ${persona.estado === 'activo' ? 'estado-activo' : 'estado-inactivo'}">
            Estado: ${persona.estado.toUpperCase()}
          </div>
          <div class="datos-personales">
            <div class="campo-dato">
              <strong>Matrícula:</strong>
              <span>${persona.matricula}</span>
            </div>
            <div class="campo-dato">
              <strong>Carrera:</strong>
              <span>${persona.nombre_carrera}</span>
            </div>
          </div>
          <div class="timestamp">
            ${new Date().toLocaleString()}
          </div>
        </div>
      `;
      mostrarAlerta(`${tipoRegistro === 'entrada' ? 'Entrada' : 'Salida'} registrada con éxito`, 'success');
    } else {
      resultElement.innerHTML = `
        <div class="resultado-escaneo resultado-error">
          <div class="estado-container estado-inactivo">
            <h3>Error</h3>
            <p>${data.message}</p>
          </div>
        </div>
      `;
      mostrarAlerta(data.message, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    resultElement.innerHTML = `
      <div class="resultado-escaneo resultado-error">
        <div class="estado-container estado-inactivo">
          <h3>Error</h3>
          <p>${error.message || 'Error al procesar el código QR'}</p>
        </div>
      </div>
    `;
    mostrarAlerta(error.message || 'Error al procesar el código QR', 'error');
  }
}

function onScanFailure() {
  // No mostrar error por cada frame fallido
}

function continuarEscaneo() {
  if (html5QrCode && !isScanning) {
    html5QrCode.resume();
    isScanning = true;
    const continueButton = document.getElementById('continueButton');
    if (continueButton) continueButton.style.display = 'none';
    const resultElement = document.getElementById('result');
    if (resultElement) {
      resultElement.innerHTML = 'Esperando escanear código QR...';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const continueButton = document.getElementById('continueButton');
  if (continueButton) {
    continueButton.addEventListener('click', continuarEscaneo);
  }
  inicializarScanner();
});

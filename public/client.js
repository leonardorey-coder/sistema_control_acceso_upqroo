let html5QrCode = null;
let isScanning = true;
let autoScanTimeout = null;
let autoScanDelay = 3000; // Tiempo por defecto en milisegundos (3 segundos)
let autoScanEnabled = true; // Auto-escaneo habilitado por defecto

function verificarSesionAdmin() {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function inicializarScanner() {
  const resultElement = document.getElementById('result');

  html5QrCode = new Html5Qrcode('reader');

  const config = {
    fps: 10,
    qrbox: function (viewfinderWidth, viewfinderHeight) {
      const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
      const qrboxSize = Math.floor(minEdgeSize * 0.75);
      return {
        width: qrboxSize,
        height: qrboxSize
      };
    },
    aspectRatio: 1.0
  };

  html5QrCode.start(
    { facingMode: 'environment' },
    config,
    onScanSuccess,
    onScanFailure
  ).catch(err => {
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
  document.getElementById('continueButton').style.display = 'inline-block';

  const resultElement = document.getElementById('result');
  resultElement.innerHTML = `
        <div class="loading"></div>
        <p>Procesando código QR...</p>
      `;

  try {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('No hay sesión de administrador activa');
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
        reproducirSonido('error');
      }

      const mensaje = `
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
      resultElement.innerHTML = mensaje;
      mostrarAlerta(`${tipoRegistro === 'entrada' ? 'Entrada' : 'Salida'} registrada con éxito`, 'success');
      reproducirSonido(persona.estado === 'activo' ? 'success' : 'error');
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
      reproducirSonido('error');
    }
  } catch (error) {
    console.error('Error:', error);
    const resultElement = document.getElementById('result');
    resultElement.innerHTML = `
          <div class="resultado-escaneo resultado-error">
            <div class="estado-container estado-inactivo">
              <h3>Error</h3>
              <p>${error.message || 'Error al procesar el código QR'}</p>
            </div>
          </div>
        `;
    mostrarAlerta(error.message || 'Error al procesar el código QR', 'error');
    reproducirSonido('error');
  }

  // Auto-escaneo después del tiempo configurado
  if (autoScanEnabled && autoScanDelay > 0) {
    iniciarAutoScan();
  }
}

// Función para iniciar cuenta regresiva de auto-escaneo
function iniciarAutoScan() {
  // Limpiar timeout anterior si existe
  if (autoScanTimeout) {
    clearTimeout(autoScanTimeout);
  }

  // Mostrar contador en el botón
  const continueButton = document.getElementById('continueButton');
  let secondsLeft = Math.ceil(autoScanDelay / 1000);
  
  const updateButtonText = () => {
    if (continueButton && continueButton.style.display !== 'none') {
      continueButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        Escaneando en ${secondsLeft}s... (o presione para continuar ahora)
      `;
    }
  };

  updateButtonText();
  
  const countdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft > 0) {
      updateButtonText();
    } else {
      clearInterval(countdownInterval);
    }
  }, 1000);

  autoScanTimeout = setTimeout(() => {
    clearInterval(countdownInterval);
    continuarEscaneando();
  }, autoScanDelay);

  // Guardar referencia al interval para limpiarlo si se presiona el botón
  continueButton.countdownInterval = countdownInterval;
}

// Función para continuar escaneando
function continuarEscaneando() {
  if (autoScanTimeout) {
    clearTimeout(autoScanTimeout);
    autoScanTimeout = null;
  }
  
  const continueButton = document.getElementById('continueButton');
  if (continueButton.countdownInterval) {
    clearInterval(continueButton.countdownInterval);
  }
  
  isScanning = true;
  html5QrCode.resume();
  document.getElementById('continueButton').style.display = 'none';
  document.getElementById('result').innerHTML = 'Esperando escanear código QR...';
}

// Función para actualizar el tiempo de auto-escaneo
function actualizarTiempoAutoScan(nuevoTiempo) {
  autoScanDelay = nuevoTiempo;
  localStorage.setItem('autoScanDelay', nuevoTiempo);
  
  const segundos = nuevoTiempo / 1000;
  mostrarAlerta(`Tiempo de auto-escaneo actualizado a ${segundos} segundos`, 'success');
}

// Función para toggle de auto-escaneo
function toggleAutoScan() {
  autoScanEnabled = !autoScanEnabled;
  localStorage.setItem('autoScanEnabled', autoScanEnabled);
  
  const toggleBtn = document.getElementById('autoScanToggle');
  if (toggleBtn) {
    toggleBtn.textContent = autoScanEnabled ? 'Auto-escaneo: ON' : 'Auto-escaneo: OFF';
    toggleBtn.classList.toggle('btn-active', autoScanEnabled);
  }
  
  mostrarAlerta(`Auto-escaneo ${autoScanEnabled ? 'activado' : 'desactivado'}`, 'info');
}

function onScanFailure(error) {
  console.warn(`Error en el escaneo: ${error}`);
}

document.getElementById('continueButton').addEventListener('click', () => {
  continuarEscaneando();
});

function mostrarAlerta(mensaje, tipo) {
  const alertaExistente = document.querySelector('.alerta');
  if (alertaExistente) {
    alertaExistente.remove();
  }

  const alerta = document.createElement('div');
  alerta.className = `alerta alerta-${tipo} alerta-entrada`;

  let icono = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                     <polyline points="20 6 9 17 4 12"/>
                   </svg>`;
  if (tipo === 'error') {
    icono = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                   <circle cx="12" cy="12" r="10"/>
                   <line x1="15" y1="9" x2="9" y2="15"/>
                   <line x1="9" y1="9" x2="15" y2="15"/>
                 </svg>`;
  } else if (tipo === 'info') {
    icono = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                   <circle cx="12" cy="12" r="10"/>
                   <line x1="12" y1="16" x2="12" y2="12"/>
                   <line x1="12" y1="8" x2="12.01" y2="8"/>
                 </svg>`;
  }

  alerta.innerHTML = `
        <span style="display: flex; align-items: center;">${icono}</span>
        <span style="flex-grow: 1;">${mensaje}</span>
        <button onclick="cerrarAlerta(this.parentElement)" style="background: none; border: none; color: white; cursor: pointer; padding: 0 5px; font-size: 18px; line-height: 1;">×</button>
      `;

  document.body.appendChild(alerta);

  const timeoutId = setTimeout(() => {
    cerrarAlerta(alerta);
  }, 3000);

  alerta.addEventListener('mouseenter', () => {
    clearTimeout(timeoutId);
  });

  alerta.addEventListener('mouseleave', () => {
    setTimeout(() => cerrarAlerta(alerta), 2000);
  });
}

function cerrarAlerta(alerta) {
  if (!alerta) return;

  alerta.classList.remove('alerta-entrada');
  alerta.classList.add('alerta-salida');

  setTimeout(() => {
    if (alerta && alerta.parentElement) {
      alerta.remove();
    }
  }, 500);
}

function reproducirSonido(tipo) {
  const sonido = new Audio(tipo === 'success' ? 'success.mp3' : 'error.mp3');
  sonido.play().catch(error => console.log('Error al reproducir sonido:', error));
}

// Cargar configuración guardada
function cargarConfiguracion() {
  const savedDelay = localStorage.getItem('autoScanDelay');
  const savedEnabled = localStorage.getItem('autoScanEnabled');
  
  if (savedDelay !== null) {
    autoScanDelay = parseInt(savedDelay, 10);
  }
  
  if (savedEnabled !== null) {
    autoScanEnabled = savedEnabled === 'true';
  }
  
  // Actualizar UI de configuración si existe
  const delayInput = document.getElementById('autoScanDelayInput');
  if (delayInput) {
    delayInput.value = autoScanDelay / 1000;
  }
  
  const toggleBtn = document.getElementById('autoScanToggle');
  if (toggleBtn) {
    toggleBtn.textContent = autoScanEnabled ? 'Auto-escaneo: ON' : 'Auto-escaneo: OFF';
    toggleBtn.classList.toggle('btn-active', autoScanEnabled);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesionAdmin()) return;
  cargarConfiguracion();
  inicializarScanner();
});

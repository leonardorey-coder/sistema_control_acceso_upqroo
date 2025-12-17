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

  // Inicializar tabs de cliente
  initClientTabs();

  // Inicializar matrícula input
  initMatriculaInput();

  // Inicializar scanner solo si el tab de QR está activo
  const qrTab = document.getElementById('qr-scanner');
  if (qrTab && qrTab.classList.contains('active')) {
    inicializarScanner();
  }
});

// =====================================================
// CLIENT TABS - Navegación entre QR y Matrícula
// =====================================================

function initClientTabs() {
  const tabButtons = document.querySelectorAll('.client-tab-button');
  const tabContents = document.querySelectorAll('.client-tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;

      // Remover active de todos los botones y contenidos
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Activar el tab seleccionado
      button.classList.add('active');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Inicializar scanner si se selecciona el tab QR y no está iniciado
      if (targetTab === 'qr-scanner' && !html5QrCode) {
        inicializarScanner();
      }

      // Pausar scanner si cambiamos a otro tab
      if (targetTab !== 'qr-scanner' && html5QrCode) {
        try {
          html5QrCode.pause();
        } catch (e) {
          console.log('Scanner no estaba corriendo');
        }
      }

      // Reanudar scanner si volvemos al tab QR
      if (targetTab === 'qr-scanner' && html5QrCode && isScanning) {
        try {
          html5QrCode.resume();
        } catch (e) {
          console.log('No se pudo reanudar el scanner');
        }
      }
    });
  });
}

// =====================================================
// MATRÍCULA INPUT - PIN Pad y teclado
// =====================================================

function initMatriculaInput() {
  const matriculaInput = document.getElementById('matriculaInput');
  const pinKeys = document.querySelectorAll('.pin-key');
  const letterKeys = document.querySelectorAll('.letter-key');
  const clearBtn = document.getElementById('clearMatricula');
  const verificarBtn = document.getElementById('verificarMatricula');

  if (!matriculaInput) return;

  // Manejar teclas del PIN pad
  pinKeys.forEach(key => {
    key.addEventListener('click', () => {
      const keyValue = key.dataset.key;
      handlePinKey(keyValue, matriculaInput);

      // Efecto visual de presión
      key.style.transform = 'scale(0.95)';
      setTimeout(() => {
        key.style.transform = '';
      }, 100);
    });
  });

  // Manejar teclas de letras
  letterKeys.forEach(key => {
    key.addEventListener('click', () => {
      const letter = key.dataset.key;
      matriculaInput.value += letter;
      matriculaInput.focus();

      // Efecto visual
      key.style.transform = 'scale(0.9)';
      setTimeout(() => {
        key.style.transform = '';
      }, 100);
    });
  });

  // Botón de limpiar
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      matriculaInput.value = '';
      matriculaInput.focus();
      resetMatriculaResult();
    });
  }

  // Botón de verificar
  if (verificarBtn) {
    verificarBtn.addEventListener('click', verificarMatricula);
  }

  // Enter en el input para verificar
  matriculaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      verificarMatricula();
    }
  });

  // Auto uppercase en el input
  matriculaInput.addEventListener('input', () => {
    matriculaInput.value = matriculaInput.value.toUpperCase();
  });
}

function handlePinKey(keyValue, inputElement) {
  switch (keyValue) {
    case 'backspace':
      inputElement.value = inputElement.value.slice(0, -1);
      break;
    case 'enter':
      verificarMatricula();
      break;
    default:
      if (inputElement.value.length < 15) {
        inputElement.value += keyValue;
      }
      break;
  }
  inputElement.focus();
}

function resetMatriculaResult() {
  const resultEl = document.getElementById('matriculaResult');
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="matricula-result-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <p>Ingresa tu matrícula para verificar acceso</p>
      </div>
    `;
  }
}

async function verificarMatricula() {
  const matriculaInput = document.getElementById('matriculaInput');
  const resultElement = document.getElementById('matriculaResult');
  const verificarBtn = document.getElementById('verificarMatricula');

  if (!matriculaInput || !resultElement) return;

  const matricula = matriculaInput.value.trim().toUpperCase();

  if (!matricula) {
    mostrarAlerta('Por favor ingresa una matrícula', 'error');
    matriculaInput.focus();
    return;
  }

  // Deshabilitar botón durante el proceso
  if (verificarBtn) {
    verificarBtn.disabled = true;
    verificarBtn.innerHTML = `
      <div class="loading"></div>
      Verificando...
    `;
  }

  resultElement.innerHTML = `
    <div style="text-align: center;">
      <div class="loading"></div>
      <p>Procesando matrícula...</p>
    </div>
  `;

  try {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('No hay sesión de administrador activa');
    }

    const formData = new FormData();
    formData.append('matricula', matricula);
    formData.append('admin_token', adminToken);

    const response = await fetch('/api/procesar_qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ matricula, admin_token: adminToken })
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
          ? `<img width="80" height="80" style="border-radius: 50%; object-fit: cover;" src="data:image/jpeg;base64,${persona.foto_perfil}" alt="Foto de perfil" class="foto-perfil">`
          : `<div class="foto-perfil-placeholder" style="width: 80px; height: 80px;">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>`
        }
            <div>
              <h3 style="margin: 0 0 4px 0; font-size: 1.1rem;">${persona.nombres} ${persona.apellidos}</h3>
              <p style="margin: 0; color: #666; font-size: 0.9rem;">${persona.tipo_persona.charAt(0).toUpperCase() + persona.tipo_persona.slice(1)}</p>
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
              <span>${persona.nombre_carrera || 'N/A'}</span>
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

      // Limpiar input después de éxito
      matriculaInput.value = '';

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
    resultElement.innerHTML = `
      <div class="resultado-escaneo resultado-error">
        <div class="estado-container estado-inactivo">
          <h3>Error</h3>
          <p>${error.message || 'Error al procesar la matrícula'}</p>
        </div>
      </div>
    `;
    mostrarAlerta(error.message || 'Error al procesar la matrícula', 'error');
    reproducirSonido('error');
  } finally {
    // Restaurar botón
    if (verificarBtn) {
      verificarBtn.disabled = false;
      verificarBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Verificar Acceso
      `;
    }
    matriculaInput.focus();
  }
}

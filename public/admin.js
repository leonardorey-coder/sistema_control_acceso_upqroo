
// Variables globales
let currentQRCode = null;
let currentHotQRCode = null;
let registrosData = [];
let asistenciasData = [];
let hotQRData = [];
const MODE_SWITCH_CONTAINER = document.querySelector('.mode-switch-container');

// Sistema de tabs
function switchTab(tabName, buttonEl) {
  // Ocultar todos los tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remover clase active de todos los botones
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Mostrar el tab seleccionado
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Activar el botón correspondiente
  const targetButton =
    buttonEl ||
    (typeof event !== 'undefined' ? event?.target?.closest?.('.tab-button') : null);

  if (targetButton) {
    targetButton.classList.add('active');
    try {
      targetButton.focus({ preventScroll: true });
    } catch {
      targetButton.focus();
    }
  }

  // Cargar registros si es necesario
  if (tabName === 'registros') {
    cargarRegistros();
  }

  // Cargar carreras si es el tab del generador
  if (tabName === 'generator') {
    cargarCarreras();
  }

  // Cargar carreras si es el tab de editar
  if (tabName === 'editar') {
    cargarCarrerasEditar();
  }

  // Cargar asistencias si es el tab de asistencias
  if (tabName === 'asistencias') {
    cargarAsistenciasClases();
  }

  // Cargar Hot-QR si es el tab de hotqr
  if (tabName === 'hotqr') {
    cargarHotQRs();
  }
}

// Toggle para fecha de caducidad en formulario de registro
function toggleFechaCaducidad() {
  const switchEl = document.getElementById('fecha_caducidad_switch');
  const fechaGroup = document.getElementById('fecha-caducidad-group');
  const fechaInput = document.getElementById('fecha_caducidad');
  const labelSin = document.getElementById('label-sin-caducidad');
  const labelCon = document.getElementById('label-con-caducidad');

  if (switchEl.checked) {
    fechaGroup.classList.remove('hidden-field');
    labelSin.classList.add('inactive');
    labelCon.classList.remove('inactive');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    fechaInput.min = `${year}-${month}-${day}T${hours}:${minutes}`;
  } else {
    fechaGroup.classList.add('hidden-field');
    fechaInput.value = '';
    labelSin.classList.remove('inactive');
    labelCon.classList.add('inactive');
  }
}

// Toggle para fecha de caducidad en formulario de edición
function toggleFechaCaducidadEditar() {
  const switchEl = document.getElementById('editar-fecha-caducidad-switch');
  const fechaGroup = document.getElementById('editar-fecha-caducidad-group');
  const fechaInput = document.getElementById('editar-fecha-caducidad');
  const labelSin = document.getElementById('label-editar-sin-caducidad');
  const labelCon = document.getElementById('label-editar-con-caducidad');

  if (switchEl.checked) {
    fechaGroup.classList.remove('hidden-field');
    labelSin.classList.add('inactive');
    labelCon.classList.remove('inactive');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    fechaInput.min = `${year}-${month}-${day}T${hours}:${minutes}`;
  } else {
    fechaGroup.classList.add('hidden-field');
    fechaInput.value = '';
    labelSin.classList.remove('inactive');
    labelCon.classList.add('inactive');
  }
}

// Filtrar registros en la tabla
function filtrarRegistros() {
  const searchTerm = document.getElementById('buscar-registro').value.toLowerCase().trim();
  const tbody = document.getElementById('registrosTableBody');
  const filtradosSpan = document.getElementById('registros-filtrados');
  const filtradosCount = document.getElementById('filtrados-count');

  if (!searchTerm) {
    // Mostrar todos los registros
    renderizarRegistros(registrosData);
    filtradosSpan.classList.add('hidden');
    return;
  }

  // Filtrar registros
  const filtrados = registrosData.filter(registro => {
    const matricula = registro.matricula?.toLowerCase() || '';
    const nombres = registro.nombres?.toLowerCase() || '';
    const apellidos = registro.apellidos?.toLowerCase() || '';
    const carrera = registro.nombre_carrera?.toLowerCase() || '';
    const tipo = registro.tipo_persona?.toLowerCase() || '';

    return matricula.includes(searchTerm) ||
      nombres.includes(searchTerm) ||
      apellidos.includes(searchTerm) ||
      carrera.includes(searchTerm) ||
      tipo.includes(searchTerm) ||
      `${nombres} ${apellidos}`.includes(searchTerm);
  });

  renderizarRegistros(filtrados);
  filtradosSpan.classList.remove('hidden');
  filtradosCount.textContent = filtrados.length;
}

// Generador de QR
document.getElementById('qr-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const matricula = document.getElementById('matricula').value;
  const modeSwitch = document.getElementById('modeSwitch');

  // Validación de matrícula
  if (!/^\d{9}$/.test(matricula)) {
    mostrarAlerta('La matrícula debe tener exactamente 9 dígitos', 'error');
    return;
  }

  // Si está en modo "Solo Generar QR", buscar datos y generar
  if (modeSwitch.checked) {
    try {
      // Buscar los datos de la persona por matrícula
      const response = await fetch(`/api/verificar_matricula?matricula=${matricula}`);
      const data = await response.json();

      if (data.success && data.data) {
        // Si existe la persona, usar sus datos
        const persona = data.data;
        generarCodigoQR(
          persona.matricula,
          `${persona.nombres} ${persona.apellidos}`,
          persona.tipo_persona
        );
        mostrarAlerta('Código QR generado exitosamente', 'success');
      } else {
        // Si no existe, generar con datos básicos
        generarCodigoQR(matricula, 'Usuario', 'general');
        mostrarAlerta('Código QR generado (persona no registrada)', 'info');
      }
    } catch (error) {
      console.error('Error al buscar persona:', error);
      // En caso de error, generar con datos básicos
      generarCodigoQR(matricula, 'Usuario', 'general');
      mostrarAlerta('Código QR generado exitosamente', 'success');
    }
    return;
  }

  // Modo "Registrar y Generar QR" - validar todos los campos
  const nombres = document.getElementById('nombres').value;
  const apellidos = document.getElementById('apellidos').value;
  const curp = document.getElementById('curp').value.toUpperCase();
  const tipo_persona = document.getElementById('tipo_persona').value;
  const id_carrera = document.getElementById('id_carrera').value;
  const foto_perfil = document.getElementById('foto_perfil').files[0];
  const notas = document.getElementById('notas').value;
  const fechaCaducidadSwitch = document.getElementById('fecha_caducidad_switch');
  const fecha_caducidad = fechaCaducidadSwitch.checked ? document.getElementById('fecha_caducidad').value : null;

  if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$/.test(curp)) {
    mostrarAlerta('El CURP no tiene el formato correcto', 'error');
    return;
  }

  if (tipo_persona === 'estudiante' && !id_carrera) {
    mostrarAlerta('Debe seleccionar una carrera para estudiantes', 'error');
    return;
  }

  // Validar fecha de caducidad si está activa
  if (fechaCaducidadSwitch.checked && fecha_caducidad) {
    const fechaCaducidadDate = new Date(fecha_caducidad);
    if (fechaCaducidadDate <= new Date()) {
      mostrarAlerta('La fecha de caducidad debe ser una fecha futura', 'error');
      return;
    }
  }

  // Enviar al servidor
  const formData = new FormData();
  formData.append('matricula', matricula);
  formData.append('nombres', nombres);
  formData.append('apellidos', apellidos);
  formData.append('curp', curp);
  formData.append('tipo_persona', tipo_persona);
  formData.append('id_carrera', id_carrera || '');
  formData.append('notas', notas || '');
  if (fecha_caducidad) {
    formData.append('fecha_caducidad', fecha_caducidad);
  }

  if (foto_perfil) {
    formData.append('foto_perfil', foto_perfil);
  }

  try {
    const response = await fetch('/api/registrar_persona', {
      method: 'POST',
      body: formData
    });

    console.log('Respuesta del servidor:', response);

    const data = await response.json();

    if (data.success) {
      mostrarAlerta(data.message, 'success');
      generarCodigoQR(matricula, `${nombres} ${apellidos}`, tipo_persona);
    } else {
      mostrarAlerta(data.message, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    mostrarAlerta('Error al registrar la persona', 'error');
  }
});

function generarCodigoQR(matricula, nombreCompleto, tipo) {
  // Limpiar QR anterior si existe
  const qrcodeElement = document.getElementById('qrcode');
  qrcodeElement.innerHTML = '';

  // Generar nuevo QR
  currentQRCode = new QRCode(qrcodeElement, {
    text: matricula,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // Actualizar información
  document.getElementById('qr-matricula').textContent = matricula;
  document.getElementById('qr-nombre').textContent = nombreCompleto;
  document.getElementById('qr-tipo').textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  document.getElementById('qr-fecha').textContent = new Date().toLocaleString();

  // Mostrar resultado
  document.getElementById('qr-result').classList.add('show');

  // Hacer scroll al resultado
  document.getElementById('qr-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function cargarCarreras() {
  try {
    const response = await fetch('/api/obtener_carreras');
    const data = await response.json();

    if (data.success) {
      const select = document.getElementById('id_carrera');
      select.innerHTML = '<option value="">Seleccione...</option>';

      data.data.forEach(carrera => {
        const option = document.createElement('option');
        option.value = carrera.id_carrera;
        option.textContent = carrera.nombre_carrera;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar carreras:', error);
  }
}

// Mostrar/ocultar campo de carrera según tipo de persona
document.getElementById('tipo_persona').addEventListener('change', function () {
  const carreraGroup = document.getElementById('carrera-group');
  const carreraSelect = document.getElementById('id_carrera');

  if (this.value === 'estudiante') {
    carreraGroup.style.display = 'block';
    carreraSelect.required = true;
  } else {
    carreraGroup.style.display = 'none';
    carreraSelect.required = false;
    carreraSelect.value = '';
  }
});

// Convertir CURP a mayúsculas automáticamente
document.getElementById('curp').addEventListener('input', function (e) {
  this.value = this.value.toUpperCase();
});

function descargarQR() {
  const matricula = document.getElementById('qr-matricula').textContent;
  const nombre = document.getElementById('qr-nombre').textContent;
  const canvas = document.querySelector('#qrcode canvas');

  if (!canvas) {
    mostrarAlerta('No hay código QR para descargar', 'error');
    return;
  }

  // Crear un canvas temporal con información adicional
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');

  // Configurar dimensiones
  tempCanvas.width = 400;
  tempCanvas.height = 500;

  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Agregar logo/título
  ctx.fillStyle = '#FF8C00';
  ctx.fillRect(0, 0, tempCanvas.width, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('UPQROO', tempCanvas.width / 2, 40);

  // Dibujar el QR
  ctx.drawImage(canvas, 72, 80, 256, 256);

  // Agregar información
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Matrícula: ${matricula}`, tempCanvas.width / 2, 370);

  ctx.font = '16px Arial';
  ctx.fillText(nombre, tempCanvas.width / 2, 400);

  // Fecha
  ctx.font = '12px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText(new Date().toLocaleDateString(), tempCanvas.width / 2, 450);

  // Crear enlace de descarga
  const link = document.createElement('a');
  link.download = `QR_${matricula}_${Date.now()}.png`;
  link.href = tempCanvas.toDataURL();
  link.click();

  mostrarAlerta('Código QR descargado exitosamente', 'success');
}

function limpiarFormulario() {
  document.getElementById('qr-form').reset();
  document.getElementById('qr-result').classList.remove('show');
  document.getElementById('carrera-group').style.display = 'none';
  document.getElementById('fecha-caducidad-group').classList.add('hidden-field');
  document.getElementById('fecha_caducidad_switch').checked = false;
  currentQRCode = null;
}

// Funciones de utilidad
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

// Función para cargar registros
async function cargarRegistros() {
  const registrosTableBody = document.getElementById('registrosTableBody');
  const registrosCount = document.getElementById('registros-count');
  const searchInput = document.getElementById('buscar-registro');

  // Limpiar búsqueda
  if (searchInput) searchInput.value = '';
  document.getElementById('registros-filtrados')?.classList.add('hidden');

  try {
    const response = await fetch('/api/obtener_registros');
    const data = await response.json();

    if (data.success) {
      registrosData = data.data; // Guardar para filtrado
      registrosCount.textContent = `${registrosData.length} registros`;
      renderizarRegistros(registrosData);
    } else {
      registrosData = [];
      registrosCount.textContent = '0 registros';
      registrosTableBody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; padding: 20px;">
                No hay registros para el día de hoy
              </td>
            </tr>
          `;
    }
  } catch (error) {
    console.error('Error al obtener los registros:', error);
    registrosData = [];
    registrosTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 20px; color: #dc3545;">
              Error al cargar los registros
            </td>
          </tr>
        `;
  }
}

// Función para renderizar registros en la tabla
function renderizarRegistros(registros) {
  const registrosTableBody = document.getElementById('registrosTableBody');
  registrosTableBody.innerHTML = '';

  if (registros.length === 0) {
    registrosTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px;">
          No se encontraron registros
        </td>
      </tr>
    `;
    return;
  }

  registros.forEach(registro => {
    const row = document.createElement('tr');
    const tipoPersonaLabel = {
      'estudiante': 'Estudiante',
      'docente': 'Docente',
      'administrativo': 'Admin.',
      'invitado': 'Invitado',
      'otro': 'Otro'
    };

    // Determinar el estado del registro
    let estadoHTML = '';
    if (registro.salida_automatica) {
      estadoHTML = `<span class="estado-registro salida-auto">Salida Auto.</span>`;
    } else if (registro.hora_salida) {
      estadoHTML = `<span class="estado-registro salida">Completado</span>`;
    } else {
      estadoHTML = `<span class="estado-registro entrada">En curso</span>`;
    }

    row.innerHTML = `
      <td data-label="Matricula">${registro.matricula}</td>
      <td data-label="Nombre">${registro.nombres} ${registro.apellidos}</td>
      <td data-label="Tipo">
        <span class="badge badge-${registro.tipo_persona || 'otro'}">
          ${tipoPersonaLabel[registro.tipo_persona] || 'Otro'}
        </span>
      </td>
      <td data-label="Carrera">${registro.nombre_carrera || 'N/A'}</td>
      <td data-label="Entrada" class="tiempo-columna">
        ${registro.hora_entrada || 'N/A'}
        ${registro.admin_entrada ?
        `<span class="admin-nombre">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${registro.admin_entrada}
          </span>` :
        ''}
      </td>
      <td data-label="Salida" class="tiempo-columna">
        ${registro.hora_salida || 'N/A'}
        ${registro.admin_salida ?
        `<span class="admin-nombre">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${registro.admin_salida}
          </span>` :
        ''}
      </td>
      <td data-label="Estado">${estadoHTML}</td>
    `;
    registrosTableBody.appendChild(row);
  });
}

// Funciones de sesión
function verificarSesionAdmin() {
  const token = localStorage.getItem('adminToken');
  const nombre = localStorage.getItem('adminNombre');

  if (!token) {
    window.location.href = 'login.html';
    return false;
  }

  // Obtener iniciales del nombre
  const iniciales = nombre.split(' ').map(n => n.charAt(0).toUpperCase()).join('').substring(0, 2);

  const adminSection = document.getElementById('adminSection');
  adminSection.innerHTML = `
        <div class="admin-info">
          <div class="admin-avatar">${iniciales}</div>
          <span class="admin-name">${nombre}</span>
        </div>
        <button onclick="cerrarSesion()" class="logout-button">Cerrar Sesión</button>
      `;

  return true;
}

function cerrarSesion() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminNombre');
  localStorage.removeItem('adminUsuario');
  window.location.href = 'login.html';
}

// Validación de entrada de matrícula
document.getElementById('matricula').addEventListener('input', function (e) {
  this.value = this.value.replace(/\D/g, '');
});

// Mode Switch Functionality
function toggleMode() {
  const modeSwitch = document.getElementById('modeSwitch');
  const labelRegistro = document.getElementById('label-registro');
  const labelQr = document.getElementById('label-qr');
  const submitButton = document.querySelector('#qr-form .btn-primary');
  const container = document.querySelector('.qr-generator-container');

  // Obtener todos los campos excepto matrícula
  const nombresGroup = document.getElementById('nombres').closest('.form-group');
  const apellidosGroup = document.getElementById('apellidos').closest('.form-group');
  const curpGroup = document.getElementById('curp').closest('.form-group');
  const tipoPersonaGroup = document.getElementById('tipo_persona').closest('.form-group');
  const carreraGroup = document.getElementById('carrera-group');
  const fotoGroup = document.getElementById('foto_perfil').closest('.form-group');

  if (modeSwitch.checked) {
    // Solo Generar mode
    labelRegistro.classList.add('inactive');
    labelQr.classList.remove('inactive');
    submitButton.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
          </svg>
          Solo Generar
        `;
    container.classList.add('qr-only-mode');

    // Ocultar campos y remover required
    nombresGroup.classList.add('hidden-field');
    apellidosGroup.classList.add('hidden-field');
    curpGroup.classList.add('hidden-field');
    tipoPersonaGroup.classList.add('hidden-field');
    carreraGroup.classList.add('hidden-field');
    fotoGroup.classList.add('hidden-field');

    document.getElementById('nombres').removeAttribute('required');
    document.getElementById('apellidos').removeAttribute('required');
    document.getElementById('curp').removeAttribute('required');
    document.getElementById('tipo_persona').removeAttribute('required');
  } else {
    // Registrar y Generar mode
    labelRegistro.classList.remove('inactive');
    labelQr.classList.add('inactive');
    submitButton.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Registrar y Generar
        `;
    container.classList.remove('qr-only-mode');

    // Mostrar campos y restaurar required
    nombresGroup.classList.remove('hidden-field');
    apellidosGroup.classList.remove('hidden-field');
    curpGroup.classList.remove('hidden-field');
    tipoPersonaGroup.classList.remove('hidden-field');
    fotoGroup.classList.remove('hidden-field');

    document.getElementById('nombres').setAttribute('required', 'required');
    document.getElementById('apellidos').setAttribute('required', 'required');
    document.getElementById('curp').setAttribute('required', 'required');
    document.getElementById('tipo_persona').setAttribute('required', 'required');

    // Carrera group se maneja por el tipo de persona
    const tipoPersona = document.getElementById('tipo_persona').value;
    if (tipoPersona === 'estudiante') {
      carreraGroup.classList.remove('hidden-field');
    }
  }
}

MODE_SWITCH_CONTAINER.addEventListener('click', (e) => {
  const CHECKBOX_INPUT = document.getElementById('modeSwitch');
  if (e.target.id === 'label-registro' && e.target.classList.contains('inactive')) {
    CHECKBOX_INPUT.checked = false;
    toggleMode();
  } else if (e.target.id === 'label-qr' && e.target.classList.contains('inactive')) {
    CHECKBOX_INPUT.checked = true;
    toggleMode();
  }
});

// Event listeners para caducidad switches (formulario de registro)
document.addEventListener('DOMContentLoaded', () => {
  const caducidadContainers = document.querySelectorAll('.caducidad-switch-container');

  caducidadContainers.forEach(container => {
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('switch-label') && e.target.classList.contains('inactive')) {
        const switchInput = container.querySelector('input[type="checkbox"]');
        if (switchInput) {
          switchInput.checked = !switchInput.checked;
          switchInput.dispatchEvent(new Event('change'));
        }
      }
    });
  });
});

// Funciones para editar persona
async function buscarPersona() {
  const matricula = document.getElementById('buscar-matricula').value.trim();

  if (!matricula) {
    mostrarAlerta('Por favor ingrese una matrícula', 'error');
    return;
  }

  if (!/^\d{9}$/.test(matricula)) {
    mostrarAlerta('La matrícula debe tener exactamente 9 dígitos', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/verificar_matricula?matricula=${matricula}`);
    const data = await response.json();

    if (data.success && data.data) {
      cargarDatosPersona(data.data);
      mostrarAlerta('Persona encontrada', 'success');
    } else {
      mostrarAlerta('No se encontró ninguna persona con esa matrícula', 'error');
      document.getElementById('editar-form-container').style.display = 'none';
    }
  } catch (error) {
    console.error('Error:', error);
    mostrarAlerta('Error al buscar la persona', 'error');
  }
}

function cargarDatosPersona(persona) {
  // Cargar carreras si es necesario
  cargarCarrerasEditar();

  // Guardar matrícula original
  document.getElementById('editar-matricula-original').value = persona.matricula;

  // Llenar campos del formulario
  document.getElementById('editar-matricula').value = persona.matricula;
  document.getElementById('editar-nombres').value = persona.nombres;
  document.getElementById('editar-apellidos').value = persona.apellidos;
  document.getElementById('editar-curp').value = persona.curp;
  document.getElementById('editar-tipo-persona').value = persona.tipo_persona;
  document.getElementById('editar-estado').value = persona.estado;

  // Manejar campo de carrera
  const carreraGroup = document.getElementById('editar-carrera-group');
  const carreraSelect = document.getElementById('editar-id-carrera');

  if (persona.tipo_persona === 'estudiante') {
    carreraGroup.style.display = 'block';
    carreraSelect.required = true;
    if (persona.id_carrera) {
      setTimeout(() => {
        carreraSelect.value = persona.id_carrera;
      }, 100);
    }
  } else {
    carreraGroup.style.display = 'none';
    carreraSelect.required = false;
  }

  // Cargar notas
  document.getElementById('editar-notas').value = persona.notas || '';

  // Manejar fecha de caducidad
  const fechaCaducidadSwitch = document.getElementById('editar-fecha-caducidad-switch');
  const fechaCaducidadGroup = document.getElementById('editar-fecha-caducidad-group');
  const fechaCaducidadInput = document.getElementById('editar-fecha-caducidad');
  const labelEditarSin = document.getElementById('label-editar-sin-caducidad');
  const labelEditarCon = document.getElementById('label-editar-con-caducidad');

  if (persona.fecha_caducidad_qr) {
    fechaCaducidadSwitch.checked = true;
    fechaCaducidadGroup.classList.remove('hidden-field');
    labelEditarSin.classList.add('inactive');
    labelEditarCon.classList.remove('inactive');
    const fecha = new Date(persona.fecha_caducidad_qr);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const hours = String(fecha.getHours()).padStart(2, '0');
    const minutes = String(fecha.getMinutes()).padStart(2, '0');
    fechaCaducidadInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
  } else {
    fechaCaducidadSwitch.checked = false;
    fechaCaducidadGroup.classList.add('hidden-field');
    fechaCaducidadInput.value = '';
    labelEditarSin.classList.remove('inactive');
    labelEditarCon.classList.add('inactive');
  }

  // Mostrar foto actual si existe
  if (persona.foto_perfil) {
    document.getElementById('foto-actual-container').style.display = 'block';
    document.getElementById('foto-actual-preview').src = `data:image/jpeg;base64,${persona.foto_perfil}`;
  } else {
    document.getElementById('foto-actual-container').style.display = 'none';
  }

  // Mostrar formulario
  document.getElementById('editar-form-container').style.display = 'block';
  document.getElementById('editar-form-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function cargarCarrerasEditar() {
  try {
    const response = await fetch('/api/obtener_carreras');
    const data = await response.json();

    if (data.success) {
      const select = document.getElementById('editar-id-carrera');
      select.innerHTML = '<option value="">Seleccione...</option>';

      data.data.forEach(carrera => {
        const option = document.createElement('option');
        option.value = carrera.id_carrera;
        option.textContent = carrera.nombre_carrera;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar carreras:', error);
  }
}

function cancelarEdicion() {
  document.getElementById('editar-form').reset();
  document.getElementById('editar-form-container').style.display = 'none';
  document.getElementById('buscar-matricula').value = '';
  document.getElementById('foto-actual-container').style.display = 'none';
}

// Manejar cambio de tipo de persona en formulario de edición
document.getElementById('editar-tipo-persona').addEventListener('change', function () {
  const carreraGroup = document.getElementById('editar-carrera-group');
  const carreraSelect = document.getElementById('editar-id-carrera');

  if (this.value === 'estudiante') {
    carreraGroup.style.display = 'block';
    carreraSelect.required = true;
  } else {
    carreraGroup.style.display = 'none';
    carreraSelect.required = false;
    carreraSelect.value = '';
  }
});

// Convertir CURP a mayúsculas en formulario de edición
document.getElementById('editar-curp').addEventListener('input', function (e) {
  this.value = this.value.toUpperCase();
});

// Validar solo números en matrícula de búsqueda
document.getElementById('buscar-matricula').addEventListener('input', function (e) {
  this.value = this.value.replace(/\D/g, '');
});

// Validar solo números en matrícula de edición
document.getElementById('editar-matricula').addEventListener('input', function (e) {
  this.value = this.value.replace(/\D/g, '');
});

// Permitir buscar con Enter
document.getElementById('buscar-matricula').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    buscarPersona();
  }
});

// Manejar submit del formulario de edición
document.getElementById('editar-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const matriculaOriginal = document.getElementById('editar-matricula-original').value;
  const matricula = document.getElementById('editar-matricula').value;
  const nombres = document.getElementById('editar-nombres').value;
  const apellidos = document.getElementById('editar-apellidos').value;
  const curp = document.getElementById('editar-curp').value.toUpperCase();
  const tipo_persona = document.getElementById('editar-tipo-persona').value;
  const id_carrera = document.getElementById('editar-id-carrera').value;
  const estado = document.getElementById('editar-estado').value;
  const foto_perfil = document.getElementById('editar-foto-perfil').files[0];
  const notas = document.getElementById('editar-notas').value;
  const fechaCaducidadSwitch = document.getElementById('editar-fecha-caducidad-switch');
  const fecha_caducidad = fechaCaducidadSwitch.checked ? document.getElementById('editar-fecha-caducidad').value : null;

  // Validaciones
  if (!/^\d{9}$/.test(matricula)) {
    mostrarAlerta('La matrícula debe tener exactamente 9 dígitos', 'error');
    return;
  }

  if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$/.test(curp)) {
    mostrarAlerta('El CURP no tiene el formato correcto', 'error');
    return;
  }

  if (tipo_persona === 'estudiante' && !id_carrera) {
    mostrarAlerta('Debe seleccionar una carrera para estudiantes', 'error');
    return;
  }

  // Enviar al servidor
  const formData = new FormData();
  formData.append('matricula_original', matriculaOriginal);
  formData.append('matricula', matricula);
  formData.append('nombres', nombres);
  formData.append('apellidos', apellidos);
  formData.append('curp', curp);
  formData.append('tipo_persona', tipo_persona);
  formData.append('id_carrera', id_carrera || '');
  formData.append('estado', estado);
  formData.append('notas', notas || '');
  if (fecha_caducidad) {
    formData.append('fecha_caducidad', fecha_caducidad);
  } else {
    formData.append('fecha_caducidad', ''); // Limpiar fecha si se desactiva
  }

  if (foto_perfil) {
    formData.append('foto_perfil', foto_perfil);
  }

  try {
    const response = await fetch('/api/editar_persona', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      mostrarAlerta(data.message, 'success');
      // Recargar datos actualizados
      setTimeout(() => {
        document.getElementById('buscar-matricula').value = matricula;
        buscarPersona();
      }, 500);
    } else {
      mostrarAlerta(data.message, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    mostrarAlerta('Error al actualizar la persona', 'error');
  }
});

// Funciones de configuración de auto-escaneo
function actualizarTiempoAutoScan(nuevoTiempo) {
  localStorage.setItem('autoScanDelay', nuevoTiempo);
  const segundos = nuevoTiempo / 1000;
  mostrarAlerta(`Tiempo de auto-escaneo actualizado a ${segundos} segundos`, 'success');
}

function toggleAutoScan() {
  const currentState = localStorage.getItem('autoScanEnabled');
  const newState = currentState === 'false' ? 'true' : 'false';
  localStorage.setItem('autoScanEnabled', newState);

  const toggleBtn = document.getElementById('autoScanToggle');
  if (toggleBtn) {
    const isEnabled = newState === 'true';
    toggleBtn.classList.toggle('active-status', isEnabled);
    toggleBtn.classList.toggle('inactive-status', !isEnabled);

    const statusText = toggleBtn.querySelector('.status-text');
    if (statusText) {
      statusText.innerHTML = isEnabled
        ? 'Auto-escaneo: <strong>Activado</strong>'
        : 'Auto-escaneo: <strong>Desactivado</strong>';
    }
  }

  mostrarAlerta(
    `Auto-escaneo ${newState === 'true' ? 'activado' : 'desactivado'}`,
    'info'
  );
}

function cargarConfiguracion() {
  const savedDelay = localStorage.getItem('autoScanDelay');
  const savedEnabled = localStorage.getItem('autoScanEnabled');

  const delayInput = document.getElementById('autoScanDelayInput');
  if (delayInput && savedDelay !== null) {
    delayInput.value = parseInt(savedDelay, 10) / 1000;
  }

  const toggleBtn = document.getElementById('autoScanToggle');
  if (toggleBtn) {
    const isEnabled = savedEnabled !== 'false';
    toggleBtn.classList.toggle('active-status', isEnabled);
    toggleBtn.classList.toggle('inactive-status', !isEnabled);

    const statusText = toggleBtn.querySelector('.status-text');
    if (statusText) {
      statusText.innerHTML = isEnabled
        ? 'Auto-escaneo: <strong>Activado</strong>'
        : 'Auto-escaneo: <strong>Desactivado</strong>';
    }
  }
}

// =====================================================
// FUNCIONES PARA TAB DE ASISTENCIAS A CLASES
// =====================================================

// Función para cargar asistencias a clases
async function cargarAsistenciasClases() {
  const asistenciasTableBody = document.getElementById('asistenciasTableBody');
  const asistenciasCount = document.getElementById('asistencias-count');
  const searchInput = document.getElementById('buscar-asistencia');

  // Limpiar búsqueda
  if (searchInput) searchInput.value = '';
  document.getElementById('asistencias-filtrados')?.classList.add('hidden');

  try {
    const response = await fetch('/api/obtener_asistencias_clases');
    const data = await response.json();

    if (data.success) {
      asistenciasData = data.data;
      asistenciasCount.textContent = `${asistenciasData.length} asistencia${asistenciasData.length !== 1 ? 's' : ''}`;
      renderizarAsistencias(asistenciasData);
    } else {
      asistenciasData = [];
      asistenciasCount.textContent = '0 asistencias';
      asistenciasTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px;">
            No hay asistencias a clases registradas para el día de hoy
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Error al obtener asistencias:', error);
    asistenciasData = [];
    asistenciasTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px; color: #dc3545;">
          Error al cargar las asistencias
        </td>
      </tr>
    `;
  }
}

// Función para renderizar asistencias en la tabla
function renderizarAsistencias(asistencias) {
  const asistenciasTableBody = document.getElementById('asistenciasTableBody');
  asistenciasTableBody.innerHTML = '';

  if (asistencias.length === 0) {
    asistenciasTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px;">
          No se encontraron asistencias
        </td>
      </tr>
    `;
    return;
  }

  asistencias.forEach(asistencia => {
    const row = document.createElement('tr');

    // Determinar clase de color según porcentaje de asistencia
    let porcentajeClass = 'porcentaje-bajo';
    if (asistencia.porcentaje_asistencia >= 80) {
      porcentajeClass = 'porcentaje-alto';
    } else if (asistencia.porcentaje_asistencia >= 60) {
      porcentajeClass = 'porcentaje-medio';
    }

    // Determinar el estado del registro
    let estadoHTML = '';
    if (asistencia.salida_automatica) {
      estadoHTML = `<span class="estado-registro salida-auto">Salida Auto.</span>`;
    } else if (asistencia.hora_salida) {
      estadoHTML = `<span class="estado-registro salida">Completado</span>`;
    } else {
      estadoHTML = `<span class="estado-registro entrada">En clase</span>`;
    }

    // Formatear horario de clase
    const horarioClase = `${asistencia.hora_inicio_clase} - ${asistencia.hora_fin_clase}`;

    row.innerHTML = `
      <td data-label="Matrícula">${asistencia.matricula}</td>
      <td data-label="Estudiante">${asistencia.nombres} ${asistencia.apellidos}</td>
      <td data-label="Materia">
        <div class="materia-info">
          <span class="materia-nombre">${asistencia.nombre_materia}</span>
          <span class="materia-clave">${asistencia.clave_materia}</span>
        </div>
      </td>
      <td data-label="Horario" class="horario-columna">
        ${horarioClase}
        ${asistencia.aula && asistencia.aula !== 'N/A' ?
        `<span class="aula-info">Aula: ${asistencia.aula}</span>` : ''}
      </td>
      <td data-label="Entrada">${asistencia.hora_entrada || 'N/A'}</td>
      <td data-label="Asistencia">
        <span class="porcentaje-badge ${porcentajeClass}">
          ${asistencia.porcentaje_asistencia.toFixed(0)}%
        </span>
        <span class="minutos-info">${asistencia.minutos_asistidos}/${asistencia.minutos_totales_clase} min</span>
      </td>
      <td data-label="Estado">${estadoHTML}</td>
    `;
    asistenciasTableBody.appendChild(row);
  });
}

// Filtrar asistencias en la tabla
function filtrarAsistencias() {
  const searchTerm = document.getElementById('buscar-asistencia').value.toLowerCase().trim();
  const filtradosSpan = document.getElementById('asistencias-filtrados');
  const filtradosCount = document.getElementById('asistencias-filtrados-count');

  if (!searchTerm) {
    // Mostrar todas las asistencias
    renderizarAsistencias(asistenciasData);
    filtradosSpan.classList.add('hidden');
    return;
  }

  // Filtrar asistencias
  const filtrados = asistenciasData.filter(asistencia => {
    const matricula = asistencia.matricula?.toLowerCase() || '';
    const nombres = asistencia.nombres?.toLowerCase() || '';
    const apellidos = asistencia.apellidos?.toLowerCase() || '';
    const materia = asistencia.nombre_materia?.toLowerCase() || '';
    const clave = asistencia.clave_materia?.toLowerCase() || '';

    return matricula.includes(searchTerm) ||
      nombres.includes(searchTerm) ||
      apellidos.includes(searchTerm) ||
      materia.includes(searchTerm) ||
      clave.includes(searchTerm) ||
      `${nombres} ${apellidos}`.includes(searchTerm);
  });

  renderizarAsistencias(filtrados);
  filtradosSpan.classList.remove('hidden');
  filtradosCount.textContent = filtrados.length;
}

// =====================================================
// FUNCIONES PARA TAB DE HOT-QR
// =====================================================

document.getElementById('hotqr-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const nombre = document.getElementById('hotqr-nombre').value.trim();
  const motivo = document.getElementById('hotqr-motivo').value.trim();
  const duracion = document.getElementById('hotqr-duracion').value;
  const adminToken = localStorage.getItem('adminToken');

  if (!nombre) {
    mostrarAlerta('El nombre del visitante es requerido', 'error');
    return;
  }

  try {
    const response = await fetch('/api/crear_hot_qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_visitante: nombre,
        motivo: motivo || null,
        duracion_minutos: duracion,
        admin_token: adminToken
      })
    });

    const data = await response.json();

    if (data.success) {
      mostrarAlerta('Hot-QR creado exitosamente', 'success');
      mostrarResultadoHotQR(data.data);
      cargarHotQRs();
    } else {
      mostrarAlerta(data.message, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    mostrarAlerta('Error al crear Hot-QR', 'error');
  }
});

function mostrarResultadoHotQR(data) {
  const qrcodeElement = document.getElementById('hotqr-qrcode');
  qrcodeElement.innerHTML = '';

  currentHotQRCode = new QRCode(qrcodeElement, {
    text: data.codigo,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('hotqr-codigo').textContent = data.codigo;
  document.getElementById('hotqr-visitante').textContent = data.nombre_visitante;
  document.getElementById('hotqr-motivo-display').textContent = data.motivo || 'Sin especificar';

  const fechaExp = new Date(data.fecha_expiracion);
  document.getElementById('hotqr-expira').textContent = fechaExp.toLocaleString();

  document.getElementById('hotqr-result').classList.add('show');
  document.getElementById('hotqr-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function limpiarFormularioHotQR() {
  document.getElementById('hotqr-form').reset();
  document.getElementById('hotqr-result').classList.remove('show');
  currentHotQRCode = null;
}

function descargarHotQR() {
  const codigo = document.getElementById('hotqr-codigo').textContent;
  const visitante = document.getElementById('hotqr-visitante').textContent;
  const expira = document.getElementById('hotqr-expira').textContent;
  const canvas = document.querySelector('#hotqr-qrcode canvas');

  if (!canvas) {
    mostrarAlerta('No hay Hot-QR para descargar', 'error');
    return;
  }

  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');

  tempCanvas.width = 400;
  tempCanvas.height = 550;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Header con gradiente naranja
  const gradient = ctx.createLinearGradient(0, 0, tempCanvas.width, 0);
  gradient.addColorStop(0, '#FF8C00');
  gradient.addColorStop(1, '#FFA500');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, tempCanvas.width, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QR-UPQROO', tempCanvas.width / 2, 45);

  // QR
  ctx.drawImage(canvas, 72, 90, 256, 256);

  // Info
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Codigo: ${codigo}`, tempCanvas.width / 2, 375);

  ctx.font = '14px Arial';
  ctx.fillText(`Visitante: ${visitante}`, tempCanvas.width / 2, 405);

  ctx.fillStyle = '#dc3545';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`Expira: ${expira}`, tempCanvas.width / 2, 435);

  // Footer
  ctx.fillStyle = '#666666';
  ctx.font = '12px Arial';
  ctx.fillText('UPQROO - Sistema de Control de Acceso', tempCanvas.width / 2, 500);
  ctx.fillText('Este QR es de un solo uso', tempCanvas.width / 2, 520);

  const link = document.createElement('a');
  link.download = `HotQR_${codigo}_${Date.now()}.png`;
  link.href = tempCanvas.toDataURL();
  link.click();

  mostrarAlerta('Hot-QR descargado exitosamente', 'success');
}

async function compartirHotQR() {
  const codigo = document.getElementById('hotqr-codigo').textContent;
  const visitante = document.getElementById('hotqr-visitante').textContent;
  const expira = document.getElementById('hotqr-expira').textContent;
  const canvas = document.querySelector('#hotqr-qrcode canvas');

  if (!codigo || !canvas) {
    mostrarAlerta('No hay Hot-QR para compartir', 'error');
    return;
  }

  const mensaje = `Acceso UPQROO\n\nVisitante: ${visitante}\nCodigo: ${codigo}\nExpira: ${expira}\n\nEscanea el codigo QR o ingresa manualmente el codigo en el sistema de acceso.`;

  // Generar imagen del QR
  const qrImageDataUrl = await generarImagenQRCompartir(canvas, codigo, visitante, expira);

  const shareModal = document.createElement('div');
  shareModal.className = 'share-modal-overlay';
  shareModal.innerHTML = `
    <div class="share-modal">
      <div class="share-modal-header">
        <h3>Compartir Hot-QR</h3>
        <button onclick="cerrarModalCompartir()" class="close-modal-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="share-modal-body">
        <div class="share-code-display">
          <div class="share-code-label">Codigo de acceso:</div>
          <div class="share-code-value">${codigo}</div>
        </div>
        <div class="share-options">
          <button onclick="compartirWhatsAppConImagen()" class="share-btn whatsapp">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <button onclick="compartirEmailConImagen()" class="share-btn email">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Email
          </button>
          <button onclick="compartirSMS('${encodeURIComponent(mensaje)}')" class="share-btn sms">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            SMS
          </button>
          <button onclick="copiarCodigo('${codigo}')" class="share-btn copy">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copiar Codigo
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(shareModal);
  
  // Guardar la imagen en el modal para acceso posterior
  shareModal.dataset.qrImage = qrImageDataUrl;
  shareModal.dataset.mensaje = mensaje;
  
  setTimeout(() => shareModal.classList.add('show'), 10);
}

async function generarImagenQRCompartir(canvas, codigo, visitante, expira) {
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');

  tempCanvas.width = 400;
  tempCanvas.height = 550;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  const gradient = ctx.createLinearGradient(0, 0, tempCanvas.width, 0);
  gradient.addColorStop(0, '#FF8C00');
  gradient.addColorStop(1, '#FFA500');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, tempCanvas.width, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QR-UPQROO', tempCanvas.width / 2, 45);

  ctx.drawImage(canvas, 72, 90, 256, 256);

  ctx.fillStyle = '#333333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Codigo: ${codigo}`, tempCanvas.width / 2, 375);

  ctx.font = '14px Arial';
  ctx.fillText(`Visitante: ${visitante}`, tempCanvas.width / 2, 405);

  ctx.fillStyle = '#dc3545';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`Expira: ${expira}`, tempCanvas.width / 2, 435);

  ctx.fillStyle = '#666666';
  ctx.font = '12px Arial';
  ctx.fillText('UPQROO - Sistema de Control de Acceso', tempCanvas.width / 2, 500);
  ctx.fillText('Este QR es de un solo uso', tempCanvas.width / 2, 520);

  return tempCanvas.toDataURL('image/png');
}

function cerrarModalCompartir() {
  const modal = document.querySelector('.share-modal-overlay');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

async function compartirWhatsAppConImagen() {
  const modal = document.querySelector('.share-modal-overlay');
  const qrImageDataUrl = modal.dataset.qrImage;
  const mensaje = decodeURIComponent(modal.dataset.mensaje);
  const codigo = document.getElementById('hotqr-codigo').textContent;

  try {
    const blob = await fetch(qrImageDataUrl).then(r => r.blob());
    const fileName = `HotQR_${codigo}_${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Detectar si es iOS/macOS y si soporta compartir archivos
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      // En móvil, usar Web Share API
      await navigator.share({
        title: 'Acceso UPQROO',
        text: mensaje,
        files: [file]
      });
      cerrarModalCompartir();
    } else {
      // En desktop (macOS/Windows/Linux), descargar y abrir WhatsApp Web
      const link = document.createElement('a');
      link.href = qrImageDataUrl;
      link.download = fileName;
      link.click();
      
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}%0A%0A(La imagen del QR se ha descargado, adjuntala manualmente)`, '_blank');
      }, 500);
      cerrarModalCompartir();
    }
  } catch (error) {
    console.error('Error al compartir:', error);
    mostrarAlerta('Descargando QR, compartelo manualmente', 'info');
    const link = document.createElement('a');
    link.href = qrImageDataUrl;
    link.download = `HotQR_${codigo}_${Date.now()}.png`;
    link.click();
    cerrarModalCompartir();
  }
}

async function compartirEmailConImagen() {
  const modal = document.querySelector('.share-modal-overlay');
  const qrImageDataUrl = modal.dataset.qrImage;
  const mensaje = decodeURIComponent(modal.dataset.mensaje);
  const codigo = document.getElementById('hotqr-codigo').textContent;

  try {
    const blob = await fetch(qrImageDataUrl).then(r => r.blob());
    const fileName = `HotQR_${codigo}_${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Detectar si es iOS/macOS y si soporta compartir archivos
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      // En móvil, usar Web Share API
      await navigator.share({
        title: 'Acceso UPQROO',
        text: mensaje,
        files: [file]
      });
      cerrarModalCompartir();
    } else {
      // En desktop (macOS/Windows/Linux), descargar y abrir Mail.app
      const link = document.createElement('a');
      link.href = qrImageDataUrl;
      link.download = fileName;
      link.click();
      
      setTimeout(() => {
        window.open(`mailto:?subject=Acceso%20UPQROO&body=${encodeURIComponent(mensaje)}%0A%0A(La imagen del QR se ha descargado, adjuntala manualmente al correo)`, '_blank');
      }, 500);
      cerrarModalCompartir();
    }
  } catch (error) {
    console.error('Error al compartir:', error);
    mostrarAlerta('Descargando QR, compartelo manualmente', 'info');
    const link = document.createElement('a');
    link.href = qrImageDataUrl;
    link.download = `HotQR_${codigo}_${Date.now()}.png`;
    link.click();
    cerrarModalCompartir();
  }
}

function compartirSMS(mensaje) {
  window.open(`sms:?body=${mensaje}`, '_blank');
  cerrarModalCompartir();
}

function copiarCodigo(codigo) {
  navigator.clipboard.writeText(codigo).then(() => {
    mostrarAlerta('Codigo copiado al portapapeles', 'success');
    cerrarModalCompartir();
  }).catch(() => {
    mostrarAlerta('Error al copiar codigo', 'error');
  });
}

async function cargarHotQRs() {
  const tbody = document.getElementById('hotqrTableBody');
  const countSpan = document.getElementById('hotqr-count');

  try {
    const response = await fetch('/api/crear_hot_qr');
    const data = await response.json();

    if (data.success) {
      hotQRData = data.data;
      countSpan.textContent = `${hotQRData.length} Hot-QR`;
      renderizarHotQRs(hotQRData);
    } else {
      hotQRData = [];
      countSpan.textContent = '0 Hot-QR';
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px;">
            No hay Hot-QR generados hoy
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Error al cargar Hot-QRs:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 20px; color: #dc3545;">
          Error al cargar Hot-QR
        </td>
      </tr>
    `;
  }
}

function renderizarHotQRs(hotQRs) {
  const tbody = document.getElementById('hotqrTableBody');
  tbody.innerHTML = '';

  if (hotQRs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 20px;">
          No hay Hot-QR generados hoy
        </td>
      </tr>
    `;
    return;
  }

  const ahora = new Date();

  hotQRs.forEach(hqr => {
    const row = document.createElement('tr');
    const fechaExp = new Date(hqr.fecha_expiracion);
    const expirado = ahora >= fechaExp;

    let estadoHTML = '';
    if (!hqr.activo) {
      estadoHTML = `<span class="estado-registro salida-auto">Desactivado</span>`;
    } else if (hqr.usado) {
      estadoHTML = `<span class="estado-registro salida">Usado</span>`;
    } else if (expirado) {
      estadoHTML = `<span class="estado-registro salida-auto">Expirado</span>`;
    } else {
      estadoHTML = `<span class="estado-registro entrada">Activo</span>`;
    }

    row.innerHTML = `
      <td data-label="Codigo"><code class="hotqr-code-cell">${hqr.codigo}</code></td>
      <td data-label="Visitante">${hqr.nombre_visitante}</td>
      <td data-label="Motivo">${hqr.motivo || '-'}</td>
      <td data-label="Creado por">${hqr.admin_creador || '-'}</td>
      <td data-label="Expira">${fechaExp.toLocaleString()}</td>
      <td data-label="Estado">${estadoHTML}</td>
    `;
    tbody.appendChild(row);
  });
}

// Inicializacion
document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesionAdmin()) return;

  cargarCarreras();
  cargarConfiguracion();
});

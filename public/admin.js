
// Variables globales
let currentQRCode = null;
let registrosData = []; // Almacenar registros para filtrado
const MODE_SWITCH_CONTAINER = document.querySelector('.mode-switch-container');

// Sistema de tabs
function switchTab(tabName) {
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
  event.target.closest('.tab-button').classList.add('active');

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
      <td>${registro.matricula}</td>
      <td>${registro.nombres} ${registro.apellidos}</td>
      <td>
        <span class="badge badge-${registro.tipo_persona || 'otro'}">
          ${tipoPersonaLabel[registro.tipo_persona] || 'Otro'}
        </span>
      </td>
      <td>${registro.nombre_carrera || 'N/A'}</td>
      <td class="tiempo-columna">
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
      <td class="tiempo-columna">
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
      <td>${estadoHTML}</td>
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

MODE_SWITCH_CONTAINER.addEventListener('click', (e)=> {
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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesionAdmin()) return;

  // Cargar carreras al inicio
  cargarCarreras();
});
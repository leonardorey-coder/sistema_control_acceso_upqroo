
    // Variables globales
    let currentQRCode = null;
    let html5QrCode = null;
    let isScanning = true;

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
      
      // Inicializar el scanner solo si es necesario y estamos en el tab scanner
      if (tabName === 'scanner' && !html5QrCode) {
        inicializarScanner();
      }
      // Ya no detenemos el scanner al cambiar de tab, permanece activo en segundo plano
      
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

    // Generador de QR
    document.getElementById('qr-form').addEventListener('submit', async function(e) {
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
          const response = await fetch(`verificar_matricula.php?matricula=${matricula}`);
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
      formData.append('matricula', matricula);
      formData.append('nombres', nombres);
      formData.append('apellidos', apellidos);
      formData.append('curp', curp);
      formData.append('tipo_persona', tipo_persona);
      formData.append('id_carrera', id_carrera || '');
      
      if (foto_perfil) {
        formData.append('foto_perfil', foto_perfil);
      }
      
      try {
        const response = await fetch('registrar_persona.php', {
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
        const response = await fetch('obtener_carreras.php');
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
    document.getElementById('tipo_persona').addEventListener('change', function() {
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
    document.getElementById('curp').addEventListener('input', function(e) {
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
      currentQRCode = null;
    }

    // Scanner Functions
    function inicializarScanner() {
      const resultElement = document.getElementById('result');
      const continueButton = document.getElementById('continueButton');
      
      html5QrCode = new Html5Qrcode("reader");
      
      const config = {
        fps: 10,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          let minEdgePercentage = 0.75;
          let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          let qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return {
            width: qrboxSize,
            height: qrboxSize
          };
        },
        aspectRatio: 1.0
      };
      
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
      ).catch(err => {
        console.error("Error al iniciar el escáner:", err);
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

    async function onScanSuccess(decodedText, decodedResult) {
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

        const response = await fetch('procesar_qr.php', {
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
          
          // Actualizar tabla de registros si está visible
          if (document.getElementById('registros-tab').classList.contains('active')) {
            cargarRegistros();
          }
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
    }

    function onScanFailure(error) {
      console.warn(`Error en el escaneo: ${error}`);
    }

    // Evento del botón continuar
    document.getElementById('continueButton').addEventListener('click', () => {
      isScanning = true;
      html5QrCode.resume();
      document.getElementById('continueButton').style.display = 'none';
      document.getElementById('result').innerHTML = 'Esperando escanear código QR...';
    });

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
      
      try {
        const response = await fetch('obtener_registros.php');
        const data = await response.json();
        
        if (data.success) {
          registrosTableBody.innerHTML = '';
          data.data.forEach(registro => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${registro.matricula}</td>
              <td>${registro.nombres} ${registro.apellidos}</td>
              <td>${registro.nombre_carrera}</td>
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
              <td>
                <span class="estado-registro ${registro.hora_salida ? 'salida' : 'entrada'}">
                  ${registro.hora_salida ? 'Completado' : 'En curso'}
                </span>
              </td>
            `;
            registrosTableBody.appendChild(row);
          });
        } else {
          registrosTableBody.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; padding: 20px;">
                No hay registros para el día de hoy
              </td>
            </tr>
          `;
        }
      } catch (error) {
        console.error('Error al obtener los registros:', error);
        registrosTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 20px; color: #dc3545;">
              Error al cargar los registros
            </td>
          </tr>
        `;
      }
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
    document.getElementById('matricula').addEventListener('input', function(e) {
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
        const response = await fetch(`verificar_matricula.php?matricula=${matricula}`);
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
        const response = await fetch('obtener_carreras.php');
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
    document.getElementById('editar-tipo-persona').addEventListener('change', function() {
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
    document.getElementById('editar-curp').addEventListener('input', function(e) {
      this.value = this.value.toUpperCase();
    });

    // Validar solo números en matrícula de búsqueda
    document.getElementById('buscar-matricula').addEventListener('input', function(e) {
      this.value = this.value.replace(/\D/g, '');
    });

    // Validar solo números en matrícula de edición
    document.getElementById('editar-matricula').addEventListener('input', function(e) {
      this.value = this.value.replace(/\D/g, '');
    });

    // Permitir buscar con Enter
    document.getElementById('buscar-matricula').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscarPersona();
      }
    });

    // Manejar submit del formulario de edición
    document.getElementById('editar-form').addEventListener('submit', async function(e) {
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
      
      if (foto_perfil) {
        formData.append('foto_perfil', foto_perfil);
      }
      
      try {
        const response = await fetch('editar_persona.php', {
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
      
      // Inicializar scanner solo si estamos en el tab del scanner
      if (document.getElementById('scanner-tab').classList.contains('active')) {
        inicializarScanner();
      }
    });
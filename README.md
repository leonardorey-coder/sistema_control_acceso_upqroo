# Sistema de Control de Acceso por Códigos QR – v2

## Descripción

Sistema web para gestionar accesos y asistencias mediante códigos QR. Permite a usuarios autorizados escanear QRs, validar información y registrar accesos en una base de datos PostgreSQL.

**Tecnologías:**
- **Backend**: Node.js (Vercel Serverless Functions)
- **Frontend**: HTML, CSS, JavaScript
- **Base de Datos**: PostgreSQL
- **Librerías**: `pg`, `bcryptjs`, `dotenv`, `formidable`

## Estructura del Proyecto

```
├── api/                    # Endpoints serverless (Vercel)
│   ├── login.js            # Autenticación de administradores
│   ├── verificar_matricula.js
│   ├── procesar_qr.js      # Registro de entrada/salida
│   ├── registrar_persona.js
│   ├── editar_persona.js
│   ├── obtener_carreras.js
│   ├── obtener_registros.js
│   └── verificar_admin.js
├── lib/
│   └── db.js               # Conexión a PostgreSQL
├── public/                 # Archivos estáticos
│   ├── index.html
│   ├── login.html
│   ├── style.css
│   └── script.js
├── scripts/
│   ├── migrate_data.js     # Migrar datos desde MySQL dump
│   └── create_admin.js     # Crear usuario administrador
├── control_acceso_postgres.sql  # Esquema PostgreSQL
├── package.json
└── .env                    # Variables de entorno (no en git)
```

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- Vercel CLI (opcional para desarrollo local)

## Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <url>
   cd sistema_control_acceso_upqroo
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   Crear archivo `.env`:
   ```
   DB_HOST=localhost
   DB_USER=leonardocruz
   DB_PASSWORD=
   DB_NAME=control_acceso
   DB_PORT=5432
   ```

4. **Crear la base de datos**
   ```bash
   createdb control_acceso
   psql -d control_acceso -f control_acceso_postgres.sql
   ```

5. **Migrar datos (opcional)**
   Si tienes un dump MySQL:
   ```bash
   node scripts/migrate_data.js
   ```

6. **Crear administrador (opcional)**
   ```bash
   node scripts/create_admin.js usuario contraseña "Nombre Completo"
   ```

## Desarrollo Local

```bash
npm run vercel:dev
```

Abrir `http://localhost:3000`

## Despliegue (Vercel)

```bash
vercel --prod
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/login` | Autenticación |
| GET | `/api/verificar_matricula` | Verificar persona |
| POST | `/api/procesar_qr` | Registrar acceso |
| POST | `/api/registrar_persona` | Crear persona |
| POST | `/api/editar_persona` | Editar persona |
| GET | `/api/obtener_carreras` | Listar carreras |
| GET | `/api/obtener_registros` | Registros del día |
| GET | `/api/verificar_admin` | Verificar sesión |

## Licencia

MIT

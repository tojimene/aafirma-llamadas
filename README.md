# AA Firma · Análisis de Llamadas de Venta

Herramienta interna de **Alvarado Abreu Firma & Co.** para analizar en profundidad
las transcripciones de llamadas de venta. Sube una transcripción, el sistema la
evalúa con IA usando tu propia base de conocimiento (correcciones, estructuras
ideales, guiones) y genera un informe descargable en Word.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (PostgreSQL + pgvector + Storage)
- **Auth.js (NextAuth v5)** con credenciales — acceso privado, sin registro público
- **OpenRouter** para el análisis (modelo configurable, por defecto Claude 3.5 Sonnet)
- **OpenAI embeddings** para el RAG (la "memoria" que aprende del material cargado)
- **docx** para generar el informe en Word

## Cómo "aprende" el sistema (RAG)

No usa fine-tuning. Todo el material que subes en **Base de conocimiento** se
trocea, se convierte en *embeddings* y se guarda en `pgvector`. Al analizar una
llamada nueva, se recuperan los fragmentos más relevantes y se inyectan como
contexto al modelo. Cuanto más material cargas, más afinado es el análisis.

---

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pega y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql).
3. En **Storage**, crea un bucket **privado** llamado `reports` (opcional, para
   archivar informes; el MVP genera el Word al vuelo).
4. Copia desde **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Claves de IA

- **OpenRouter**: crea una API key en <https://openrouter.ai/keys>.
- **OpenAI** (solo embeddings): crea una API key en <https://platform.openai.com/api-keys>.

### 3. Variables de entorno

```bash
cp .env.example .env.local
# Edita .env.local con tus claves
# Genera el secret:  openssl rand -base64 32
```

### 4. Instalar y crear el primer usuario

```bash
npm install
node scripts/seed-user.mjs admin@aafirma.co "ContraseñaSegura123" "Nombre Apellido" admin
```

### 5. Arrancar

```bash
npm run dev
```

Abre <http://localhost:3000> e inicia sesión con el usuario creado.

---

## Uso

1. **Base de conocimiento** → sube correcciones, estructuras ideales y guiones.
   Esto es lo primero que conviene cargar para que el análisis sea relevante.
2. **Analizar llamada** → pega o sube la transcripción (`.txt`, `.md`, `.pdf`,
   `.docx`) y pulsa *Analizar*.
3. Revisa el resultado y descarga el **informe en Word**.
4. Consulta el **Historial** para ver análisis anteriores.

## Gestión de usuarios

No hay registro público. Crea usuarios con el script:

```bash
node scripts/seed-user.mjs <email> <contraseña> "<Nombre>" [admin|analista]
```

## Gestión de usuarios desde la interfaz

Inicia sesión con un usuario **admin** y entra en la sección **Usuarios** (solo
visible para administradores). Desde ahí puedes:

- Crear usuarios (analista o admin).
- Activar / desactivar el acceso.
- Cambiar el rol.
- Resetear la contraseña.
- Eliminar usuarios.

(El primer admin se crea con el script `seed-user`; el resto ya desde la web.)

## Despliegue en Vercel

1. **Sube el código a GitHub** (este repositorio ya tiene remoto configurado):

   ```bash
   git push origin main
   ```

2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repo
   `aafirma-llamadas`. Vercel detecta Next.js automáticamente.

3. En **Settings → Environment Variables**, añade las mismas que tienes en
   `.env.local` (Production y Preview):

   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | URL del proyecto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `OPENROUTER_API_KEY` | clave de OpenRouter |
   | `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4.5` |
   | `OPENAI_API_KEY` | clave de OpenAI (embeddings) |
   | `EMBEDDING_MODEL` | `text-embedding-3-small` |
   | `AUTH_SECRET` | el mismo secret (o genera uno con `openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | la URL de producción, p. ej. `https://aafirma-llamadas.vercel.app` |

4. **Deploy**. La base de datos es la misma (Supabase), así que tu usuario admin
   ya existe en producción.

### Notas de despliegue

- Las funciones `analyze` y `knowledge` tienen `maxDuration = 60` (límite del plan
  Hobby de Vercel). Si contratas el plan **Pro**, puedes subirlo hasta 300 en
  `app/api/analyze/route.ts` para transcripciones muy largas.
- `.env.local` está en `.gitignore`: tus claves **no** se suben al repositorio.
- Tras el primer deploy, actualiza `NEXTAUTH_URL` con el dominio real si usas uno
  personalizado.

## Coste aproximado

- Análisis por llamada (OpenRouter, Claude 3.5 Sonnet): ~0,01–0,05 USD.
- Embeddings (OpenAI `text-embedding-3-small`): coste casi nulo.

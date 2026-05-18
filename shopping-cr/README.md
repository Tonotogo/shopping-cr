# 🛍️ Shopping Agent CR
**Servicio de compras en el extranjero · Costa Rica · Precios en USD**

---

## ✅ Qué necesitás (todo gratis)
1. Cuenta en **Groq** (IA gratuita) → https://console.groq.com
2. Cuenta en **Vercel** (hosting gratuito) → https://vercel.com
3. Este proyecto descomprimido en tu computadora

---

## 🚀 Paso a paso para publicar

### PASO 1 — Conseguí tu API Key de Groq (gratis)
1. Andá a https://console.groq.com
2. Creá cuenta con tu email (o Google)
3. En el menú izquierdo tocá **"API Keys"**
4. Clic en **"Create API Key"**
5. Copiá la key (empieza con `gsk_...`)

### PASO 2 — Creá cuenta en Vercel
1. Andá a https://vercel.com
2. Clic en **"Sign Up"** → elegí **"Continue with GitHub"**
3. Si no tenés GitHub, creá cuenta gratis en https://github.com primero

### PASO 3 — Subí el proyecto a Vercel
1. En Vercel, clic en **"Add New Project"**
2. Elegí **"Upload"** (si no aparece, buscá el botón de importar)
3. Arrastrá la carpeta `shopping-cr` descomprimida

### PASO 4 — Configurá la API Key
⚠️ Este paso es importante — sin esto la búsqueda no funciona

En la pantalla de configuración antes del deploy:
1. Buscá la sección **"Environment Variables"**
2. Agregá:
   - **Name:** `REACT_APP_GROQ_KEY`
   - **Value:** tu key de Groq (`gsk_...`)
3. Clic en **"Add"**
4. Luego clic en **"Deploy"**

### PASO 5 — ¡Listo! Instalá en tu celular

Vercel te da un link tipo: `shopping-cr-xxx.vercel.app`

**En iPhone:**
1. Abrí ese link en **Safari** (no Chrome)
2. Tocá el botón compartir ↑
3. Elegí **"Agregar a pantalla de inicio"**
4. ¡Aparece como app!

**En Android:**
1. Abrí ese link en **Chrome**
2. Aparece un banner "Instalar app" → tocalo
3. O: menú ⋮ → "Agregar a pantalla de inicio"

---

## 💰 ¿Cuánto cuesta?
| Servicio | Costo |
|----------|-------|
| Groq IA | **100% Gratis** |
| Vercel hosting | **100% Gratis** |
| **Total** | **$0/mes** |

---

## 🔧 ¿Cómo usar la app?
1. Configurá tu **margen de ganancia** (%) y **costo de servicio** ($)
2. Escribí qué producto buscás en "Buscar Top 5"
3. La IA busca los 5 mejores productos en Amazon.com
4. Cada producto tiene el precio con tu margen ya aplicado
5. Copiá el mensaje de WhatsApp con un toque
6. Agregá pedidos en la pestaña "Pedidos"
7. Exportá el resumen para tu grupo de WhatsApp

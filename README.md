# Door List

Esqueleto de una plataforma de tickets para eventos con Next.js App Router,
TypeScript y Tailwind CSS v4.

## Desarrollo

```sh
npm install
npm run dev
```

Abre http://localhost:3000. El panel de organizadores está en `/organizador`.

## Supabase

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
en `.env.local` con la URL y la clave pública (anon) del proyecto Supabase.
Aplica las migraciones de `supabase/migrations` en orden y habilita el acceso
por correo y contraseña en Supabase Auth. Crea allí una cuenta para cada
organizador: el panel permite iniciar sesión con una cuenta existente.

Las políticas de seguridad permiten a cada organizador modificar únicamente sus
propios eventos y tipos de entrada. Un evento puede tener un aforo máximo
opcional; si se establece, la suma de los aforos de sus tipos de entrada no
puede superarlo. La base de datos también valida esta regla. Para publicar un
evento primero hay que añadir al menos un tipo de entrada.

## Verificación

```sh
npm run lint
npm run build
node --test tests/registration-email.cjs
```

La portada lista eventos publicados disponibles. Cada evento tiene una página
pública `/eventos/<id>` con formulario de nombre, correo y tipo de entrada.
La fecha de referencia es `America/Lima`: se permite registrarse durante todo
el día del evento, incluso después de su hora de inicio.

Aplica también `20261104020000_public_registration.sql`. `register_attendee`
bloquea el evento y vuelve a comprobar publicación, fecha, pertenencia de la
entrada y cupo antes de insertar. El mismo envío conserva un UUID al reintentar
para evitar duplicados si se pierde la respuesta. La tabla de registros tiene
RLS y no permite lectura ni escritura directa por usuarios públicos.

El formulario muestra carga, envío, confirmación con código y errores.
Si una entrada se agota, actualiza las opciones y conserva nombre y correo.
Al confirmar se envía la entrada por Resend desde `/api/registrations`.
Configura `RESEND_API_KEY` y `RESEND_FROM_EMAIL` solo en el servidor; el remitente
debe estar autorizado en Resend. No se requiere una nueva migración.
El remitente de prueba `onboarding@resend.dev` solo permite enviar al correo de
la propia cuenta de Resend (y a sus buzones de prueba). Para enviar a asistentes,
verifica un dominio en https://resend.com/domains con sus registros DNS y cambia
`RESEND_FROM_EMAIL` por una dirección de ese dominio. Reinicia el servidor local
o vuelve a desplegar tras actualizar las variables de entorno.
Los rechazos se registran en el servidor con código y estado HTTP, sin direcciones
personales ni secretos; `resend_test_sender_restricted` identifica esta limitación.
El correo incluye evento, fecha en America/Lima, lugar, tipo de entrada y QR PNG
incrustado mediante CID, sin imágenes alojadas ni enlaces necesarios para verlo.
Si falla el correo, se conserva la entrada y aparece un botón para reintentar.
Los reintentos usan el mismo registro y la misma clave de idempotencia de Resend
(su deduplicación dura 24 horas). El estado enviado significa aceptado por Resend,
no entrega confirmada al buzón. No hay cola ni reintentos automáticos.

### Verificación funcional en Supabase

En un proyecto de prueba con las tres migraciones aplicadas:

- Comprobar que borradores y eventos de ayer no ofrecen registro.
- Comprobar que un evento de hoy permite registrarse pasada su hora de inicio.
- Rechazar campos vacíos y entradas pertenecientes a otro evento mediante RPC.
- Enviar dos solicitudes simultáneas a la última plaza: solo una debe crearse.
- Despublicar o agotar la entrada con el formulario abierto: rechazar el envío.
- Repetir el mismo UUID y datos: devolver el mismo registro sin duplicarlo.
- Verificar que una petición anónima no puede leer datos personales ni insertar
  registros directamente.

## Emisión de entradas

La migración `20261104030000_ticket_issuance.sql` crea `tickets`: una entrada
por registro (restricción UNIQUE), código único aleatorio de 64 caracteres
hexadecimales generado por PostgreSQL, estado `valid`, `used` o `revoked`.
El trigger de registros emite la entrada dentro de la misma transacción.
También se emiten entradas para registros existentes. Los reintentos devuelven
la entrada original y no restablecen su estado.

La confirmación enlaza a `/entradas/<codigo>`. La página muestra nombre, correo,
evento, tipo de entrada, estado actual y el código como QR generado localmente.
El QR contiene el código completo. Se puede actualizar el estado y se vuelve a
consultar al recuperar el foco de la ventana. Consultar una entrada no la marca
como utilizada. Los cambios de estado se reservan al acceso administrativo a la
base de datos; esta implementación no incluye un flujo de control de acceso.

El código es una credencial de acceso: quien posee el enlace puede ver la
entrada. No existen búsquedas públicas por registro, nombre o correo, ni listado
público de entradas. RLS y permisos bloquean acceso directo a `tickets`.
La ruta lleva noindex y no-referrer. No se usan servicios externos para el QR.

Prueba transaccional (todos los datos de prueba se revierten):

```sh
npx --no-install supabase db query --remote --file supabase/tests/ticket_issuance.sql --yes
```

Comprueba emisión, reintentos, unicidad de registro y código, consulta exacta,
estados y permisos. `npm run lint` y `npm run build` validan la aplicación.

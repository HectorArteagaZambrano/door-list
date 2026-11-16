## Contexto
- Consulta la documentación oficial de la versión instalada de Next.js antes de escribir código del framework; ten en cuenta que esta versión puede diferir de la que conoces.
- Usa Server Components por defecto; añade `"use client"` solo cuando el componente requiera interactividad, hooks de cliente o APIs del navegador, e identifica esa necesidad en el PR.

## Estructura
- Ubica las rutas en `app/`, la UI compartida en `components/`, la lógica y las utilidades compartidas en `lib/`, los clientes de Supabase en `lib/supabase/` y los cambios de esquema en `supabase/migrations/`.
- Mantén cada componente usado por una sola ruta junto a esa ruta; mueve a `components/` cada componente usado por dos o más rutas.

## Vocabulario
- Usa `Event` exclusivamente para eventos, `TicketType` para tipos de entrada, `Ticket` para entradas emitidas y `Registration` para registros de asistentes; conserva estos significados en todo el repositorio.
- Nombra las tablas en snake_case y plural según su entidad: `events`, `ticket_types`, `tickets` y `registrations`.

## Idioma
- Escribe el código, los identificadores y los tipos en inglés, y el texto visible de la interfaz en español.
- Nombra las rutas públicas en español y los componentes que las sirven en inglés.

## Casing
- Limita snake_case a la capa de persistencia y convierte sus datos a camelCase al salir de ella; usa camelCase en todos los campos de los contratos de API, tanto en requests como en responses.

## Fuente única de verdad
- Define en `lib/` los tipos compartidos entre API, email y UI e impórtalos sin redefinirlos por archivo.
- Define en `lib/` los helpers de fecha y formato e impórtalos sin copiarlos entre pantallas.

## Errores
- Devuelve toda respuesta de error de la API como JSON con la forma `{ error: string }`; devuelve los errores de negocio con el código HTTP correspondiente y nunca uses HTTP 200 para ellos.
- Comprueba `response.ok` en el cliente antes de interpretar el cuerpo de la respuesta.
- Traduce los errores del proveedor a mensajes controlados antes de mostrarlos en la UI; nunca muestres mensajes crudos.

## Base de datos
- Registra cada migración en un archivo versionado de `supabase/migrations/`; no apliques cambios mediante SQL suelto.
- Habilita RLS en toda tabla expuesta y define políticas para los accesos permitidos.
## Reorganizar rutas: landing pública y panel de organizador

En este proyecto Next.js (App Router), la ruta `/` (`app/page.tsx`) actualmente
renderiza directamente el componente `Organizer` (`app/organizer.tsx`), que es
el panel privado del organizador para gestionar eventos y entradas. Quiero
reorganizar las rutas así:

1. **Mover el panel de organizador**
   - Crea una nueva ruta `/organizador` (`app/organizador/page.tsx`) que
     renderice `Organizer`, igual que hoy hace `app/page.tsx`.
   - No modifiques la lógica interna de `Organizer`.

2. **Convertir `/` en landing pública de eventos**
   - `app/page.tsx` debe listar los eventos disponibles para registro:
     eventos con `status = "published"` y con registro abierto (misma lógica
     de `registrationIsOpen` que ya usa `organizer.tsx`).
   - Trae los eventos desde Supabase (tabla `events`), sin requerir sesión.
   - Muestra por evento: título, fecha, lugar y descripción.
   - Cada evento debe enlazar a su página pública de registro existente:
     `/eventos/[id]/registro`.

3. **Mantener consistencia**
   - Respeta el estilo/diseño ya usado en `organizer.tsx` /
     `public-registration.tsx` y `app/layout.tsx`.
   - No toques la lógica de `app/eventos/[id]/registro`,
     `app/entradas/[code]`, ni las rutas de API — todo eso queda igual.

4. **Actualizar enlaces internos**
   - Si algún enlace (layout, navbar, etc.) apunta al panel del organizador,
     actualízalo para que apunte a `/organizador`.

5. **Sobre dudas**
   - Si tienes dudas antes de implementar, coméntalas primero y espera
     confirmación antes de empezar a escribir código.
# El recorrido de la cuenta, de punta a punta

> **Para David, porque esta parte no la puedo hacer yo.** El viaje completo necesita un proyecto de
> Supabase real y, para Google, tus credenciales (ADR 0034 §4). Lo que sigue es la lista exacta, con
> lo que debe pasar en cada paso y **qué significa si no pasa**.

## Antes de empezar

1. Crear **dos** proyectos de Supabase en una región de la **UE** (ADR 0034 §14), uno de desarrollo
   y uno de producción. La Parte 15 exige claves distintas para cada entorno.
2. Aplicar las migraciones — **ahora son tres** —, desde el panel de Supabase o con
   `DATABASE_URL` puesta, pegando en orden:
   `packages/db/migrations/0001-accounts-sites-and-the-audit-log.sql`,
   `packages/db/migrations/0002-every-auth-user-gets-an-account-row.sql` y
   `packages/db/migrations/0003-the-photos-bucket-and-its-policies.sql`.
   **La `0002` no es opcional**: sin ella `public.accounts` no tiene fila para nadie, y entonces ni
   el borrado de cuenta ni el interruptor de herramientas pueden guardarse. Tu cuenta de ahora, que
   se creó antes de que existiera, la arregla el relleno que la propia migración lleva dentro.
   **La `0003` crea el bucket `fotos` y sus políticas** (ADR 0037): sin ella guardar una web con
   foto dice «no se ha podido subir» y la web se abre sin ella en otro ordenador. Si el rol de
   `DATABASE_URL` no puede crear políticas sobre `storage.objects`, pégala desde el editor SQL del
   panel, que sí puede — y dilo, porque entonces el runbook §3 necesita esa línea.
3. Pegar en Render las **cuatro** variables obligatorias que `.env.example` nombra —
   `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`—. **Yo no veo ninguna.** (Esta lista decía «cinco» y estaba mal
   contada: las de Google van al panel de Supabase, no a Render — corregido el 5 de octubre al
   comprobarlo contra tu propio mensaje, que decía «he creado 4 variables».)
   Hay una **quinta, opcional pero recomendada desde hoy**: `APP_ORIGIN`, con el origen público
   exacto (`https://<tu-servicio>.onrender.com`, sin ruta al final). Sin ella la ruta de entrar con
   Google ya funciona —usa lo que Render reenvía—, pero con ella deja de depender de confiar en esa
   cabecera. Ver `docs/tasks/cabecera-de-origen.md`.
4. En Supabase → Authentication, dar de alta el proveedor de Google con tus credenciales, y
   **añadirte como usuario de prueba** en la pantalla de consentimiento de Google (modo de pruebas,
   tope de 100).

## El recorrido

| # | Qué haces | Qué debe pasar | Si no pasa |
|---|---|---|---|
| 1 | Abres la URL con el servicio **dormido** y cronometras | Tarda cerca de un minuto y luego pinta la landing | Es el plan gratuito, no un fallo. Anota el número en `docs/tasks/arranque-en-frio.md` |
| 2 | «Empezar» → las cinco preguntas | **No te pide cuenta en ningún momento** | Si te la pide, el §2 está roto |
| 3 | Editas un texto | El indicador dice «Guardado en este navegador» | Mira el caso 2 del runbook |
| 4 | **Subes una foto de portada** y luego «Guardar en mi cuenta» → creas la cuenta con correo | Dice «Guardada en tu cuenta, con su foto» y aparece «Ver mis webs» | Si pide confirmar el correo, ábrelo y vuelve. Si dice «pero 1 foto no se ha podido subir», la `0003` no está aplicada o la política no deja: runbook §3. Si no subes ninguna foto dice «Guardada en tu cuenta.» a secas, que también es correcto: la foto del banco es nuestra y no se sube |
| 5 | Editas otro texto | El indicador pasa a «Guardado en tu cuenta» | Si se queda en «este navegador», el empujón falló: caso 2 |
| 5b | **Cambias una foto** y esperas un segundo | Sigue diciendo «Guardado en tu cuenta» | Desde el día 4 cada guardado reconcilia las fotos: la nueva sube y la que ya no se usa se borra. Si alguna no sube, el indicador dice «· 1 foto sin subir» — eso es correcto y es lo que hay que ver si cortas la red a propósito |
| 6 | Cierras sesión y vuelves a entrar | `/mis-webs` lista tu web | — |
| 7 | La abres | **Sale con tus textos y con tus fotos** | El día 3 las baja de `fotos/<tu id>/<id de la web>/`. Si alguna no llega, la descarga se bloquea y lo dice con un botón para reintentar: eso es correcto, no un fallo de la pantalla. Una foto que subiste *después* del guardado que las subió todavía no está arriba — el empujón de una edición no las lleva hasta el día 4 |
| 8 | **Abres otro navegador**, haces una web anónima, y entras con la misma cuenta | La web anónima se ofrece **como web nueva**; la primera sigue intacta | Si sobrescribe alguna, es tu ajuste del día 4 roto | **Y el paso que de verdad prueba el día 3: abre en ese segundo navegador la web que guardaste en el primero. La portada tiene que estar.** Si sale el marcador gris, mira si el objeto existe en Supabase → Storage |
| 9 | Descargas el ZIP y lo abres con doble clic | La web se ve sin servidor | Es la promesa del ADR 0001 |
| 10 | **«Entrar con Google»** | Entra, y `/mis-webs` enseña lo tuyo | **Esto sigue siendo lo único que no he podido probar yo.** Si falla con un error de Google antes de volver a nuestro dominio, casi siempre es el *redirect URI*: tiene que ser el que Supabase da en su panel, no `/auth/callback` directamente. **Si en cambio Safari dice «no puede abrir la página» con un `localhost` en la URL después de volver**, es el fallo que David encontró el 5 de octubre y ya está arreglado: `/auth/callback` construía su redirección con `request.url`, que detrás del proxy de Render es la dirección interna. Ver `apps/editor/src/auth/publicOrigin.ts` y `docs/tasks/cabecera-de-origen.md` |
| 11 | `/cuenta` → «Descargar una copia de mis webs» | Baja un `.json` con tus documentos | La Parte 16 dice que esto funciona siempre |
| 12 | «Borrar mi cuenta» → confirmas. **Con la cuenta de prueba, no con la tuya** | Dice que se borrará **a partir del** día que toque, y puedes cancelarlo ahí mismo | Ya no hace falta recargar: si la petición no se guarda, la pantalla dice «No hemos podido registrar la petición» en el momento. Eso significa que `public.accounts` no tiene tu fila, y es lo que arregla la migración `0002` — la comprobación entera está en `docs/runbook.md` §3, «Checking one landed, when the ledger cannot say». (Este paso decía «recarga la página y compruébalo», que era verdad hasta que la PR #181 hizo que el fallo se reportara en vez de pasar por bueno.) |
| 13 | Cancelas el borrado | Vuelve a la normalidad | — |
| 14 | `pnpm accounts:purge` con `DATABASE_URL` puesta | Dice quién está vencido, **cuántas fotos tiene cada uno**, y **no borra nada** | Es el barrido, y en seco por defecto. El ensayo no necesita ninguna clave más: preguntar quién está vencido no destruye nada. `docs/runbook.md` §6 |
| 15 | Vuelves a pedir el borrado y, **solo para probarlo**, adelantas la fecha en el panel de Supabase 31 días | `pnpm accounts:purge` ya la lista; con `--confirm` la borra y no queda nada con que entrar | Hazlo con una cuenta de prueba, no con la tuya: no hay copia de seguridad (`docs/tasks/copias.md`). **El `--confirm` necesita ahora tres variables**, no una: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Las fotos son ficheros y no filas, así que quitarlas necesita la API de Storage |
| 16 | **Mira el bucket después**: Supabase → Storage → `fotos` | No queda ninguna carpeta con el id de la cuenta que acabas de borrar | Si queda, el barrido dijo que la terminó y los ficheros siguen ahí, que es justo lo que el código está montado para hacer imposible: avisa en vez de limpiarlo a mano (`docs/runbook.md` §7) |

## Lo que queda por decidir, y es tuyo

- **La copia de seguridad** (`docs/tasks/copias.md`): el plan gratuito **no trae ninguna**. Hay tres
  salidas con su precio y una recomendación. **No ejecuto nada hasta que elijas.**
- **Partir la landing o no** (`docs/tasks/arranque-en-frio.md`), con los dos números del paso 1
  delante.
- **Aceptar los DPA** de Supabase y de Render, que el ADR 0034 §14 deja como tarea de dirección.
- **Drizzle**: no se ha ganado su sitio y lo dije en la PR del día 6. El protocolo lo nombra; si
  debe estar por principio, es tu decisión.
- **Cada cuánto corre el barrido de cuentas.** Hoy no lo programa nada: los *cron jobs* de Render se
  pagan y el ADR 0034 eligió 0 €. Una vez por semana basta y el runbook §6 explica por qué «a partir
  del» es la palabra honesta mientras sea manual.

## Lo que el barrido del sprint 14 dejó abierto y sigue abierto

Dos de los cuatro hallazgos, por tu propia decisión de reparto:

- **Los cuatro tiradores de las esquinas no hacen nada.**
- **Seis verbos de sección solo se alcanzan con ratón.**

Los otros dos están hechos: el foco y Escape en las pantallas nuevas (días 3, 4 y 6) y el callejón
de la foto de muestra (día 7). **Y los cinco diálogos `aria-modal` antiguos siguen sin trampa de
foco** — el hook existe y tiene dos usuarios, así que ponerlos al día es ahora un cambio pequeño.

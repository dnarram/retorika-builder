# El recorrido de la cuenta, de punta a punta

> **Para David, porque esta parte no la puedo hacer yo.** El viaje completo necesita un proyecto de
> Supabase real y, para Google, tus credenciales (ADR 0034 §4). Lo que sigue es la lista exacta, con
> lo que debe pasar en cada paso y **qué significa si no pasa**.

## Antes de empezar

1. Crear **dos** proyectos de Supabase en una región de la **UE** (ADR 0034 §14), uno de desarrollo
   y uno de producción. La Parte 15 exige claves distintas para cada entorno.
2. Aplicar la migración: `DATABASE_URL=<pooler 6543> node -e "…"` o desde el panel, pegando
   `packages/db/migrations/0001-accounts-sites-and-the-audit-log.sql`.
3. Pegar en Render las cinco variables que `.env.example` nombra. **Yo no veo ninguna.**
4. En Supabase → Authentication, dar de alta el proveedor de Google con tus credenciales, y
   **añadirte como usuario de prueba** en la pantalla de consentimiento de Google (modo de pruebas,
   tope de 100).

## El recorrido

| # | Qué haces | Qué debe pasar | Si no pasa |
|---|---|---|---|
| 1 | Abres la URL con el servicio **dormido** y cronometras | Tarda cerca de un minuto y luego pinta la landing | Es el plan gratuito, no un fallo. Anota el número en `docs/tasks/arranque-en-frio.md` |
| 2 | «Empezar» → las cinco preguntas | **No te pide cuenta en ningún momento** | Si te la pide, el §2 está roto |
| 3 | Editas un texto | El indicador dice «Guardado en este navegador» | Mira el caso 2 del runbook |
| 4 | «Guardar en mi cuenta» → creas la cuenta con correo | Dice «Guardada en tu cuenta» y aparece «Ver mis webs» | Si pide confirmar el correo, ábrelo y vuelve: el diálogo tiene esa frase |
| 5 | Editas otro texto | El indicador pasa a «Guardado en tu cuenta · fotos solo en este navegador» | Si se queda en «este navegador», el empujón falló: caso 2 del runbook |
| 6 | Cierras sesión y vuelves a entrar | `/mis-webs` lista tu web | — |
| 7 | La abres | Sale con tus textos. **Sin fotos, si habías subido alguna** | Eso es el §5 y está dicho en el diálogo y en la lista |
| 8 | **Abres otro navegador**, haces una web anónima, y entras con la misma cuenta | La web anónima se ofrece **como web nueva**; la primera sigue intacta | Si sobrescribe alguna, es tu ajuste del día 4 roto |
| 9 | Descargas el ZIP y lo abres con doble clic | La web se ve sin servidor | Es la promesa del ADR 0001 |
| 10 | **«Entrar con Google»** | Entra, y `/mis-webs` enseña lo tuyo | **Esto es lo único que no he podido probar yo.** Si falla, casi siempre es el *redirect URI* en Google: tiene que ser `https://<tu-servicio>.onrender.com/auth/callback` |
| 11 | `/cuenta` → «Descargar una copia de mis webs» | Baja un `.json` con tus documentos | La Parte 16 dice que esto funciona siempre |
| 12 | «Borrar mi cuenta» → confirmas | Dice que se borrará en 30 días, y puedes cancelarlo ahí mismo | — |
| 13 | Cancelas el borrado | Vuelve a la normalidad | — |

## Lo que queda por decidir, y es tuyo

- **La copia de seguridad** (`docs/tasks/copias.md`): el plan gratuito **no trae ninguna**. Hay tres
  salidas con su precio y una recomendación. **No ejecuto nada hasta que elijas.**
- **Partir la landing o no** (`docs/tasks/arranque-en-frio.md`), con los dos números del paso 1
  delante.
- **Aceptar los DPA** de Supabase y de Render, que el ADR 0034 §14 deja como tarea de dirección.
- **Drizzle**: no se ha ganado su sitio y lo dije en la PR del día 6. El protocolo lo nombra; si
  debe estar por principio, es tu decisión.

## Lo que el barrido del sprint 14 dejó abierto y sigue abierto

Dos de los cuatro hallazgos, por tu propia decisión de reparto:

- **Los cuatro tiradores de las esquinas no hacen nada.**
- **Seis verbos de sección solo se alcanzan con ratón.**

Los otros dos están hechos: el foco y Escape en las pantallas nuevas (días 3, 4 y 6) y el callejón
de la foto de muestra (día 7). **Y los cinco diálogos `aria-modal` antiguos siguen sin trampa de
foco** — el hook existe y tiene dos usuarios, así que ponerlos al día es ahora un cambio pequeño.

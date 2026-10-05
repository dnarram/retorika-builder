# El origen público detrás del proxy de Render, y por qué confiar en las cabeceras

> **De dónde viene esto.** David probó «Entrar con Google» en el despliegue real el 5 de octubre de
> 2026 y Safari respondió «no puede abrir la página https://localhost:10000». Supabase había
> redirigido bien a `https://retorika-builder.onrender.com/auth/callback`; la ruta, una vez dentro,
> construía su propia redirección con `new URL(request.url).origin` — que detrás del proxy de
> Render es la dirección interna donde escucha el proceso, nunca la pública. David lo diagnosticó
> él mismo antes de pedir el arreglo.

## La cadena de tráfico, comprobada y no supuesta

Una petición a `https://retorika-builder.onrender.com/*` no puede llegar al proceso de la
aplicación sin pasar por la infraestructura de Render: visitante → Cloudflare → el balanceador de
Render → el proxy de Render en `127.0.0.1` → la aplicación. **No hay una ruta directa al proceso que
se salte esa cadena** — un servicio web de Render no expone un puerto público propio.

Eso resuelve la mitad de la pregunta: nadie puede alcanzar la aplicación sin que Render ya haya
visto la petición primero. Lo que queda abierto es si, dentro de esa petición, **Render reescribe
las cabeceras `X-Forwarded-Host` y `X-Forwarded-Proto` con lo que él mismo observó**, o si se
limita a reenviar lo que el cliente ya mandaba.

Fuentes:
[cómo Render maneja el tráfico y el DDoS](https://render.com/articles/how-render-handles-ddos-attacks) ·
[sobre `X-Forwarded-Proto` y su falsificabilidad general](https://http.dev/x-forwarded-proto) ·
[el principio de solo confiar en lo que añade un proxy de confianza](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For)

## Lo que no pude confirmar con una búsqueda, y la decisión que tomé por eso

No encontré una afirmación específica de Render que diga «sobrescribimos `X-Forwarded-Host` en
cada petición, nunca lo heredamos del cliente». El principio general del sector es que un proxy de
confianza **debería** hacerlo — y es casi seguro que Render lo hace, porque es el comportamiento
estándar de cualquier balanceador que gestiona subdominios dinámicos (`<servicio>.onrender.com`) —,
pero «casi seguro» no es lo mismo que comprobado, y esta cabecera decide **a qué dominio aterriza
alguien después de autenticarse**.

**Por eso la cabecera no es la única fuente, ni la que manda cuando hay otra.** `APP_ORIGIN` —
explícita, puesta por ti — es la primera que se mira, y si está, gana siempre. Las cabeceras son el
segundo recurso: siguen arreglando el fallo de hoy sin que tengas que añadir nada, pero el valor
exacto nunca depende solo de confiar en ellas si prefieres quitarte la duda.

## La regla, en una frase

1. **`APP_ORIGIN`**, si está puesta: gana siempre, y un valor mal formado **hace que la ruta falle
   fuerte** en vez de redirigir a algún sitio raro en silencio.
2. **`x-forwarded-proto` + `x-forwarded-host`**, si `APP_ORIGIN` no está: lo que Render dice que
   vio. Arregla el fallo de hoy sin desplegar nada nuevo.
3. **El origen de `request.url`**: correcto cuando no hay proxy delante, que es el desarrollo local.

## Si algún día esto importa de verdad

Si alguna vez se decide no confiar en las cabeceras en absoluto — por ejemplo, si Retorika se
sirviera detrás de un proxy que no fuera de Render y cuyo comportamiento no se pudiera verificar —,
la salida es **poner `APP_ORIGIN` y listo**: el código ya la mira primero, y las cabeceras ni se
llegan a leer.

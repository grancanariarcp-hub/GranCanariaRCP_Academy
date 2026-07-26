# Prompt para PÚLSAR — venta cruzada con la academia (Gran Canaria RCP)

> Pégalo en el Claude Code que trabaja PÚLSAR (`C:/pulsar`). Es solo una capa de
> marketing/medición: NO toca sesiones, casos, cursos ni evaluación.

---

Estoy montando venta cruzada recíproca entre PÚLSAR (simulación clínica) y **Gran
Canaria RCP Academy** (la parte teórica y las actas). La academia ya promociona a
PÚLSAR con enlaces que llevan `?ref=academia`, y ya registra las llegadas con
`?ref=...`. Falta el lado de PÚLSAR. Hay que hacer dos cosas simétricas:

## 1. Captar el `?ref=academia` que llega desde la academia

Los visitantes que la academia manda aterrizan en
`https://pulsar.astormanager.com/presupuesto/?ref=academia` (y a veces en la
portada con `?ref=academia`). Hay que **guardar ese origen** para poder atribuir
el lead. Mínimo viable, sin base de datos nueva si no hace falta:

- En el frontend de la página de presupuesto (`publico/presupuesto/` o donde
  esté), leer `?ref` de la URL al cargar y:
  - Guardarlo en un campo oculto del formulario de presupuesto, **y**
  - Persistirlo en `sessionStorage`/`localStorage` por si el usuario navega antes
    de enviar.
- Al **enviar** el formulario de presupuesto, incluir ese `ref` en el POST y
  **guardarlo junto al lead** (en el JSON/tabla donde ya guardes los presupuestos
  entrantes: añade un campo `origen` o `ref`). Por defecto `"directo"` si no vino.
- Así, en tus presupuestos podrás filtrar cuántos vinieron con `origen:"academia"`.

Es exactamente lo que la academia ya hace con los que le llegan con `?ref=pulsar`.

## 2. Devolver tráfico a la academia con `?ref=pulsar`

Simétrico: PÚLSAR debe promocionar la academia (la parte teórica/acreditada) y
enlazarla añadiendo `?ref=pulsar`, para que la academia mida el origen.

- Donde ya promociones la academia (o crea una tarjeta/banner sobrio si no
  existe), enlaza a: **`https://campus.grancanariarcp.es/?ref=pulsar`**
  (portada del campus). Si quieres apuntar a un curso concreto,
  `https://campus.grancanariarcp.es/curso/<id>?ref=pulsar`.
- Mensaje recíproco sugerido (coordinémoslo): *"La formación teórica acreditada
  de estos cursos se realiza en Gran Canaria RCP Academy: temario, exámenes y
  certificado con créditos."*
- La academia ya detecta `?ref=pulsar` al aterrizar y lo registra; no necesitas
  llamar a ninguna API suya: basta con que el enlace lleve el parámetro.

## Endpoint de la academia (por si quieres registrar tú también, opcional)

La academia expone `POST https://grancanaria-rcp-api.onrender.com/api/public/referido`
con cuerpo `{ "ref": "pulsar", "path": "/..." }`. No hace falta usarlo desde
PÚLSAR —el registro se dispara solo cuando el visitante aterriza con `?ref=`—,
pero queda documentado por si algún día quieres empujar el evento tú.

## Importante

- Nada de esto toca la lógica de sesiones, casos, cursos-plantilla ni evaluación.
- No guardes datos personales por el `ref`: solo la etiqueta de origen.
- Cuando lo tengas, dime con qué texto y en qué páginas has puesto el enlace a la
  academia, para coordinar el mensaje en ambos lados.

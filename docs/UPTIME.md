# Mantener la API despierta y vigilada (sin falsas alarmas)

## El problema

El plan gratuito de Render **duerme** el backend tras ~15 min sin tráfico; el
siguiente visitante espera ~50 s a que despierte. Para evitarlo hay un workflow
de GitHub Actions (`.github/workflows/keepalive.yml`) que hace un ping cada 10
minutos.

Pero GitHub Actions **no está pensado para esto**:

- Sus máquinas gratuitas a veces no arrancan el trabajo programado
  («The job was not acquired by Runner of type hosted»). Es un fallo de GitHub,
  no de la plataforma.
- Cuando eso pasa, GitHub manda un **correo de "workflow failed"** aunque la API
  esté perfectamente. Alarma sin motivo.
- Los trabajos programados de GitHub además se **retrasan o se saltan** cuando
  hay mucha carga, justo cuando más falta hace el ping.

## El arreglo de fondo: un monitor de uptime externo

Un servicio de monitorización hace las dos cosas mejor y **solo avisa cuando la
API está realmente caída** (que es la única alarma que quieres):

1. **Mantiene la API despierta** pingándola cada pocos minutos.
2. **Te avisa de verdad** si deja de responder, con su propio correo/Telegram.

### Opción recomendada: cron-job.org (gratis)

1. Entra en <https://cron-job.org> y crea una cuenta.
2. **Create cronjob** con:
   - **URL:** `https://grancanaria-rcp-api.onrender.com/api/health`
   - **Schedule:** cada 10 minutos (o «every 10 minutes»).
   - En notificaciones, activa el aviso **solo cuando falla** («on failure»).
3. Guarda. Ya está: mantiene el servicio despierto y te escribe únicamente si la
   API cae de verdad.

(UptimeRobot, <https://uptimerobot.com>, sirve igual: monitor tipo HTTP(s), URL
la de arriba, intervalo 5 min, alerta por email.)

### Cuando el monitor externo esté funcionando

Desactiva el workflow de GitHub para no duplicar pings ni recibir sus falsas
alarmas: en GitHub → pestaña **Actions** → **Keep API warm** → botón **···** →
**Disable workflow**. (No hace falta borrar el archivo; se puede reactivar.)

## El arreglo definitivo (cuando haya ingresos)

Subir el backend de Render al plan de pago (~7 $/mes): **no se duerme nunca**, y
todo esto —keepalive, monitor, arranques en frío— desaparece. Hasta entonces, el
monitor externo gratuito es la mejor solución.

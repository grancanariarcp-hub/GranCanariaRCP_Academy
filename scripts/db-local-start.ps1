# Starts the local (portable) PostgreSQL server for GranCanaria RCP Academy.
# Run:  powershell -ExecutionPolicy Bypass -File scripts\db-local-start.ps1
$ErrorActionPreference = 'Stop'

$base = "C:\Users\lubbe\PostgresRCP"
$bin  = Join-Path $base 'pgsql\bin'
$data = Join-Path $base 'data'
$log  = Join-Path $base 'server.log'

if (-not (Test-Path (Join-Path $bin 'pg_ctl.exe'))) {
  Write-Host "PostgreSQL portable no encontrado en $base" -ForegroundColor Red
  exit 1
}

# Already running?
& "$bin\pg_isready.exe" -h localhost -p 5432 -U rcp_admin *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "PostgreSQL ya esta en marcha (localhost:5432)" -ForegroundColor Green
  exit 0
}

& "$bin\pg_ctl.exe" -D $data -l $log -o "-p 5432" start
Start-Sleep -Seconds 3
& "$bin\pg_isready.exe" -h localhost -p 5432 -U rcp_admin
if ($LASTEXITCODE -eq 0) {
  Write-Host "PostgreSQL iniciado en localhost:5432" -ForegroundColor Green
} else {
  Write-Host "No se pudo iniciar. Revisa $log" -ForegroundColor Red
  exit 1
}

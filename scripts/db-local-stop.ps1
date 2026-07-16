# Stops the local (portable) PostgreSQL server.
# Run:  powershell -ExecutionPolicy Bypass -File scripts\db-local-stop.ps1
$base = "C:\Users\lubbe\PostgresRCP"
$bin  = Join-Path $base 'pgsql\bin'
$data = Join-Path $base 'data'

& "$bin\pg_ctl.exe" -D $data stop -m fast
if ($LASTEXITCODE -eq 0) {
  Write-Host "PostgreSQL detenido" -ForegroundColor Green
} else {
  Write-Host "PostgreSQL no estaba en marcha" -ForegroundColor Yellow
}

# BuildX AI – Dev Server Launcher
# Starts the Express backend (port 3001) and Vite frontend (port 5173) in separate windows.

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BuildX AI – Starting Dev Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Install dependencies if node_modules is missing ──────────────────────
if (-not (Test-Path "$projectRoot\node_modules")) {
    Write-Host "📦 node_modules not found – running npm install..." -ForegroundColor Yellow
    npm install --prefix $projectRoot
    Write-Host "✅ Dependencies installed." -ForegroundColor Green
    Write-Host ""
}

# ── 2. Start the Express backend in a new terminal window ───────────────────
Write-Host "🚀 Starting backend  →  http://localhost:3001" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$projectRoot'; Write-Host 'BuildX AI Backend' -ForegroundColor Cyan; node server/index.js"

Start-Sleep -Seconds 1

# ── 3. Start the Vite frontend in a new terminal window ─────────────────────
Write-Host "⚡ Starting frontend →  http://localhost:5173" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$projectRoot'; Write-Host 'BuildX AI Frontend' -ForegroundColor Cyan; npm run dev:ui"

Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend:  http://localhost:3001" -ForegroundColor White
Write-Host ""

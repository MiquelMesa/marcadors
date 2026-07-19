param(
  [switch]$Clean
)

$TauriDir = Resolve-Path (Join-Path $PSScriptRoot "..\src-tauri")
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if ($Clean) {
  Remove-Item (Join-Path $TauriDir "server.exe") -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $TauriDir "sea-prep.blob") -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $TauriDir "server-bundle.js") -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $TauriDir "sea-config.json") -Force -ErrorAction SilentlyContinue
  Write-Output "Cleaned SEA artifacts"
  exit 0
}

Write-Output "=== Building SEA executable for Marcadors ==="

# 1. Bundle server.js with esbuild
Write-Output "[1/4] Bundling server.js with esbuild..."
$env:TAURI_DIR = $TauriDir
Push-Location $ProjectRoot
npx esbuild server.js --bundle --platform=node --external:pino-pretty --outfile="$TauriDir\server-bundle.js"
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

# 2. Create SEA config
Write-Output "[2/4] Generating SEA blob..."
$seaConfig = '{ "main": "server-bundle.js", "output": "sea-prep.blob" }'
Set-Content -Path (Join-Path $TauriDir "sea-config.json") -Value $seaConfig
Pop-Location

Push-Location $TauriDir
node --experimental-sea-config sea-config.json
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

# 3. Copy node binary
Write-Output "[3/4] Copying Node.js binary..."
$nodePath = (Get-Command node).Source
Copy-Item $nodePath "server.exe" -Force

# 4. Inject blob
Write-Output "[4/4] Injecting SEA blob..."
npx postject server.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Pop-Location

# Clean up temp files
Remove-Item (Join-Path $TauriDir "sea-config.json") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $TauriDir "sea-prep.blob") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $TauriDir "server-bundle.js") -Force -ErrorAction SilentlyContinue

Write-Output "=== Done: server.exe created in src-tauri/ ==="

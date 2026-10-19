param(
  [ValidateSet('mcp','start','context','save','serve')][string]$Action = 'mcp',
  [string]$Repository,
  [string]$InputFile
)
$ErrorActionPreference = 'Stop'
$atlasRoot = Split-Path -Parent $PSScriptRoot
$atlasNode = 'C:\Program Files\nodejs\node.exe'
$atlasSecurePath = Join-Path $atlasRoot '.local/atlas-codex-token.clixml'
try {
  $atlasSecure = Import-Clixml -LiteralPath $atlasSecurePath
  $atlasPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($atlasSecure)
  try { $env:ATLAS_AGENT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($atlasPointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($atlasPointer) }
  Get-ChildItem Env: | Where-Object { $_.Name -match '^(DATABASE_URL|DATABASE_URL_UNPOOLED|ATLAS_DATABASE_URL|WORKER_DATABASE_URL|NEON_|AWS_|OPENAI_|ANTHROPIC_)' } | ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
  $env:ATLAS_STORAGE_MODE = 'local'
  $env:ATLAS_API_URL = 'http://127.0.0.1:4317'
  if ($Action -eq 'serve') {
    & $atlasNode (Join-Path $atlasRoot 'apps/api/dist/index.js')
    exit $LASTEXITCODE
  }
  # Start only the ATLAS API on demand; no scheduled startup or AI agent process.
  $atlasHealthy = $false
  $atlasHealth = $null
  try {
    $atlasHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/health' -TimeoutSec 2
    $atlasHealthy = $atlasHealth.service -eq 'atlas-api'
  } catch {}
  if ($atlasHealthy -and ($atlasHealth.storage -ne 'local' -or -not $atlasHealth.agent_ready)) { throw 'Existing ATLAS process needs the local-mode restart.' }
  if (-not $atlasHealthy) {
    # Use Node's explicit detached stdio handles; PowerShell's redirected
    # Start-Process can retain unrelated requesting-client pipes on Windows.
    & $atlasNode (Join-Path $atlasRoot 'apps/api/dist/start-local.js')
    if ($LASTEXITCODE -ne 0) { throw 'ATLAS local API launch failed.' }
    for ($atlasAttempt=0; $atlasAttempt -lt 30; $atlasAttempt++) {
      Start-Sleep -Milliseconds 300
      try {
        $atlasHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/health' -TimeoutSec 1
        if ($atlasHealth.service -eq 'atlas-api' -and $atlasHealth.storage -eq 'local' -and $atlasHealth.agent_ready) { $atlasHealthy = $true; break }
      } catch {}
    }
    if (-not $atlasHealthy) { throw 'ATLAS API could not start on its fixed loopback port.' }
  }
  if ($Action -eq 'mcp') {
    & $atlasNode (Join-Path $atlasRoot 'apps/mcp-server/dist/index.js')
  } else {
    if (-not $Repository) { throw 'Repository is required.' }
    & $atlasNode (Join-Path $atlasRoot 'apps/mcp-server/dist/cli.js') $Action $Repository $InputFile
  }
  $atlasExitCode = $LASTEXITCODE
} catch {
  [Console]::Error.WriteLine('ATLAS launcher failed. Check the local API and scoped credential setup.')
  $atlasExitCode = 1
} finally {
  Remove-Item Env:ATLAS_AGENT_TOKEN -ErrorAction SilentlyContinue
}
exit $atlasExitCode

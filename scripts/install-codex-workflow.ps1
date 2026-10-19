$ErrorActionPreference = 'Stop'
$atlasRoot = Split-Path -Parent $PSScriptRoot
$atlasCodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$atlasAgents = Join-Path $atlasCodexHome 'AGENTS.md'
if (Test-Path -LiteralPath (Join-Path $atlasCodexHome 'AGENTS.override.md')) { throw 'Global override exists; preserve it and review instruction precedence before installation.' }
$atlasInstructions = [IO.File]::ReadAllText((Join-Path $atlasRoot 'docs/CODEX_GLOBAL_INSTRUCTIONS.md'))
$atlasOriginal = if (Test-Path -LiteralPath $atlasAgents) { [IO.File]::ReadAllText($atlasAgents) } else { '' }
$atlasBackup = Join-Path $atlasRoot '.local/global-agents-before-atlas.md'
if (-not (Test-Path -LiteralPath $atlasBackup)) { [IO.File]::WriteAllText($atlasBackup, $atlasOriginal) }
$atlasPattern = '(?s)<!-- ATLAS-WORKFLOW:BEGIN -->.*?<!-- ATLAS-WORKFLOW:END -->'
$atlasUpdated = if ($atlasOriginal.Contains('<!-- ATLAS-WORKFLOW:BEGIN -->')) { [regex]::Replace($atlasOriginal,$atlasPattern,[Text.RegularExpressions.MatchEvaluator]{param($m) $atlasInstructions.Trim()}) } else { $atlasOriginal.TrimEnd() + "`r`n`r`n" + $atlasInstructions }
$atlasBeforeRaw = & codex mcp list --json
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect existing MCP configuration.' }
$atlasBefore = @($atlasBeforeRaw | ConvertFrom-Json)
$atlasExisting = @($atlasBefore | Where-Object { $_.name -eq 'atlas' })
$atlasPwsh = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
$atlasLauncher = Join-Path $atlasRoot 'scripts/atlas-launch.ps1'
if ($atlasExisting.Count -gt 0) {
  $atlasEntryRaw = & codex mcp get atlas --json
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect atlas registration.' }
  $atlasEntry = $atlasEntryRaw | ConvertFrom-Json
  if ($atlasEntry.transport.command -ne $atlasPwsh -or $atlasEntry.transport.args -notcontains $atlasLauncher) { throw 'An unrelated atlas server already exists; preserving it.' }
} else {
  & codex mcp add atlas -- $atlasPwsh -NoProfile -File $atlasLauncher
  if ($LASTEXITCODE -ne 0) { throw 'MCP registration failed.' }
}
[IO.File]::WriteAllText($atlasAgents,$atlasUpdated)
$atlasAfterRaw = & codex mcp list --json
if ($LASTEXITCODE -ne 0) { throw 'Could not verify MCP registration.' }
$atlasAfter = @($atlasAfterRaw | ConvertFrom-Json)
foreach ($atlasEntry in $atlasBefore) { if ($atlasAfter.name -notcontains $atlasEntry.name) { throw 'Existing MCP server missing after registration.' } }
if ($atlasAfter.name -notcontains 'atlas') { throw 'ATLAS registration missing.' }
$atlasAudit = @{ installedAt=(Get-Date).ToUniversalTime().ToString('o'); server='atlas'; preservedServers=@($atlasBefore.name); globalInstructions=$atlasAgents; launcher=$atlasLauncher }
$atlasAudit | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $atlasRoot '.local/codex-registration-audit.json')
Write-Output 'Global Codex ATLAS instructions installed; existing instructions and MCP servers preserved. No credential value written to config.toml.'

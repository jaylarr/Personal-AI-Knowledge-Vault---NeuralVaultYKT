param(
  [string]$CodexHome = (Join-Path $env:USERPROFILE '.codex'),
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$atlasHome = [IO.Path]::GetFullPath($CodexHome)
$atlasProject = [IO.Path]::GetFullPath($ProjectRoot)
if (Test-Path -LiteralPath (Join-Path $atlasHome 'AGENTS.override.md')) { throw 'Global override exists. Preserve it and inspect instruction precedence.' }
$atlasHooksPath = Join-Path $atlasHome 'hooks.json'
$atlasAgentsPath = Join-Path $atlasHome 'AGENTS.md'
$atlasHooksRaw = if (Test-Path -LiteralPath $atlasHooksPath) { [IO.File]::ReadAllText($atlasHooksPath) } else { '{}' }
$atlasAgentsRaw = if (Test-Path -LiteralPath $atlasAgentsPath) { [IO.File]::ReadAllText($atlasAgentsPath) } else { '' }
$atlasHooks = ConvertFrom-Json -InputObject $atlasHooksRaw -AsHashtable
if (-not $atlasHooks.ContainsKey('hooks')) { $atlasHooks['hooks'] = @{} }
$atlasScript = Join-Path $atlasProject 'scripts/codex-personal-hook.mjs'
if (-not (Test-Path -LiteralPath $atlasScript)) { throw 'Personal hook script missing.' }
$atlasNode = 'C:/Program Files/nodejs/node.exe'
$atlasCommand = '"' + $atlasNode + '" "' + $atlasScript + '" --project-root "' + $atlasProject + '"'
$atlasOwnId = 'atlas-personal-v1'
foreach ($atlasEvent in @('SessionStart','PreCompact','Stop','Interrupt','SessionEnd')) {
  $atlasGroups = @()
  if ($atlasHooks.hooks.ContainsKey($atlasEvent)) { $atlasGroups = @($atlasHooks.hooks[$atlasEvent]) }
  $atlasExisting = @($atlasGroups | Where-Object { $_.ContainsKey('description') -and $_.description -eq $atlasOwnId })
  if ($atlasExisting.Count -gt 1) { throw 'Duplicate personal hook identity; preserve and inspect.' }
  if ($atlasExisting.Count -eq 1 -and $atlasExisting[0].hooks[0].command -ne $atlasCommand) { throw 'Personal hook identity points to a different command. Preserve it.' }
  if ($atlasExisting.Count -eq 0) { $atlasGroups = @($atlasGroups) + @(@{ description=$atlasOwnId; hooks=@(@{ type='command'; command=$atlasCommand; timeout=3 }) }) }
  $atlasHooks.hooks[$atlasEvent] = @($atlasGroups)
}
$atlasTemplate = [IO.File]::ReadAllText((Join-Path $atlasProject 'docs/CODEX_GLOBAL_INSTRUCTIONS.md')).Trim()
$atlasPattern = '(?s)<!-- ATLAS-WORKFLOW:BEGIN -->.*?<!-- ATLAS-WORKFLOW:END -->'
$atlasMatches = [regex]::Matches($atlasAgentsRaw,$atlasPattern)
if ($atlasMatches.Count -gt 1 -or ($atlasAgentsRaw.Contains('<!-- ATLAS-WORKFLOW:BEGIN -->') -and $atlasMatches.Count -ne 1)) { throw 'Ambiguous ATLAS global block; preserve it.' }
$atlasUpdated = if ($atlasMatches.Count -eq 1) { [regex]::Replace($atlasAgentsRaw,$atlasPattern,[Text.RegularExpressions.MatchEvaluator]{param($m) $atlasTemplate}) } else { $atlasAgentsRaw + "`r`n`r`n" + $atlasTemplate }
if (-not $Apply) { @{ dry_run=$true; hook_events=@('SessionStart','PreCompact','Stop','Interrupt','SessionEnd'); trust_required=$true; modifies_native_memory=$false; personal_enabled=$false } | ConvertTo-Json -Compress; exit 0 }
$atlasBackup = Join-Path $atlasProject ('.local/personal-install-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $atlasBackup | Out-Null
[IO.File]::WriteAllText((Join-Path $atlasBackup 'hooks.before.json'),$atlasHooksRaw)
[IO.File]::WriteAllText((Join-Path $atlasBackup 'agents.before.md'),$atlasAgentsRaw)
$atlasMerge = [Diagnostics.ProcessStartInfo]::new()
$atlasMerge.FileName = $atlasNode
$atlasMerge.ArgumentList.Add((Join-Path $PSScriptRoot 'merge-personal-hooks.mjs'))
$atlasMerge.ArgumentList.Add($atlasCommand)
$atlasMerge.RedirectStandardInput = $true
$atlasMerge.RedirectStandardOutput = $true
$atlasMerge.RedirectStandardError = $true
$atlasMerge.CreateNoWindow = $true
$atlasMerge.UseShellExecute = $false
$atlasMergeProcess = [Diagnostics.Process]::Start($atlasMerge)
$atlasMergeProcess.StandardInput.Write($atlasHooksRaw)
$atlasMergeProcess.StandardInput.Close()
$atlasMergedHooks = $atlasMergeProcess.StandardOutput.ReadToEnd()
$atlasMergeError = $atlasMergeProcess.StandardError.ReadToEnd()
$atlasMergeProcess.WaitForExit()
if ($atlasMergeProcess.ExitCode -ne 0) { throw 'Hook merge failed; existing client files were preserved.' }
[IO.File]::WriteAllText($atlasHooksPath,$atlasMergedHooks)
[IO.File]::WriteAllText($atlasAgentsPath,$atlasUpdated)
@{ applied=$true; backup=$atlasBackup; trust_required=$true; note='Review exact new hook definitions through normal Codex controls. No trust bypass or native memory settings changed.' } | ConvertTo-Json -Compress

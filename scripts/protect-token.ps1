param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$atlasToken = [Console]::In.ReadToEnd().Trim()
if ($atlasToken -notmatch '^atlas_[A-Za-z0-9_-]{43}$') { throw 'Invalid credential format.' }
$atlasToken | ConvertTo-SecureString -AsPlainText -Force | Export-Clixml -LiteralPath $Destination
$atlasToken = $null

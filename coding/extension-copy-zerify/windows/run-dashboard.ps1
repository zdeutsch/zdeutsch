$ErrorActionPreference = "Continue"

$projectPath = Join-Path $env:USERPROFILE "ZDeutschManager"
$nodePath = "C:\Program Files\nodejs\node.exe"
$serverPath = Join-Path $projectPath "server.js"

Set-Location $projectPath

while ($true) {
  try {
    & $nodePath $serverPath
  }
  catch {
    # The watchdog intentionally keeps running so a transient failure cannot
    # leave the local dashboard offline.
  }

  Start-Sleep -Seconds 5
}

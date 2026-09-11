$ErrorActionPreference = "Stop"

$projectPath = Join-Path $env:USERPROFILE "ZDeutschManager"
$nodePath = "C:\Program Files\nodejs\node.exe"
$powerShellPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
$runnerPath = Join-Path $projectPath "windows\run-dashboard.ps1"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$iconPath = Join-Path $projectPath "windows\zdeutsch-dashboard.ico"
$taskName = "ZDeutsch Dashboard"
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path (Join-Path $projectPath "server.js"))) {
  throw "Dashboard server not found at $projectPath"
}

if (-not (Test-Path $nodePath)) {
  throw "Node.js not found at $nodePath"
}

if (-not (Test-Path $runnerPath)) {
  throw "Dashboard watchdog not found at $runnerPath"
}

$action = New-ScheduledTaskAction `
  -Execute $powerShellPath `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runnerPath`"" `
  -WorkingDirectory $projectPath
$triggers = @(
  New-ScheduledTaskTrigger -AtStartup
  New-ScheduledTaskTrigger -AtLogOn -User $userId
)
$principal = New-ScheduledTaskPrincipal `
  -UserId $userId `
  -LogonType S4U `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $triggers `
  -Principal $principal `
  -Settings $settings `
  -Description "Runs the local ZDeutsch data dashboard on http://localhost:3080" `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName

if (-not (Test-Path $chromePath)) {
  throw "Google Chrome not found at $chromePath"
}

if (-not (Test-Path $iconPath)) {
  throw "Dashboard shortcut icon not found at $iconPath"
}

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "ZDeutsch Dashboard.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $chromePath
$shortcut.Arguments = "--app=http://127.0.0.1:3080/dashboard --start-maximized"
$shortcut.WorkingDirectory = $projectPath
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Open the local ZDeutsch database dashboard"
$shortcut.Save()

Write-Output "Installed and started scheduled task: $taskName"
Write-Output "Created desktop shortcut: $shortcutPath"

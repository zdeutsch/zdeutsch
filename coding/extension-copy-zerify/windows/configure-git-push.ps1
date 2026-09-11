#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$ProjectPath = (Join-Path $env:USERPROFILE "ZDeutschManager"),
  [string]$GitRemote = "git@github.com:zdeutsch/zdeutsch.git",
  [string]$KeyPath = (Join-Path $env:USERPROFILE ".ssh\zdeutsch_dashboard_ed25519")
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  & git -C $ProjectPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed: git -C `"$ProjectPath`" $($Arguments -join ' ')"
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or is not available on PATH. Install Git for Windows and run this script again."
}

$gitDirectory = Join-Path $ProjectPath ".git"
if (-not (Test-Path $gitDirectory)) {
  throw "The dashboard site is not a Git repository: $ProjectPath"
}

$sshDirectory = Split-Path -Parent $KeyPath
New-Item -ItemType Directory -Force -Path $sshDirectory | Out-Null

if (-not (Test-Path $KeyPath)) {
  $sshKeygen = Get-Command ssh-keygen -ErrorAction SilentlyContinue
  if (-not $sshKeygen) {
    throw "OpenSSH (ssh-keygen) is not installed. Enable the OpenSSH Client Windows optional feature."
  }

  & $sshKeygen.Source -t ed25519 -f $KeyPath -C "zdeutsch-dashboard@$env:COMPUTERNAME" -N ""
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create the dashboard SSH key."
  }
}

$sshCommand = "ssh -i `"$KeyPath`" -o IdentitiesOnly=yes -o BatchMode=yes"
Invoke-Git @("config", "core.sshCommand", $sshCommand)
Invoke-Git @("config", "user.name", "ZDeutsch Dashboard")
Invoke-Git @("config", "user.email", "dashboard@zdeutsch.local")

$currentRemote = (& git -C $ProjectPath remote get-url origin 2>$null | Out-String).Trim()
if ($currentRemote) {
  Invoke-Git @("remote", "set-url", "origin", $GitRemote)
} else {
  Invoke-Git @("remote", "add", "origin", $GitRemote)
}

Write-Host "Git push configuration saved for $ProjectPath"
Write-Host "Remote: $GitRemote"
Write-Host "SSH key: $KeyPath"

$publicKeyPath = "$KeyPath.pub"
$publicKey = if (Test-Path $publicKeyPath) { (Get-Content -Raw $publicKeyPath).Trim() } else { "" }
$probe = & git -C $ProjectPath ls-remote origin HEAD 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "The local Git configuration is fixed, but GitHub has not authorized this key yet."
  Write-Host "Add this complete public key to the write-enabled GitHub account, then run this script again:"
  Write-Host $publicKey
  throw ($probe.Trim())
}

Write-Host "GitHub SSH authentication succeeded. The dashboard can now push changes."

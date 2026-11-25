<#
.SYNOPSIS
  Builds the private Commons and publishes it to D:\services\commons-web\ on server-pc.

.DESCRIPTION
  npm run deploy:private (from PowerShell, never Git Bash).

  1. Builds with COMMONS_TARGET=private: base "/", API on the same origin under
     /api, every app including private ones.
  2. Checks dist/ really contains the private apps (scripts/check-dist.mjs).
  3. Mirrors dist/ into the target folder, replacing that folder's contents only.

  `tailscale serve` (owned by commons-api / the commons-backend agent) serves the
  folder at / on port 8445 and proxies /api to 127.0.0.1:8790. The private site
  is tailnet only: never put it behind Funnel. This script does not touch
  tailscale.

.PARAMETER Target
  Folder to publish into. Default D:\services\commons-web.
#>
param(
  [string]$Target = "D:\services\commons-web"
)

$ErrorActionPreference = "Stop"

if ($env:MSYSTEM) {
  throw "Run this from PowerShell, not Git Bash: MSYS rewrites path-like values and breaks the build."
}
if ((Split-Path -Leaf $Target) -ne "commons-web") {
  throw "Refusing to publish into '$Target': the target folder must be named commons-web."
}

$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
$previousTarget = $env:COMMONS_TARGET
$previousBase = $env:VITE_BASE
try {
  $env:COMMONS_TARGET = "private"
  Remove-Item Env:VITE_BASE -ErrorAction SilentlyContinue

  Write-Host "Building the private Commons (COMMONS_TARGET=private)..."
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed ($LASTEXITCODE)" }

  node scripts/check-dist.mjs private
  if ($LASTEXITCODE -ne 0) { throw "dist/ is not a private build" }

  $index = Join-Path $repo "dist\index.html"
  if (-not (Select-String -Path $index -Pattern 'src="/assets/' -Quiet)) {
    throw "dist/index.html does not load assets from /assets/: wrong base path for the private site"
  }

  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Write-Host "Publishing dist\ to $Target (mirror: replaces that folder's contents only)..."
  robocopy (Join-Path $repo "dist") $Target /MIR /NJH /NJS /NP /NFL /NDL | Out-Null
  # robocopy: 0-7 are success codes (files copied / extras removed), 8+ are failures.
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
  $global:LASTEXITCODE = 0

  $count = (Get-ChildItem -Recurse -File $Target | Measure-Object).Count
  Write-Host "Done: $count files in $Target. Open the private Commons on a device with Tailscale on."
}
finally {
  if ($null -eq $previousTarget) { Remove-Item Env:COMMONS_TARGET -ErrorAction SilentlyContinue } else { $env:COMMONS_TARGET = $previousTarget }
  if ($null -ne $previousBase) { $env:VITE_BASE = $previousBase }
  Pop-Location
}

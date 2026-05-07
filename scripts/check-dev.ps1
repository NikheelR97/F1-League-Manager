param(
  [switch]$Strict,
  [switch]$Install,
  [switch]$InstallProjectDeps,
  [switch]$InstallPlaywright
)

$ErrorActionPreference = "Stop"

$RequiredNodeMajor = 18
$RequiredNodeMinor = 18
$RecommendedNodeMajor = 20

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Write-Header {
  param([string]$Text)
  Write-Host ""
  Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Add-Failure {
  param([string]$Message)
  $failures.Add($Message) | Out-Null
  Write-Host "FAIL $Message" -ForegroundColor Red
}

function Add-Warning {
  param([string]$Message)
  $warnings.Add($Message) | Out-Null
  Write-Host "WARN $Message" -ForegroundColor Yellow
}

function Add-Pass {
  param([string]$Message)
  Write-Host "PASS $Message" -ForegroundColor Green
}

function Add-Info {
  param([string]$Message)
  Write-Host "INFO $Message" -ForegroundColor Gray
}

function Test-Command {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  return $null -ne $command
}

function Get-CommandText {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  try {
    $result = & $Command @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return ($result | Select-Object -First 1).ToString().Trim()
  }
  catch {
    return $null
  }
}

function Convert-VersionText {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  $clean = $Text.Trim().TrimStart("v")
  try {
    return [version]$clean
  }
  catch {
    return $null
  }
}

function Invoke-CheckedCommand {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$Description
  )

  Add-Info $Description
  & $Command @Arguments
  return $LASTEXITCODE -eq 0
}

function Install-WingetPackage {
  param(
    [string]$ToolName,
    [string]$PackageId
  )

  if (-not (Test-Command "winget")) {
    Add-Warning "Cannot install $ToolName automatically because winget is missing."
    return $false
  }

  $arguments = @(
    "install",
    "--exact",
    "--id",
    $PackageId,
    "--accept-source-agreements",
    "--accept-package-agreements"
  )

  return Invoke-CheckedCommand "winget" $arguments "Installing $ToolName with winget package $PackageId..."
}

function Install-NpmGlobal {
  param(
    [string]$ToolName,
    [string]$PackageName
  )

  if (-not (Test-Command "npm")) {
    Add-Warning "Cannot install $ToolName automatically because npm is missing."
    return $false
  }

  $arguments = @("install", "-g", $PackageName)
  return Invoke-CheckedCommand "npm" $arguments "Installing $ToolName with npm package $PackageName..."
}

function Test-NodeVersion {
  $versionText = Get-CommandText "node" @("--version")
  $version = Convert-VersionText $versionText

  if ($null -eq $version) {
    Add-Failure "Node.js is installed, but its version could not be read."
    return
  }

  $minimum = [version]"$RequiredNodeMajor.$RequiredNodeMinor.0"
  if ($version -lt $minimum) {
    if ($Install) {
      Install-WingetPackage "Node.js LTS" "OpenJS.NodeJS.LTS" | Out-Null
      Add-Warning "Node.js was installed or upgraded. Open a new terminal and run this script again."
      return
    }

    Add-Failure "Node.js $versionText is too old. Install Node.js $RequiredNodeMajor.$RequiredNodeMinor or newer."
    return
  }

  if ($version.Major -lt $RecommendedNodeMajor) {
    Add-Warning "Node.js $versionText works, but Node.js $RecommendedNodeMajor LTS is recommended."
    return
  }

  Add-Pass "Node.js $versionText"
}

function Test-RequiredTool {
  param(
    [string]$Name,
    [string]$InstallHint,
    [string]$WingetPackageId = "",
    [string[]]$VersionArgs = @("--version")
  )

  if (-not (Test-Command $Name)) {
    if ($Install -and -not [string]::IsNullOrWhiteSpace($WingetPackageId)) {
      Install-WingetPackage $Name $WingetPackageId | Out-Null
    }

    if (-not (Test-Command $Name)) {
      Add-Failure "$Name is missing. $InstallHint"
      return
    }
  }

  $versionText = Get-CommandText $Name $VersionArgs
  if ([string]::IsNullOrWhiteSpace($versionText)) {
    Add-Pass "$Name is installed."
    return
  }

  Add-Pass "$Name $versionText"
}

function Test-OptionalTool {
  param(
    [string]$Name,
    [string]$InstallHint,
    [string]$WingetPackageId = "",
    [string]$NpmPackage = "",
    [string[]]$VersionArgs = @("--version")
  )

  if (-not (Test-Command $Name)) {
    if ($Install -and -not [string]::IsNullOrWhiteSpace($WingetPackageId)) {
      Install-WingetPackage $Name $WingetPackageId | Out-Null
    }
    elseif ($Install -and -not [string]::IsNullOrWhiteSpace($NpmPackage)) {
      Install-NpmGlobal $Name $NpmPackage | Out-Null
    }
  }

  if (-not (Test-Command $Name)) {
    Add-Warning "$Name is missing. $InstallHint"
    return
  }

  $versionText = Get-CommandText $Name $VersionArgs
  if ([string]::IsNullOrWhiteSpace($versionText)) {
    Add-Pass "$Name is installed."
    return
  }

  Add-Pass "$Name $versionText"
}

function Install-ProjectDependencies {
  if (-not $InstallProjectDeps) {
    return
  }

  if (-not (Test-Path "package.json")) {
    Add-Warning "Cannot install project dependencies because package.json does not exist yet."
    return
  }

  if (Test-Path "package-lock.json") {
    Invoke-CheckedCommand "npm" @("ci") "Installing project dependencies with npm ci..." | Out-Null
    return
  }

  Invoke-CheckedCommand "npm" @("install") "Installing project dependencies with npm install..." | Out-Null
}

function Install-PlaywrightBrowsers {
  if (-not $InstallPlaywright) {
    return
  }

  if (-not (Test-Path "package.json")) {
    Add-Warning "Cannot install Playwright browsers because package.json does not exist yet."
    return
  }

  Invoke-CheckedCommand "npx" @("playwright", "install") "Installing Playwright browsers..." | Out-Null
}

function Test-ProjectFiles {
  if (Test-Path "package.json") {
    Add-Pass "package.json found."
  }
  else {
    Add-Warning "package.json not found yet. This is expected before S0 scaffolding."
  }

  if (Test-Path ".env.local") {
    Add-Pass ".env.local found."
  }
  else {
    Add-Warning ".env.local not found. Create it after .env.example exists."
  }

  if (Test-Path ".env") {
    Add-Warning ".env found. Prefer .env.local for local secrets in Next.js projects."
  }

  if (Test-Path "node_modules") {
    Add-Pass "node_modules found."
  }
  elseif (Test-Path "package.json") {
    Add-Warning "node_modules not found. Run this script with -InstallProjectDeps."
  }
}

function Test-ProjectScripts {
  if (-not (Test-Path "package.json")) {
    return
  }

  $packageJson = Get-Content -Raw "package.json" | ConvertFrom-Json
  $scripts = $packageJson.scripts
  $requiredScripts = @(
    "dev",
    "build",
    "lint",
    "type-check",
    "test",
    "test:coverage",
    "test:e2e",
    "sprint-verify",
    "deploy:check"
  )

  foreach ($scriptName in $requiredScripts) {
    if ($null -ne $scripts.$scriptName) {
      Add-Pass "npm script '$scriptName' exists."
    }
    else {
      Add-Warning "npm script '$scriptName' is missing."
    }
  }
}

function Test-BranchMapping {
  if (-not (Test-Path ".git")) {
    Add-Warning "Git repository metadata was not found. Branch mapping check skipped."
    return
  }

  $branchName = Get-CommandText "git" @("branch", "--show-current")
  if ([string]::IsNullOrWhiteSpace($branchName)) {
    Add-Warning "Could not read current Git branch."
    return
  }

  switch ($branchName) {
    "dev" {
      Add-Pass "Current branch is dev. Use local Supabase by default. Dev previews may use f1-league-manager-nonprod."
    }
    "staging" {
      Add-Pass "Current branch is staging. Use Supabase project f1-league-manager-nonprod."
    }
    "prod" {
      Add-Warning "Current branch is prod. Use only production env vars and avoid local experiments."
    }
    default {
      Add-Warning "Current branch is '$branchName'. Confirm whether it should target dev, staging, or prod before changing env vars, migrations, seeds, imports, or deploy settings."
    }
  }
}

Write-Host "F1 League Manager developer machine check" -ForegroundColor White
Write-Host "Run with -Install to install missing tools."
Write-Host "Run with -InstallProjectDeps to install npm dependencies."
Write-Host "Run with -InstallPlaywright to install Playwright browsers."
Write-Host "Run with -Strict to fail on warnings too."

Write-Header "Required Tools"
Test-RequiredTool "git" "Install Git for Windows: https://git-scm.com/download/win" "Git.Git"
Test-RequiredTool "node" "Install Node.js LTS: https://nodejs.org/" "OpenJS.NodeJS.LTS"
Test-NodeVersion
Test-RequiredTool "npm" "npm should be installed with Node.js."

Write-Header "Recommended Tools"
Test-OptionalTool "gh" "Install GitHub CLI if you want easy repo auth: https://cli.github.com/" "GitHub.cli"
Test-OptionalTool "vercel" "Install later with: npm install -g vercel" "" "vercel"
Test-OptionalTool "supabase" "Install later with: npm install -g supabase" "" "supabase"
Test-OptionalTool "docker" "Install Docker Desktop if you want local Supabase: https://www.docker.com/products/docker-desktop/" "Docker.DockerDesktop"

Write-Header "Project Dependencies"
Install-ProjectDependencies
Install-PlaywrightBrowsers

Write-Header "Project Files"
Test-ProjectFiles
Test-ProjectScripts

Write-Header "Branch Mapping"
Test-BranchMapping

Write-Header "Playwright"
if (Test-Path "package.json") {
  $playwrightVersion = Get-CommandText "npx" @("playwright", "--version")
  if ([string]::IsNullOrWhiteSpace($playwrightVersion)) {
    Add-Warning "Playwright is not available yet. Run npm install after S0 setup."
  }
  else {
    Add-Pass $playwrightVersion
    Add-Warning "If E2E tests fail because browsers are missing, run this script with -InstallPlaywright."
  }
}
else {
  Add-Warning "Playwright check skipped because package.json does not exist yet."
}

Write-Header "Summary"
Write-Host "Failures: $($failures.Count)"
Write-Host "Warnings: $($warnings.Count)"

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Fix failures before starting development:" -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host "- $failure" -ForegroundColor Red
  }
  exit 1
}

if ($Strict -and $warnings.Count -gt 0) {
  Write-Host ""
  Write-Host "Strict mode treats warnings as failures:" -ForegroundColor Yellow
  foreach ($warning in $warnings) {
    Write-Host "- $warning" -ForegroundColor Yellow
  }
  exit 1
}

Write-Host ""
Write-Host "Developer machine check passed." -ForegroundColor Green

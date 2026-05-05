param(
  [switch]$Strict
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

function Test-NodeVersion {
  $versionText = Get-CommandText "node" @("--version")
  $version = Convert-VersionText $versionText

  if ($null -eq $version) {
    Add-Failure "Node.js is installed, but its version could not be read."
    return
  }

  $minimum = [version]"$RequiredNodeMajor.$RequiredNodeMinor.0"
  if ($version -lt $minimum) {
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
    [string[]]$VersionArgs = @("--version")
  )

  if (-not (Test-Command $Name)) {
    Add-Failure "$Name is missing. $InstallHint"
    return
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
    [string[]]$VersionArgs = @("--version")
  )

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
    Add-Warning "node_modules not found. Run npm install."
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

Write-Host "F1 League Manager developer machine check" -ForegroundColor White
Write-Host "Run with -Strict to fail on warnings too."

Write-Header "Required Tools"
Test-RequiredTool "git" "Install Git for Windows: https://git-scm.com/download/win"
Test-RequiredTool "node" "Install Node.js LTS: https://nodejs.org/"
Test-NodeVersion
Test-RequiredTool "npm" "npm should be installed with Node.js."

Write-Header "Recommended Tools"
Test-OptionalTool "gh" "Install GitHub CLI if you want easy repo auth: https://cli.github.com/"
Test-OptionalTool "vercel" "Install later with: npm install -g vercel"
Test-OptionalTool "supabase" "Install later with: npm install -g supabase"
Test-OptionalTool "docker" "Install Docker Desktop if you want local Supabase: https://www.docker.com/products/docker-desktop/"

Write-Header "Project Files"
Test-ProjectFiles
Test-ProjectScripts

Write-Header "Playwright"
if (Test-Path "package.json") {
  $playwrightVersion = Get-CommandText "npx" @("playwright", "--version")
  if ([string]::IsNullOrWhiteSpace($playwrightVersion)) {
    Add-Warning "Playwright is not available yet. Run npm install after S0 setup."
  }
  else {
    Add-Pass $playwrightVersion
    Add-Warning "If E2E tests fail because browsers are missing, run: npx playwright install"
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

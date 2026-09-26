<#
.SYNOPSIS
Installs the Atelier MCP project on Windows.

.DESCRIPTION
This script clones the repository, checks prerequisites, installs dependencies,
builds the project, and adds the CLI to the user's PATH.

.EXAMPLE
irm https://raw.githubusercontent.com/USER/atelier-mcp/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

# Colors for Write-Host
$C_CYAN = "Cyan"
$C_GREEN = "Green"
$C_RED = "Red"
$C_YELLOW = "Yellow"

function Show-Banner {
    Write-Host @"
         _       _                     __  __  ____  ____  
        / \   _ | |_  ___ | |(_) ___ _ __|  \/  |/ ___||  _ \ 
       / _ \ | __|/ _ \| || |/ _ \ '__| |\/| | |    | |_) |
      / ___ \| |_|  __/ | | |  __/ |  | |  | | |___ |  __/ 
     /_/   \_\\__|\___|_|_|_|\___|_|  |_|  |_|\____||_|    
"@ -ForegroundColor $C_CYAN
    Write-Host ""
}

function Write-Color {
    param (
        [string]$Message,
        [string]$Color
    )
    Write-Host $Message -ForegroundColor $Color
}

function Exit-WithError {
    param (
        [string]$Message
    )
    Write-Color "Error: $Message" $C_RED
    exit 1
}

Show-Banner
Write-Color "Starting Atelier MCP installation..." $C_GREEN
Write-Host ""

# Determine Install Directory
$InstallDir = $env:ATELIER_HOME
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path $env:USERPROFILE ".atelier-mcp"
}

# Check Git
Write-Color "Checking prerequisites..." $C_CYAN
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Exit-WithError "Git is not installed or not in PATH. Please install Git and try again."
}

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Exit-WithError "Node.js is not installed or not in PATH. Please install Node.js 20.19+ (20.x) or 22.12+ and try again."
}

$NodeVersionStr = (node -v).TrimStart('v')
$NodeVersion = [version]$NodeVersionStr

if (-not (($NodeVersion.Major -eq 20 -and $NodeVersion.Minor -ge 19) -or $NodeVersion -ge [version]'22.12.0')) {
    Exit-WithError "Node.js 20.19+ (20.x) or 22.12+ is required. Found version v$NodeVersionStr"
}
Write-Color "Found Node.js v$NodeVersionStr" $C_CYAN

# Clone Repository
if (Test-Path $InstallDir) {
    Write-Color "Warning: Installation directory $InstallDir already exists." $C_YELLOW
    $Choice = Read-Host "Do you want to overwrite it? (y/n)"
    if ($Choice -match "^[yY]$") {
        Write-Color "Removing existing directory..." $C_CYAN
        Remove-Item -Path $InstallDir -Recurse -Force
    } else {
        Exit-WithError "Installation aborted by user."
    }
}

$RepoUrl = "https://github.com/USER/atelier-mcp.git"
Write-Color "Cloning repository to $InstallDir..." $C_CYAN
try {
    git clone -q $RepoUrl $InstallDir
} catch {
    Exit-WithError "Failed to clone repository."
}

# Install & Build
Set-Location $InstallDir

Write-Color "Installing npm dependencies..." $C_CYAN
try {
    npm install --silent
} catch {
    Exit-WithError "Failed to install dependencies."
}

Write-Color "Building packages..." $C_CYAN
try {
    npm run build --silent
} catch {
    Exit-WithError "Failed to build project."
}

# Setup CLI wrapper
Write-Color "Setting up CLI command..." $C_CYAN
$BinDir = Join-Path $env:USERPROFILE ".local\bin"
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

$CliWrapperPath = Join-Path $BinDir "atelier.cmd"
$WrapperContent = @"
@echo off
cd /d "$InstallDir"
npm start --workspace=packages/cli -- %*
"@
Set-Content -Path $CliWrapperPath -Value $WrapperContent

$CliWrapperPsPath = Join-Path $BinDir "atelier.ps1"
$WrapperPsContent = @"
`$currentLocation = Get-Location
Set-Location -Path "$InstallDir"
try {
    npm start --workspace=packages/cli -- `$args
} finally {
    Set-Location -Path `$currentLocation
}
"@
Set-Content -Path $CliWrapperPsPath -Value $WrapperPsContent

# Add to PATH if needed
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$Paths = $UserPath -split ";"

if ($Paths -notcontains $BinDir) {
    Write-Color "Adding $BinDir to user PATH..." $C_CYAN
    $NewPath = $UserPath + ";$BinDir"
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
    $env:PATH = $env:PATH + ";$BinDir"
    Write-Color "Note: The PATH environment variable has been updated." $C_YELLOW
    Write-Color "You may need to restart your terminal for the 'atelier' command to be available." $C_YELLOW
}

Write-Host ""
Write-Color "Installation successful!" $C_GREEN
Write-Host "You can now run Atelier MCP using the 'atelier' command."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run 'atelier --help' to get started."
Write-Host "  2. Explore recipes in $InstallDir\packages\recipes"

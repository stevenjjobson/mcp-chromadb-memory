# Validation script to check for exposed secrets in the codebase
# This script scans for potential API keys and secrets that shouldn't be committed

param(
    [string]$Path = (Get-Location).Path
)

Write-Host "Scanning for exposed secrets in: $Path" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow

$hasIssues = $false
$excludeDirs = @(".git", "node_modules", "dist", "build", "secrets", ".vscode", ".idea")

# Patterns to search for potential secrets
$secretPatterns = @(
    @{
        Name = "OpenAI API Key"
        Pattern = "sk-[a-zA-Z0-9]{48}"
        Severity = "Critical"
    },
    @{
        Name = "GitHub Personal Access Token"
        Pattern = "ghp_[a-zA-Z0-9]{36}"
        Severity = "Critical"
    },
    @{
        Name = "Generic API Key"
        Pattern = "api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]"
        Severity = "High"
    },
    @{
        Name = "Generic Secret"
        Pattern = "secret\s*[:=]\s*['\"][a-zA-Z0-9]{16,}['\"]"
        Severity = "High"
    },
    @{
        Name = "Base64 Encoded Secret"
        Pattern = "([A-Za-z0-9+/]{40,}={0,2})"
        Severity = "Medium"
    }
)

# Function to check file content
function Test-FileForSecrets {
    param(
        [string]$FilePath
    )
    
    # Skip binary files
    $binaryExtensions = @(".exe", ".dll", ".so", ".dylib", ".jpg", ".png", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz")
    $extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
    if ($binaryExtensions -contains $extension) {
        return
    }
    
    try {
        $content = Get-Content -Path $FilePath -Raw -ErrorAction Stop
        
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern.Pattern) {
                $script:hasIssues = $true
                $relativePath = $FilePath.Replace($Path, "").TrimStart("\", "/")
                
                Write-Host "`n[!] Found potential $($pattern.Name) in: $relativePath" -ForegroundColor Red
                Write-Host "    Severity: $($pattern.Severity)" -ForegroundColor Yellow
                
                # Show context around the match
                $lines = $content -split "`n"
                for ($i = 0; $i -lt $lines.Count; $i++) {
                    if ($lines[$i] -match $pattern.Pattern) {
                        $lineNum = $i + 1
                        Write-Host "    Line $lineNum`: $($lines[$i].Trim())" -ForegroundColor Gray
                    }
                }
            }
        }
    }
    catch {
        # Ignore files we can't read
    }
}

# Recursively scan directories
function Scan-Directory {
    param(
        [string]$DirectoryPath
    )
    
    Get-ChildItem -Path $DirectoryPath -File -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Replace($Path, "").TrimStart("\", "/")
        
        # Skip excluded directories
        $skip = $false
        foreach ($exclude in $excludeDirs) {
            if ($relativePath -like "*$exclude*") {
                $skip = $true
                break
            }
        }
        
        if (-not $skip) {
            Test-FileForSecrets -FilePath $_.FullName
        }
    }
}

# Check specific files that commonly contain secrets
$criticalFiles = @(
    ".env",
    "config.json",
    "settings.json",
    "docker-compose.yml",
    "docker-compose.yaml"
)

Write-Host "`nChecking critical files..." -ForegroundColor Cyan
foreach ($file in $criticalFiles) {
    $filePath = Join-Path $Path $file
    if (Test-Path $filePath) {
        Write-Host "  Checking: $file" -ForegroundColor Gray
        Test-FileForSecrets -FilePath $filePath
    }
}

# Check if .env exists and is not in .gitignore
$envPath = Join-Path $Path ".env"
$gitignorePath = Join-Path $Path ".gitignore"

if (Test-Path $envPath) {
    if (Test-Path $gitignorePath) {
        $gitignoreContent = Get-Content $gitignorePath -Raw
        if ($gitignoreContent -notmatch "\.env") {
            Write-Host "`n[!] WARNING: .env file exists but is not in .gitignore!" -ForegroundColor Red
            $hasIssues = $true
        }
    }
    else {
        Write-Host "`n[!] WARNING: .env file exists but no .gitignore found!" -ForegroundColor Red
        $hasIssues = $true
    }
}

# Scan all files
Write-Host "`nScanning all files for exposed secrets..." -ForegroundColor Cyan
Scan-Directory -DirectoryPath $Path

# Check git history for secrets (optional)
$checkGitHistory = Read-Host "`nCheck git history for secrets? (y/N)"
if ($checkGitHistory -eq 'y') {
    Write-Host "`nChecking git history..." -ForegroundColor Cyan
    
    # Get list of all files ever committed
    $gitFiles = git ls-tree -r HEAD --name-only 2>$null
    if ($gitFiles) {
        foreach ($file in $gitFiles) {
            $content = git show "HEAD:$file" 2>$null
            if ($content) {
                foreach ($pattern in $secretPatterns) {
                    if ($content -match $pattern.Pattern) {
                        Write-Host "[!] Found potential $($pattern.Name) in git history: $file" -ForegroundColor Red
                        $hasIssues = $true
                    }
                }
            }
        }
    }
}

# Summary
Write-Host "`n===========================================" -ForegroundColor Yellow
if ($hasIssues) {
    Write-Host "FAILED: Potential secrets found!" -ForegroundColor Red
    Write-Host "`nRecommendations:" -ForegroundColor Yellow
    Write-Host "1. Remove any exposed secrets immediately" -ForegroundColor White
    Write-Host "2. Rotate any exposed API keys" -ForegroundColor White
    Write-Host "3. Use the secure setup methods described in SECURE_SETUP.md" -ForegroundColor White
    Write-Host "4. If secrets were committed to git, consider rewriting history" -ForegroundColor White
    exit 1
}
else {
    Write-Host "PASSED: No exposed secrets found!" -ForegroundColor Green
    Write-Host "`nRemember to:" -ForegroundColor Cyan
    Write-Host "- Always use secure methods for storing API keys" -ForegroundColor White
    Write-Host "- Never commit secrets to version control" -ForegroundColor White
    Write-Host "- Regularly rotate your API keys" -ForegroundColor White
    exit 0
}
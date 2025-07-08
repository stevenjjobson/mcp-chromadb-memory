# Setup script for MCP ChromaDB Memory Server secrets
# This script stores API keys securely in Windows Credential Manager

param(
    [switch]$UseCredentialManager = $false
)

Write-Host "MCP ChromaDB Memory Server - Secure Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Function to store in Windows Credential Manager
function Store-SecureCredential {
    param(
        [string]$Name,
        [string]$Value
    )
    
    $secureValue = ConvertTo-SecureString $Value -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($Name, $secureValue)
    
    # Store in Windows Credential Manager
    $credentialParams = @{
        Target = "MCP_$Name"
        UserName = $env:USERNAME
        Password = $credential.Password
        Type = 'Generic'
        Persist = 'LocalMachine'
    }
    
    try {
        # Remove existing credential if it exists
        cmdkey /delete:"MCP_$Name" 2>$null
        
        # Store new credential
        $null = cmdkey /generic:"MCP_$Name" /user:$env:USERNAME /pass:$Value
        Write-Host "✓ Stored $Name in Windows Credential Manager" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Failed to store $Name in Credential Manager" -ForegroundColor Red
        throw $_
    }
}

# Create secrets directory
$secretsDir = Join-Path $PSScriptRoot "..\secrets"
if (-not (Test-Path $secretsDir)) {
    New-Item -ItemType Directory -Path $secretsDir -Force | Out-Null
    Write-Host "✓ Created secrets directory" -ForegroundColor Green
}

# Prompt for OpenAI API Key
$openaiKey = Read-Host "Enter your OpenAI API Key" -AsSecureString
$openaiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($openaiKey))

# Prompt for GitHub Access Token (optional)
Write-Host "`nGitHub Access Token (optional, press Enter to skip)" -ForegroundColor Yellow
$githubToken = Read-Host "Enter your GitHub Access Token" -AsSecureString
$githubTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($githubToken))

if ($UseCredentialManager) {
    # Store in Windows Credential Manager
    Store-SecureCredential -Name "OPENAI_API_KEY" -Value $openaiKeyPlain
    if ($githubTokenPlain) {
        Store-SecureCredential -Name "GITHUB_ACCESS_TOKEN" -Value $githubTokenPlain
    }
    
    Write-Host "`n✓ Secrets stored in Windows Credential Manager" -ForegroundColor Green
    Write-Host "  Use retrieve-secrets.ps1 to access them" -ForegroundColor Cyan
}
else {
    # Store in files for Docker secrets
    $openaiKeyFile = Join-Path $secretsDir "openai_api_key.txt"
    Set-Content -Path $openaiKeyFile -Value $openaiKeyPlain -NoNewline
    Write-Host "✓ Created $openaiKeyFile" -ForegroundColor Green
    
    if ($githubTokenPlain) {
        $githubTokenFile = Join-Path $secretsDir "github_access_token.txt"
        Set-Content -Path $githubTokenFile -Value $githubTokenPlain -NoNewline
        Write-Host "✓ Created $githubTokenFile" -ForegroundColor Green
    }
    
    # Set restrictive permissions on secrets directory
    $acl = Get-Acl $secretsDir
    $acl.SetAccessRuleProtection($true, $false)
    $permission = [System.Security.AccessControl.FileSystemAccessRule]::new(
        $env:USERNAME,
        "FullControl",
        "ContainerInherit,ObjectInherit",
        "None",
        "Allow"
    )
    $acl.SetAccessRule($permission)
    Set-Acl -Path $secretsDir -AclObject $acl
    
    Write-Host "`n✓ Secrets stored in $secretsDir with restricted permissions" -ForegroundColor Green
}

# Create or update Claude Desktop config
$claudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$claudeConfig = @{
    mcpServers = @{
        memory = @{
            command = "docker"
            args = @(
                "run", "-i", "--rm",
                "--network", "mcp-chromadb-memory_memory-network",
                "-e", "DOCKER_CONTAINER=true",
                "-e", "CHROMA_HOST=chromadb",
                "-e", "CHROMA_PORT=8000",
                "mcp-chromadb-memory-mcp-memory"
            )
        }
    }
}

if ($UseCredentialManager) {
    # Add script to retrieve credentials at runtime
    $claudeConfig.mcpServers.memory.args += @("-e", "OPENAI_API_KEY")
    Write-Host "`nNote: You'll need to set OPENAI_API_KEY environment variable from Credential Manager" -ForegroundColor Yellow
}

# Save Claude Desktop config
$claudeConfigJson = $claudeConfig | ConvertTo-Json -Depth 10
Set-Content -Path $claudeConfigPath -Value $claudeConfigJson

Write-Host "`n✓ Updated Claude Desktop configuration" -ForegroundColor Green
Write-Host "`nSetup complete! Next steps:" -ForegroundColor Green
Write-Host "1. Run 'docker-compose up -d' to start the services" -ForegroundColor Cyan
Write-Host "2. Restart Claude Desktop to load the new configuration" -ForegroundColor Cyan

# Clear sensitive variables
Clear-Variable -Name openaiKeyPlain, githubTokenPlain -ErrorAction SilentlyContinue
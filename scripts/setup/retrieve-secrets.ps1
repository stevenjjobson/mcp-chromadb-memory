# Retrieve secrets from Windows Credential Manager
# This script retrieves API keys stored securely in Windows Credential Manager

param(
    [string]$SecretName = "OPENAI_API_KEY",
    [switch]$AsEnvironmentVariable
)

function Get-SecureCredential {
    param(
        [string]$Name
    )
    
    try {
        # Use cmdkey to list credentials
        $credList = cmdkey /list | Select-String "MCP_$Name"
        
        if (-not $credList) {
            Write-Error "Credential 'MCP_$Name' not found in Windows Credential Manager"
            return $null
        }
        
        # Use Windows Credential Manager API
        Add-Type -AssemblyName System.Runtime.InteropServices
        Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredentialManager
{
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CredFree([In] IntPtr credentialPtr);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string GetCredential(string target)
    {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr))
        {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            byte[] passwordBytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, passwordBytes, 0, cred.CredentialBlobSize);
            CredFree(credPtr);
            return Encoding.Unicode.GetString(passwordBytes);
        }
        return null;
    }
}
"@

        $credential = [CredentialManager]::GetCredential("MCP_$Name")
        return $credential
    }
    catch {
        Write-Error "Failed to retrieve credential: $_"
        return $null
    }
}

# Retrieve the requested secret
$secretValue = Get-SecureCredential -Name $SecretName

if ($secretValue) {
    if ($AsEnvironmentVariable) {
        # Set as environment variable for current session
        [Environment]::SetEnvironmentVariable($SecretName, $secretValue, "Process")
        Write-Host "✓ Set $SecretName as environment variable for current session" -ForegroundColor Green
    }
    else {
        # Output the value (be careful with this!)
        Write-Output $secretValue
    }
}
else {
    Write-Error "Failed to retrieve $SecretName from Windows Credential Manager"
    Write-Host "Run ./setup-secrets.ps1 -UseCredentialManager to store secrets first" -ForegroundColor Yellow
    exit 1
}
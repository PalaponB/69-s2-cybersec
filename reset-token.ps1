param(
    [ValidateSet('admin', 'user')]
    [string]$Target = 'user'
)

$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Not found: $envFile"
}

if ($Target -eq 'admin') {
    $emailKey = 'ADMIN_EMAIL'
    $tokenKey = 'ADMIN_RESET_TOKEN'
    $table = 'admin_users'
} else {
    $emailKey = 'USER_EMAIL'
    $tokenKey = 'USER_RESET_CODE'
    $table = 'up_users'
}

$lines = Get-Content -LiteralPath $envFile
$emailLine = $lines | Where-Object { $_ -match "^$emailKey\s*=" } | Select-Object -First 1
if (-not $emailLine) {
    throw "Missing $emailKey in .env"
}
$email = ($emailLine -split '=', 2)[1].Trim()

# IAAA Identification: validate email format before building SQL (blocks SQL injection)
if ($email -notmatch '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') {
    throw "Invalid email format for ${emailKey}: $email"
}
$emailSql = $email -replace "'", "''"

$sql = "SELECT reset_password_token FROM $table WHERE email = '$emailSql' LIMIT 1;"
$token = (docker exec 69-s2-db psql -U postgres -d postgres -t -A -c $sql | Select-Object -Last 1).Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "No reset token for $email yet. Run forgot-password (api.http 1.3 / 2.3) first."
}

$updated = @()
$found = $false
foreach ($line in $lines) {
    if ($line -match "^$tokenKey\s*=") {
        $updated += "${tokenKey}=${token}"
        $found = $true
    } else {
        $updated += $line
    }
}
if (-not $found) {
    $updated += "${tokenKey}=${token}"
}

Set-Content -LiteralPath $envFile -Value $updated -Encoding ASCII

# IAAA Accounting: record this admin/dev retrieval to logs/ops-audit.log
$auditDir = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path -LiteralPath $auditDir)) {
    New-Item -ItemType Directory -Path $auditDir | Out-Null
}
$auditLine = [pscustomobject]@{
    ts     = (Get-Date).ToUniversalTime().ToString('o')
    event  = 'reset-token-retrieved'
    target = $Target
    email  = $email
    actor  = $env:USERNAME
} | ConvertTo-Json -Compress
Add-Content -LiteralPath (Join-Path $auditDir 'ops-audit.log') -Value $auditLine -Encoding UTF8

Write-Host "WARNING: configure SMTP in .env so reset codes reach the real email owner." -ForegroundColor Yellow
Write-Host "Done: ${tokenKey}=${token}"
Write-Host "Next: rerun api.http 1.3.1 (admin) or 2.3.1 (user) to reset the password."
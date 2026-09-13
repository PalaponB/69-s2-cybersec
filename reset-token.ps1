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
$email = ($emailLine -split '=', 2)[1].Trim()
if (-not $email) {
    throw "Missing $emailKey in .env"
}

$sql = "SELECT reset_password_token FROM $table WHERE email = '$email' LIMIT 1;"
$token = (docker exec 69-s2-db psql -U postgres -d postgres -t -A -c $sql | Select-Object -Last 1).Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "No reset token for $email yet. Run forgot-password (api.http 1.3 / 2.3) first."
}

$updated = @()
$found = $false
foreach ($line in $lines) {
    if ($line -match "^$tokenKey\s*=") {
        $updated += "$tokenKey=$token"
        $found = $true
    } else {
        $updated += $line
    }
}
if (-not $found) {
    $updated += "$tokenKey=$token"
}

Set-Content -LiteralPath $envFile -Value $updated -Encoding ASCII

Write-Host "Done: $tokenKey=$token"
Write-Host "Next: rerun api.http 1.3.1 (admin) or 2.3.1 (user) to reset the password."
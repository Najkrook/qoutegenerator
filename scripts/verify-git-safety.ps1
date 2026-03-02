$ErrorActionPreference = "Stop"

$trackedFiles = git ls-files

$blockedExact = @(
    "credentials.json",
    "token.json",
    "token.pickle",
    "API_keys.env",
    "inventory_db.json",
    "cloudflared.exe"
)

$blockedWildcards = @(
    "*.env"
)

$violations = @()

foreach ($file in $trackedFiles) {
    if ($blockedExact -contains $file) {
        $violations += $file
        continue
    }

    foreach ($pattern in $blockedWildcards) {
        if ($file -like $pattern) {
            $violations += $file
            break
        }
    }
}

if ($violations.Count -gt 0) {
    Write-Host "FAIL: Sensitive/local-only files are tracked:" -ForegroundColor Red
    $violations | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "PASS: No blocked sensitive/local-only files are tracked." -ForegroundColor Green

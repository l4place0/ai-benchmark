$ErrorActionPreference = 'Stop'
$v2Root = $PSScriptRoot
$env:TEMP = Join-Path $v2Root 'tmp'
$env:TMP = $env:TEMP
Push-Location -LiteralPath $v2Root
try {
    & (Join-Path $v2Root 'tools/node/node.exe') (Join-Path $v2Root 'scripts/verify-v2.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Verification failed: $LASTEXITCODE" }
} finally { Pop-Location }

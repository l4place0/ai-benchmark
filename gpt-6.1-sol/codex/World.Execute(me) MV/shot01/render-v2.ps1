$ErrorActionPreference = 'Stop'
$v2Root = $PSScriptRoot
$env:TEMP = Join-Path $v2Root 'tmp'
$env:TMP = $env:TEMP
Push-Location -LiteralPath $v2Root
try {
    $v2Script = if ($args.Count -eq 0) { 'scripts/render-v2-segmented.mjs' } else { 'scripts/render-v2.mjs' }
    & (Join-Path $v2Root 'tools/node/node.exe') (Join-Path $v2Root $v2Script) @args
    if ($LASTEXITCODE -ne 0) { throw "Render failed: $LASTEXITCODE" }
} finally { Pop-Location }

$ErrorActionPreference='Stop'
$env:TEMP=Join-Path $PSScriptRoot 'tmp'
$env:TMP=$env:TEMP
$env:NODE_OPTIONS=''
Set-Location -LiteralPath $PSScriptRoot
& './tools/node/node.exe' './scripts/verify.mjs'
if($LASTEXITCODE -ne 0){throw 'Video verification failed'}

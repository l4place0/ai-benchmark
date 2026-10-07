param([switch]$QA,[switch]$Preview)
$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
$env:TEMP=Join-Path $taskRoot 'tmp'
$env:TMP=$env:TEMP
$env:NODE_OPTIONS=''
$env:npm_config_cache=Join-Path $taskRoot 'cache/npm'
Set-Location -LiteralPath $taskRoot
if(!(Test-Path -LiteralPath 'assets/audio/analysis.json')){& './tools/node/node.exe' './scripts/analyze.mjs';if($LASTEXITCODE -ne 0){throw 'Audio analysis failed'}}
$renderArguments=@('./scripts/render.mjs')
if($QA){$renderArguments+='--qa'}
if($Preview){$renderArguments+='--preview'}
& './tools/node/node.exe' @renderArguments
if($LASTEXITCODE -ne 0){throw 'Render failed'}

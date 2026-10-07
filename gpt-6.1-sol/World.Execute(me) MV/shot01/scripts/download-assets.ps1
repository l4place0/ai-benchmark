$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$env:TEMP = Join-Path $taskRoot 'tmp'
$env:TMP = $env:TEMP
$ProgressPreference = 'SilentlyContinue'
function Download($url, $relative) {
  $destination = Join-Path $taskRoot $relative
  if (!(Test-Path -LiteralPath $destination)) {
    Write-Output "Downloading $relative"
    Invoke-WebRequest -Uri $url -OutFile $destination -TimeoutSec 240
  }
}
Download 'https://assets.ppy.sh/artists/331/Miracle%20Milk/Mili%20-%20world.execute(me)%3B.osz' 'assets/audio/original.osz'
Copy-Item -LiteralPath (Join-Path $taskRoot 'assets/audio/original.osz') -Destination (Join-Path $taskRoot 'tmp/audio.zip')
Expand-Archive -LiteralPath (Join-Path $taskRoot 'tmp/audio.zip') -DestinationPath (Join-Path $taskRoot 'assets/audio/source') -Force
Get-ChildItem -LiteralPath (Join-Path $taskRoot 'assets/audio/source') -File | Select-Object Name,Length
Download 'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2022/07/STScI-01GA6KKWG229B16K4Q38CH3BXS.png?fit=clip&w=2000' 'assets/textures/cosmic-cliffs.png'
Download 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf' 'assets/fonts/CormorantGaramond.ttf'
Download 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt' 'assets/fonts/CormorantGaramond-LICENSE.txt'
Download 'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf' 'assets/fonts/IBMPlexMono.ttf'
Download 'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/OFL.txt' 'assets/fonts/IBMPlexMono-LICENSE.txt'
Download 'https://registry.npmjs.org/three/-/three-0.180.0.tgz' 'cache/three.tgz'
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'tools/three') | Out-Null
tar -xzf (Join-Path $taskRoot 'cache/three.tgz') -C (Join-Path $taskRoot 'tools/three')
Write-Output 'Assets ready.'

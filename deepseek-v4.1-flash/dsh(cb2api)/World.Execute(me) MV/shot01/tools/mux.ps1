#!/usr/bin/env pwsh
# =====================================================================
#  Build the final deliverable: mux the rendered video with the audio master,
#  then verify the result.
# =====================================================================
param(
  [string]$Video = "out\video_silent.mp4",
  [string]$Audio = "audio\master_48k.wav",
  [string]$Out   = "out\world.execute(me) - THE INSTRUMENT.mp4"
)

$ErrorActionPreference = "Stop"
$base = $PSScriptRoot | Split-Path -Parent
Set-Location $base

Write-Host "=== inputs ==="
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,avg_frame_rate -of default=noprint_wrappers=1 $Video
Write-Host "--- audio ---"
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,sample_rate,channels -of default=noprint_wrappers=1 $Audio

Write-Host "`n=== muxing ==="
ffmpeg -y -hide_banner -loglevel error `
  -i $Video -i $Audio `
  -map 0:v:0 -map 1:a:0 `
  -c:v copy `
  -c:a aac -b:a 320k -ar 48000 -ac 2 `
  -shortest `
  -movflags "+faststart" `
  -metadata title="world.execute(me) - THE INSTRUMENT" `
  -metadata artist="procedural MV (Canvas/WebGL)" `
  -metadata comment="Procedurally generated fan MV. Song: Mili - world.execute(me)" `
  $Out

Write-Host "`n=== result ==="
ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels -of default=noprint_wrappers=1 $Out
Write-Host "`nwrote: $Out"

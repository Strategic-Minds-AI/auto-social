# X1 Bridge worker for Windows.
#
# Runs on the machine that hosts Ollama and Docker. It calls out to the app, picks up
# work, runs it locally and reports back — nothing dials in, so no port is opened and
# no tunnel is needed. The bridge key comes from the environment, never from this file.
#
#   $env:X1_BRIDGE_KEY  = '<the key the pairing code handed back>'   (required)
#   $env:X1_WORKER_NAME = 'JARVIS-COMMAND'                            (optional)
#   $env:X1_GATEWAY     = 'https://auto-social.base44.app/functions/x1Bridge'  (optional)
#   $env:X1_ALLOW_SHELL = '1'                                         (optional: accept host_shell jobs)
#
#   powershell -ExecutionPolicy Bypass -File .\x1-worker.ps1

$ErrorActionPreference = 'Stop'

$Gateway = if ($env:X1_GATEWAY) { $env:X1_GATEWAY } else { 'https://auto-social.base44.app/functions/x1Bridge' }
$Key = $env:X1_BRIDGE_KEY
$Name = if ($env:X1_WORKER_NAME) { $env:X1_WORKER_NAME } else { $env:COMPUTERNAME }
$AllowShell = ($env:X1_ALLOW_SHELL -eq '1')
$PollSeconds = 5

if (-not $Key) { throw 'Set X1_BRIDGE_KEY before starting this worker.' }

function Write-Log($message) {
  Write-Host ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $message)
}

function Invoke-Bridge {
  param([hashtable]$Payload)

  $Payload['key'] = $Key
  $body = $Payload | ConvertTo-Json -Depth 8 -Compress
  return Invoke-RestMethod -Method Post -Uri $Gateway -ContentType 'application/json' -Body $body -TimeoutSec 120
}

function Get-OllamaModels {
  try {
    $lines = & ollama list 2>$null
    if (-not $lines) { return @() }
    return @($lines | Select-Object -Skip 1 | ForEach-Object { ($_ -split '\s+')[0] } | Where-Object { $_ })
  } catch {
    return @()
  }
}

function Get-DockerVersion {
  try {
    $version = & docker version --format '{{.Server.Version}}' 2>$null
    return "$version".Trim()
  } catch {
    return ''
  }
}

function Get-WorkerReport {
  $models = Get-OllamaModels
  $dockerVersion = Get-DockerVersion
  $capabilities = @()
  if ($models.Count -gt 0) { $capabilities += 'ollama' }
  if ($dockerVersion) { $capabilities += 'docker' }
  if ($AllowShell) { $capabilities += 'host_shell' }

  return @{
    name             = $Name
    kind             = 'mixed'
    host             = $env:COMPUTERNAME
    platform         = 'windows'
    models           = $models
    ollama_version   = ''
    docker_available = [bool]$dockerVersion
    docker_version   = $dockerVersion
    shell_enabled    = $AllowShell
    capabilities     = $capabilities
    pid              = $PID
    uptime_seconds   = [int]([Environment]::TickCount / 1000)
    state_dir        = (Get-Location).Path
  }
}

# Each kind returns @{ ok = $true/$false; result = '...'; error = '...' }.
function Invoke-Job {
  param($Job)

  $started = Get-Date
  try {
    switch ($Job.kind) {
      'ollama_models' {
        $text = (& ollama list 2>&1 | Out-String)
        return @{ ok = $true; result = $text }
      }
      'ollama_chat' {
        if (-not $Job.model) { return @{ ok = $false; error = 'This job arrived with no model set.' } }
        $chat = @{
          model   = $Job.model
          prompt  = $Job.prompt
          stream  = $false
        }
        if ($Job.system_prompt) { $chat['system'] = $Job.system_prompt }
        $body = $chat | ConvertTo-Json -Depth 6 -Compress
        $reply = Invoke-RestMethod -Method Post -Uri 'http://localhost:11434/api/generate' `
          -ContentType 'application/json' -Body $body -TimeoutSec 900
        return @{ ok = $true; result = "$($reply.response)"; summary = "$($Job.model) answered" }
      }
      'docker_ps' {
        $text = (& docker ps --format '{{json .}}' 2>&1 | Out-String)
        return @{ ok = $true; result = $text }
      }
      'docker_images' {
        $text = (& docker images --format '{{json .}}' 2>&1 | Out-String)
        return @{ ok = $true; result = $text }
      }
      'docker_logs' {
        if (-not $Job.container) { return @{ ok = $false; error = 'This job arrived with no container name.' } }
        $tail = if ($Job.tail) { $Job.tail } else { 200 }
        $text = (& docker logs --tail $tail $Job.container 2>&1 | Out-String)
        return @{ ok = $true; result = $text }
      }
      'docker_run' {
        if (-not $Job.command) { return @{ ok = $false; error = 'This job arrived with no command.' } }
        $text = (& cmd /c "docker $($Job.command) 2>&1" | Out-String)
        return @{ ok = $true; result = $text }
      }
      'sandbox_run' {
        if (-not $Job.command) { return @{ ok = $false; error = 'This job arrived with no command.' } }
        $image = if ($Job.image) { $Job.image } else { 'alpine:latest' }
        $network = if ($Job.network) { $Job.network } else { 'none' }
        $text = (& cmd /c "docker run --rm --network $network $image $($Job.command) 2>&1" | Out-String)
        return @{ ok = $true; result = $text }
      }
      'host_shell' {
        if (-not $AllowShell) { return @{ ok = $false; error = 'This worker does not accept terminal jobs. Set X1_ALLOW_SHELL=1 to allow them.' } }
        if (-not $Job.command) { return @{ ok = $false; error = 'This job arrived with no command.' } }
        $directory = if ($Job.cwd) { $Job.cwd } else { (Get-Location).Path }
        $text = (& powershell -NoProfile -Command "Set-Location '$directory'; $($Job.command)" 2>&1 | Out-String)
        return @{ ok = $true; result = $text }
      }
      default {
        return @{ ok = $false; error = "This worker does not know the work kind '$($Job.kind)'." }
      }
    }
  } catch {
    return @{ ok = $false; error = $_.Exception.Message }
  } finally {
    $script:LastDuration = [int]((Get-Date) - $started).TotalMilliseconds
  }
}

Write-Log "Bridge worker $Name starting against $Gateway"

$connected = $false
$lastBeat = [datetime]::MinValue

while ($true) {
  try {
    if (((Get-Date) - $lastBeat).TotalSeconds -ge 60 -or -not $connected) {
      $beat = Invoke-Bridge @{ action = 'heartbeat'; worker = (Get-WorkerReport) }
      $lastBeat = Get-Date
      $connected = $true
      Write-Log "Registered as $($beat.worker_id) · $($beat.queued) job(s) queued"
    }

    $claim = Invoke-Bridge @{ action = 'claim'; worker = @{ name = $Name }; max = 3 }

    foreach ($job in @($claim.jobs)) {
      Write-Log "Picked up $($job.kind): $($job.title)"
      $outcome = Invoke-Job -Job $job

      $report = @{
        action      = 'complete'
        worker_name = $Name
        job_id      = $job.id
        status      = $(if ($outcome.ok) { 'done' } else { 'failed' })
      }
      if ($outcome.ok) {
        $report['result'] = "$($outcome.result)"
        $report['summary'] = if ($outcome.summary) { "$($outcome.summary)" } else { "$($job.title) finished" }
      } else {
        $report['error'] = "$($outcome.error)"
      }
      if ($script:LastDuration) { $report['duration_ms'] = $script:LastDuration }

      Invoke-Bridge $report | Out-Null
      Write-Log ("Reported {0} for {1}" -f $report['status'], $job.kind)
    }

    Start-Sleep -Seconds $PollSeconds
  } catch {
    $connected = $false
    Write-Log "Gateway unreachable: $($_.Exception.Message). Retrying in 15s."
    Start-Sleep -Seconds 15
  }
}
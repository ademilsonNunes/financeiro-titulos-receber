param(
  [string]$BaseUrl = 'http://10.0.132.4:8097',
  [string]$Username = 'admin',
  [string]$Password = 'admin',
  [switch]$VerboseLogs,
  [switch]$SaveToSession
)

function Log($msg) { if ($VerboseLogs) { Write-Host ("[api-test] " + $msg) -ForegroundColor Cyan } }
function Red($msg) { Write-Host $msg -ForegroundColor Red }
function Green($msg) { Write-Host $msg -ForegroundColor Green }

if (-not ($BaseUrl -match '^https?://')) { Red "BaseUrl must include http/https. Current: $BaseUrl"; exit 1 }

# Normalize to include /app-root when not provided
$root = ($BaseUrl.TrimEnd('/'))
if ($root -notmatch '/app-root$') { $root = $root + '/app-root' }

$tokenCandidates = @(
  @{ Method = 'POST';  Url = "$root/api/oauth2/v1/token";   Grant = 'PASSWORD' },
  @{ Method = 'POST';  Url = "$root/api/oauth2/v1/token";   Grant = 'password' },
  @{ Method = 'GET';   Url = "$root/api/oauth2/v1/token";   Grant = 'PASSWORD' },
  @{ Method = 'GET';   Url = "$root/api/oauth2/v1/token";   Grant = 'password' },
  @{ Method = 'POST';  Url = "$root/oauth2/v1/token";       Grant = 'PASSWORD' },
  @{ Method = 'POST';  Url = "$root/oauth2/v1/token";       Grant = 'password' },
  @{ Method = 'GET';   Url = "$root/oauth2/v1/token";       Grant = 'PASSWORD' },
  @{ Method = 'GET';   Url = "$root/oauth2/v1/token";       Grant = 'password' }
)

$headers = @{ 'Accept' = '*/*' }

$best = $null
foreach ($c in $tokenCandidates) {
  try {
    Log "Trying $($c.Method) $($c.Url) grant_type=$($c.Grant)"
    if ($c.Method -eq 'POST') {
      $body = "grant_type=$($c.Grant)`&username=$($Username)`&password=$([Uri]::EscapeDataString($Password))"
      $resp = Invoke-RestMethod -Uri $c.Url -Method Post -Headers $headers -ContentType 'application/x-www-form-urlencoded' -Body $body -TimeoutSec 30
    } else {
      $qs = "grant_type=$($c.Grant)`&username=$($Username)`&password=$([Uri]::EscapeDataString($Password))"
      $resp = Invoke-RestMethod -Uri ($c.Url + '?' + $qs) -Method Get -Headers $headers -TimeoutSec 30
    }
    if ($resp -and $resp.access_token) {
      Green "OK -> token received via $($c.Method) $($c.Url) grant=$($c.Grant)"
      $best = @{ meta = $c; token = $resp }
      break
    } else {
      Log ("No token field. Response: " + ($resp | ConvertTo-Json -Compress))
    }
  } catch {
    Log ("Failed: " + $_.Exception.Message)
  }
}

if (-not $best) { Red 'Could not obtain token with tested combinations.'; exit 2 }

$out = @{ acquiredAt = (Get-Date).ToString('s'); baseUrl = $BaseUrl; normalizedRoot = $root; username = $Username; method = $best.meta.Method; url = $best.meta.Url; grant = $best.meta.Grant; response = $best.token }
$outPath = Join-Path (Resolve-Path '.').Path '_totvs_token.json'
$out | ConvertTo-Json | Set-Content -LiteralPath $outPath -Encoding UTF8
Green "Saved token to $outPath"

$apiUrl = "$root/api/v1/titulos-receber"
try {
  $authHeaders = @{ 'Authorization' = "Bearer $($best.token.access_token)"; 'Accept' = '*/*' }
  $res = Invoke-WebRequest -Uri $apiUrl -Headers $authHeaders -Method Get -TimeoutSec 30 -ErrorAction Stop
  Green ("GET /v1/titulos-receber -> HTTP " + $res.StatusCode)
  if ($res.StatusCode -eq 200) {
    $content = $res.Content; if ($content -is [byte[]]) { $text = [System.Text.Encoding]::UTF8.GetString($content) } else { $text = [string]$content }
    $snippet = $text.Substring(0, [Math]::Min(300, $text.Length))
    Log ("Body preview: " + $snippet)
  }
} catch {
  Log ("Protected resource check failed: " + $_.Exception.Message)
}

# Optional: prepare DevTools sessionStorage snippet
if ($SaveToSession) {
  $token = $best.token.access_token
  $js = "sessionStorage.setItem('insideProtheus','0');`n" +
        "sessionStorage.setItem('ERPTOKEN', JSON.stringify({ access_token: '$token', token_type: 'Bearer' }));`n" +
        "location.reload();" 
  $devtoolsPath = Join-Path (Resolve-Path '.').Path '_devtools_set_token.txt'
  Set-Content -LiteralPath $devtoolsPath -Encoding UTF8 -Value $js
  Write-Host "Copy/paste into DevTools Console (F12 -> Console):" -ForegroundColor Yellow
  Write-Host $js -ForegroundColor Yellow
  Write-Host "Saved snippet to $devtoolsPath" -ForegroundColor Yellow
}

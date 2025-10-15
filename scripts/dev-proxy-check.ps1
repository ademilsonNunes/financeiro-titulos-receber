param(
  [string]$BaseUrl = 'http://10.0.132.4:8097',
  [int]$DevPort = 4200,
  [string]$Username = 'admin',
  [string]$Password = 'admin',
  [switch]$VerboseLogs
)

function Log($m){ if($VerboseLogs){ Write-Host $m -ForegroundColor Cyan } }
function Green($m){ Write-Host $m -ForegroundColor Green }
function Red($m){ Write-Host $m -ForegroundColor Red }

$results=@()
$grants=@('PASSWORD','password')

# 1) Direct host check (absolute, with /app-root)
$directOk=$false
foreach($g in $grants){
  try{
    $qs = 'grant_type=' + $g + '&username=' + $Username + '&password=' + [Uri]::EscapeDataString($Password)
    $tokUrl = ($BaseUrl.TrimEnd('/')) + '/app-root/api/oauth2/v1/token?' + $qs
    Log ('POST ' + $tokUrl)
    $t = Invoke-RestMethod -Uri $tokUrl -Method Post -Headers @{Accept='*/*'} -TimeoutSec 30
    $token = $t.access_token
    if($token){ Green ('Direct token OK (' + $g + ')'); $results += 'direct-token:PASS'; $directOk=$true } else { Red 'Direct token FAIL (no access_token)'; $results += 'direct-token:FAIL' }
    if($token){
      $auth=@{Authorization=('Bearer ' + $token); Accept='*/*'}
      $listUrl = ($BaseUrl.TrimEnd('/')) + '/app-root/api/v1/titulos-receber'
      Log ('GET ' + $listUrl)
      $r = Invoke-WebRequest -Uri $listUrl -Headers $auth -TimeoutSec 30 -ErrorAction Stop
      if($r.StatusCode -eq 200){ Green 'Direct list OK'; $results += 'direct-list:PASS' } else { Red ('Direct list HTTP ' + $r.StatusCode); $results += 'direct-list:FAIL' }
    }
    if($directOk){ break }
  } catch {
    $msg = $_.Exception.Message
    $code = ''
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    Red ('Direct check error (' + $g + '): HTTP ' + $code + ' - ' + $msg)
    $results += 'direct:ERROR'
  }
}

# 2) Dev proxy check (localhost:port/api/... ) if port open
$devUp = $false
try { $devUp = Test-NetConnection -ComputerName 'localhost' -Port $DevPort -InformationLevel Quiet } catch { $devUp = $false }
if($devUp){
  foreach($g in $grants){
    try {
      $px = 'http://localhost:' + $DevPort
      $qs = 'grant_type=' + $g + '&username=' + $Username + '&password=' + [Uri]::EscapeDataString($Password)
      $tokUrl = $px + '/api/oauth2/v1/token?' + $qs
      Log ('POST ' + $tokUrl + ' (proxy)')
      $t = Invoke-RestMethod -Uri $tokUrl -Method Post -Headers @{Accept='*/*'} -TimeoutSec 30
      $token = $t.access_token
      if($token){ Green ('Proxy token OK (' + $g + ')'); $results += 'proxy-token:PASS' } else { Red 'Proxy token FAIL (no access_token)'; $results += 'proxy-token:FAIL' }
      if($token){
        $auth=@{Authorization=('Bearer ' + $token); Accept='*/*'}
        $listUrl = $px + '/api/v1/titulos-receber'
        Log ('GET ' + $listUrl + ' (proxy)')
        $r = Invoke-WebRequest -Uri $listUrl -Headers $auth -TimeoutSec 30 -ErrorAction Stop
        if($r.StatusCode -eq 200){ Green 'Proxy list OK'; $results += 'proxy-list:PASS'; break } else { Red ('Proxy list HTTP ' + $r.StatusCode); $results += 'proxy-list:FAIL' }
      }
    } catch { $msg=$_.Exception.Message; $code=''; try{$code=$_.Exception.Response.StatusCode.value__}catch{}; Red ('Proxy check error (' + $g + '): HTTP ' + $code + ' - ' + $msg); $results += 'proxy:ERROR' }
  }
} else { Log ('Dev server not detected at localhost:' + $DevPort + '; skipping proxy checks.') }

$summary = @{ }
foreach($r in $results){ $k,$v = $r.Split(':',2); $summary[$k] = $v }
$summary | ConvertTo-Json

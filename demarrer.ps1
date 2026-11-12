$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$siteUrl = 'http://localhost:3000/?lang=fr'
$siteReady = $false
try {
    $response = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 3
    if ($response.Content -match 'Car-Fit24') { $siteReady = $true }
    else { throw 'Le port 3000 est utilise par un autre projet.' }
} catch {
    if ($_.Exception.Message -like '*autre projet*') { throw }
}
if (-not $siteReady) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'Installation npm impossible.' }
    }
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run dev -- --port 3000' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            $response = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 2
            if ($response.Content -match 'Car-Fit24') { $siteReady = $true; break }
        } catch {}
    }
}
if (-not $siteReady) { throw 'Lancement impossible. Lancez npm run dev dans ce dossier pour voir les details.' }
Start-Process $siteUrl
Write-Output 'Accueil client ouvert. Aucune connexion requise.'

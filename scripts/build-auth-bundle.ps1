# Regenera styles/auth-bundle.css tras editar tokens/base/components/login/mobile
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot/..
$parts = @(
  "styles/tokens.css",
  "styles/base.css",
  "styles/components.css",
  "styles/login.css",
  "styles/mobile.css"
)
$sep = "`n`n/* --- mirest bundle --- */`n`n"
$text = "/* auth-bundle: generado por scripts/build-auth-bundle.ps1 */`n`n" + (($parts | ForEach-Object { Get-Content -Raw $_ }) -join $sep)
[IO.File]::WriteAllText("$PWD/styles/auth-bundle.css", $text, [Text.UTF8Encoding]::new($false))
Write-Host "OK styles/auth-bundle.css" (Get-Item styles/auth-bundle.css).Length "bytes"

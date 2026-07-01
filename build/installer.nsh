!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Selamat Datang di Easy Tunnel Setup"
  !define MUI_WELCOMEPAGE_TEXT "Wizard ini akan memandu Anda dalam proses instalasi Easy Tunnel Gateway Manager."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  DetailPrint "Membersihkan sisa background service dan port versi lama..."
  
  # Hentikan dan hapus task lama (jika ada)
  nsExec::Exec 'schtasks /End /TN "EasyTunnelBackend"'
  nsExec::Exec 'schtasks /Delete /TN "EasyTunnelBackend" /F'

  # Hentikan proses yang mengunci port 7080 jika ada
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "Get-NetTCPConnection -LocalPort 7080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $$_.OwningProcess -Force -ErrorAction SilentlyContinue }"'

  # Hentikan dan uninstall semua layanan WireGuard et-* yang menggantung
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "Get-Service -Name ''WireGuardTunnel*et-*'' -ErrorAction SilentlyContinue | ForEach-Object { & ''C:\Program Files\WireGuard\wireguard.exe'' /uninstalltunnelservice ($$_.Name -replace ''WireGuardTunnel\$$'', '''') }"'
!macroend

!macro customUninstall
  DetailPrint "Membersihkan layanan terowongan dan port yang terpasang..."

  # Bersihkan task lama
  nsExec::Exec 'schtasks /End /TN "EasyTunnelBackend"'
  nsExec::Exec 'schtasks /Delete /TN "EasyTunnelBackend" /F'

  # Hentikan proses pada port 7080
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "Get-NetTCPConnection -LocalPort 7080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $$_.OwningProcess -Force -ErrorAction SilentlyContinue }"'

  # Uninstall semua layanan WireGuard et-* yang terpasang
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "Get-Service -Name ''WireGuardTunnel*et-*'' -ErrorAction SilentlyContinue | ForEach-Object { & ''C:\Program Files\WireGuard\wireguard.exe'' /uninstalltunnelservice ($$_.Name -replace ''WireGuardTunnel\$$'', '''') }"'
!macroend



; ═══════════════════════════════════════════════════════════
; RCS Club Setup — NSIS Installer Script
; Production Release v1.0.0
; ═══════════════════════════════════════════════════════════

!define APP_NAME "RCS Club"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "RCS Club Management System"
!define APP_URL "https://rcs-club.dz"
!define APP_EXE "RCS Club.exe"
!define APP_ID "com.rcs.club"

; ─── Include Modern UI ───
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"

; ─── General ───
Unicode True
Name "${APP_NAME}"
OutFile "RCS Club Setup v${APP_VERSION}.exe"
InstallDir "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show
ManifestDPIAware True

; ─── Version Information ───
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "${APP_NAME} Setup Installer"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 ${APP_PUBLISHER}"

; ─── Interface Settings ───
!define MUI_ABORTWARNING
!define MUI_ICON "public\images\icon.ico"
!define MUI_UNICON "public\images\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "public\images\icon-256.png"
!define MUI_WELCOMEFINISHPAGE_BITMAP "public\images\icon-256.png"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "تشغيل ${APP_NAME} الآن"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_FINISHPAGE_NOAUTOCLOSE

; ─── Pages ───
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ─── Uninstaller Pages ───
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ─── Languages ───
!insertmacro MUI_LANGUAGE "Arabic"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "French"

; ─── Sections ───
Section "RCS Club (Required)" SecCore
  SectionIn RO
  SetOutPath "$INSTDIR"
  
  ; ─── Copy files ───
  File /r "dist\win-unpacked\*.*"
  
  ; ─── Create uninstaller ───
  WriteUninstaller "$INSTDIR\Uninstall ${APP_NAME}.exe"
  
  ; ─── Registry entries ───
  WriteRegStr HKLM "Software\${APP_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\${APP_NAME}" "Version" "${APP_VERSION}"
  
  ; ─── Add to Add/Remove Programs ───
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$\"$INSTDIR\Uninstall ${APP_NAME}.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "QuietUninstallString" "$\"$INSTDIR\Uninstall ${APP_NAME}.exe$\" /S"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "URLInfoAbout" "${APP_URL}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoRepair" 1
  
  ; ─── Calculate installed size ───
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "EstimatedSize" "$0"
  
  ; ─── Create shortcuts ───
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall ${APP_NAME}.exe" "" "$INSTDIR\Uninstall ${APP_NAME}.exe" 0
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  
  ; ─── File association (optional) ───
  ; يمكن إضافة ارتباطات ملفات هنا لاحقاً
  
SectionEnd

; ─── Section Descriptions ───
LangString DESC_SecCore ${LANG_ARABIC} "البرنامج الأساسي ${APP_NAME}"
LangString DESC_SecCore ${LANG_ENGLISH} "${APP_NAME} core application files"
LangString DESC_SecCore ${LANG_FRENCH} "Fichiers principaux de ${APP_NAME}"

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${SecCore} $(DESC_SecCore)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ─── Uninstaller Section ───
Section "Uninstall"
  ; ─── Kill running app ───
  ExecWait "taskkill /F /IM $\"${APP_EXE}$\"" $0
  
  ; ─── Delete files ───
  RMDir /r /REBOOTOK "$INSTDIR"
  
  ; ─── Remove shortcuts ───
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  
  ; ─── Remove registry entries ───
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  DeleteRegKey HKLM "Software\${APP_NAME}"
  
  ; ─── Remove user data (optional — comment to keep) ───
  ; RMDir /r "$APPDATA\${APP_NAME}"
  ; RMDir /r "$LOCALAPPDATA\${APP_NAME}"
SectionEnd

; ─── Functions ───
Function .onInit
  ; ─── Check Windows 64-bit ───
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "هذا البرنامج يتطلب Windows 64-bit.$\n$\nThis application requires 64-bit Windows."
    Abort
  ${EndIf}
  
  ; ─── Set installation directory for 64-bit ───
  SetRegView 64
FunctionEnd

Function un.onInit
  SetRegView 64
FunctionEnd

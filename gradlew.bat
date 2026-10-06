@echo off
set DIR=%~dp0
cd /d "%DIR%android"
call gradlew.bat %*
set BUILD_STATUS=%ERRORLEVEL%
cd /d "%DIR%"
if exist "%DIR%android\app\build\outputs\apk" (
    if not exist "%DIR%app\build\outputs\apk" mkdir "%DIR%app\build\outputs\apk"
    xcopy /E /I /Y "%DIR%android\app\build\outputs\apk" "%DIR%app\build\outputs\apk" >nul 2>&1
)
exit /b %BUILD_STATUS%

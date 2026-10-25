@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo [1/2] 패키지 설치 중...
call npm install
if errorlevel 1 (
  echo 설치 실패. 위 에러를 Claude 에게 알려주세요.
  pause
  exit /b 1
)
echo [2/2] 개발 서버 실행 - http://localhost:3000
call npm run dev
pause

/** 테마 저장 키 */
export const THEME_KEY = "gyupage.theme";

/**
 * layout.tsx <head> 에 넣는 초기 스크립트.
 * 화면이 그려지기 전에 테마를 정해서 깜빡임을 막음.
 * 저장된 선택이 없으면 시스템(OS) 설정을 따름.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();`;

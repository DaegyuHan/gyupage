/** 테마 저장 키 */
export const THEME_KEY = "gyupage.theme";

/**
 * layout.tsx <head> 에 넣는 초기 스크립트.
 * 화면이 그려지기 전에 테마를 정해서 깜빡임을 막음.
 * 기본은 다크 모드. 라이트로 직접 바꾼 적이 있을 때만 라이트.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})();`;

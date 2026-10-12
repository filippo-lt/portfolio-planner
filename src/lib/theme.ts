export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_KEY = 'theme';
const COLORS = { light: '#f4f5fa', dark: '#0d0e14' };

/**
 * Inline, pre-paint: resolves the saved preference (or the OS one) onto <html data-theme>,
 * syncs the browser chrome color, and keeps following the OS (and other tabs) while open.
 * Exposed as window.__applyTheme so the settings sheet can re-run it.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="light"&&t!=="dark")t=m.matches?"dark":"light";d.setAttribute("data-theme",t);var e=document.querySelector('meta[name="theme-color"]');if(!e){e=document.createElement("meta");e.name="theme-color";document.head.appendChild(e)}e.content=t==="dark"?${JSON.stringify(COLORS.dark)}:${JSON.stringify(COLORS.light)}}a();m.addEventListener("change",a);addEventListener("storage",a);window.__applyTheme=a})()`;

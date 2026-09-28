// Instagram's and Facebook's in-app browsers can inject scripts and drop storage.
// Detect them and ask people to open the link in Safari or Chrome before any key is handled.
const IN_APP_MARKERS = /Instagram|FBAN|FBAV|FB_IAB|FBIOS/;

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_MARKERS.test(userAgent);
}

/** Связка PWA ↔ APK RuStore (Pro через native Pay SDK) */

const APK_FLAG_KEY = 'raschody-apk';

export const PRO_PRODUCT_ID = 'raschody_pro';

function stripQueryParam(name) {
  const url = new URL(location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  history.replaceState({}, '', url.pathname + url.search + url.hash);
}

/** APK передаёт ?from=apk при запуске TWA */
export function markApkContext() {
  const params = new URLSearchParams(location.search);
  if (params.get('from') === 'apk') {
    localStorage.setItem(APK_FLAG_KEY, '1');
    stripQueryParam('from');
  }
}

export function isRuStoreApk() {
  return localStorage.getItem(APK_FLAG_KEY) === '1';
}

/** Native передаёт ?pro=1|0 после проверки покупки */
export function syncNativePro(settings, saveSettings) {
  const params = new URLSearchParams(location.search);
  const pro = params.get('pro');
  if (pro === '1') {
    settings.isPro = true;
    saveSettings(settings);
    stripQueryParam('pro');
    return true;
  }
  if (pro === '0') {
    settings.isPro = false;
    saveSettings(settings);
    stripQueryParam('pro');
    return true;
  }
  return false;
}

/** Открывает оплату в native-слое APK */
export function requestProPurchase() {
  window.location.href = 'raschody://pay';
}

export function canBuyPro(settings) {
  return isRuStoreApk() && !settings.isPro;
}

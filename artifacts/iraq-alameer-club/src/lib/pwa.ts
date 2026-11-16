export function registerPublicWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    }).catch(() => {
      console.warn("تعذر تثبيت ملفات الواجهة؛ يمكنك استخدام النظام أثناء الاتصال بالإنترنت.");
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

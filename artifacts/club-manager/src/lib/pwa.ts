export function registerPublicWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    }).catch(() => {
      // Online access must still work when a browser disallows installation.
      console.warn("تعذر تفعيل العمل دون اتصال؛ يمكنك استخدام الموقع أثناء الاتصال.");
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

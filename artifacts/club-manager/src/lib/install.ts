export interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
export const getInstallPrompt = () => deferred;
export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function clearInstallPrompt() { deferred = null; listeners.forEach(fn => fn()); }
// Capture before React/lazy page imports, including visits to the landing page.
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault(); deferred = event as InstallEvent; listeners.forEach(fn => fn());
});
window.addEventListener("appinstalled", clearInstallPrompt);

/**
 * Auth signal — apiFetch (lib/api/client) ile AuthProvider arasında
 * tek-yönlü iletişim.
 *
 * AuthProvider mount'ta `registerSignOutCallback(cb)` çağırır. apiFetch
 * 401 görünce `emitSignOut()` çağırır → cb tetiklenir → provider logout
 * yapar + /login'e yönlendirir. Bu sayede stale token'larla sessiz
 * dolaşmayız.
 */

type Callback = () => void;

const callbacks = new Set<Callback>();

export function registerSignOutCallback(cb: Callback): () => void {
  callbacks.add(cb);
  return () => callbacks.delete(cb);
}

export function emitSignOut(): void {
  for (const cb of callbacks) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

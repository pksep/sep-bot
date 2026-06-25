/**
 * Bound a dependency probe so a hung side-service (a Redis/Postgres socket that
 * neither resolves nor rejects) can't make the readiness check hang forever.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} (timed out after ${ms}ms)`)),
      ms
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

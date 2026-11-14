const NAME = 'norma-em-cena-estudio';
const KEY = 'workspace';

let connection;
function db() {
  return connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction(mode, callback) {
  const conn = await db();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('projects', mode);
    const request = callback(tx.objectStore('projects'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
export const load = () => transaction('readonly', store => store.get(KEY));
export const save = (project, versions) =>
  transaction('readwrite', store => store.put({ project, versions }, KEY));

export function subscribeToSosEvents(onEvent) {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const source = new EventSource(`${base}/sos/events`);
  for (const type of ['sos.created','sos.location','sos.status']) source.addEventListener(type,e=>onEvent(type,JSON.parse(e.data)));
  return ()=>source.close();
}

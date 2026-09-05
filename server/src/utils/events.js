const clients = new Set();
export function addClient(res) { clients.add(res); res.on('close', () => clients.delete(res)); }
export function publish(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(data);
}

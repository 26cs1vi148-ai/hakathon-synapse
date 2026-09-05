import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const icon = new L.Icon({iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',iconSize:[25,41],iconAnchor:[12,41]});
function Recenter({position}){const map=useMap(); map.setView(position); return null;}
export default function MapView({latitude,longitude,name}){
  if(typeof latitude!=='number'||typeof longitude!=='number') return <div className="map-empty">Location unavailable</div>;
  const position=[latitude,longitude];
  return <MapContainer center={position} zoom={17} className="map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Recenter position={position}/><Marker position={position} icon={icon}><Popup><strong>{name}</strong><br/>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Popup></Marker></MapContainer>;
}

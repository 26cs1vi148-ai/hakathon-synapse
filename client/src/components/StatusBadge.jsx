export default function StatusBadge({status}){return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>}

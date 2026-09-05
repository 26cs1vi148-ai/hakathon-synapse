export function buildWhatsAppUrl({
  phone,
  name,
  studentId,
  hostel,
  room,
  latitude,
  longitude,
  timestamp,
}) {
  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  const message = `🚨 CAMPUS SOS ALERT 🚨

I need immediate assistance.

Student: ${name}
Student ID: ${studentId}
Hostel: ${hostel}
Room: ${room}

📍 Current Location:
${mapsUrl}

📡 Coordinates:
${latitude}, ${longitude}

⏰ Time: ${timestamp}

Please respond immediately.`;

  const target = String(phone || "").replace(/\D/g, "");

  if (!target) {
    throw new Error("No emergency contact WhatsApp number is configured.");
  }

  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(url) {
  window.location.href = url;
}
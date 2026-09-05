import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Crosshair,
  MapPin,
  Phone,
  Shield,
  UserRound,
} from 'lucide-react';

import { createSos, updateLocation, updateStatus } from '../services/api';
import { getCurrentLocation } from '../services/geolocation';
import { buildWhatsAppUrl } from '../services/whatsapp';

const initial = {
  name: 'Rahul Sharma',
  studentId: 'STU1024',
  hostel: 'Boys Hostel',
  room: 'B-204',
  phone: '919876543210',
};

export default function StudentPage() {
  const [student, setStudent] = useState(
    () =>
      JSON.parse(localStorage.getItem('campusStudent') || 'null') || initial
  );

  const [status, setStatus] = useState('READY');
  const [alert, setAlert] = useState(null);
  const [location, setLocation] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const watchRef = useRef(null);
  const lastRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('campusStudent', JSON.stringify(student));
  }, [student]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
    };
  }, []);

  const trigger = async () => {
    if (busy || ['ACTIVE', 'RESPONDED'].includes(status)) return;

    if (
      !window.confirm(
        'Confirm emergency SOS? This will create an alert and request your GPS location.'
      )
    ) {
      return;
    }

    setBusy(true);
    setStatus('GETTING LOCATION');
    setMessage('Getting your location…');

    try {
      const pos = await getCurrentLocation();

      setLocation(pos);
      setMessage('Creating emergency alert…');

      const created = await createSos({
        ...student,
        ...pos,
      });

      setAlert(created);
      setStatus('ACTIVE');

      setMessage(
        'SOS is ACTIVE. Your live location is being shared with campus security. WhatsApp will open with the emergency message.'
      );

      startTracking(created.id);

      const url = buildWhatsAppUrl({
        ...student,
        ...pos,
        timestamp: new Date().toLocaleString(),
      });

      // Keep Campus SOS page open.
      // Open normal WhatsApp link separately.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setStatus('READY');
      setMessage(e.message || 'Unable to create SOS.');
    } finally {
      setBusy(false);
    }
  };

  const startTracking = (id) => {
    if (!navigator.geolocation) return;

    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
    }

    watchRef.current = navigator.geolocation.watchPosition(
      async (p) => {
        const now = Date.now();

        const pos = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        };

        setLocation(pos);

        // Send location to server at most once every 8 seconds.
        if (now - lastRef.current < 8000) return;

        lastRef.current = now;

        try {
          const updated = await updateLocation(id, pos);
          setAlert(updated);
        } catch (e) {
          console.warn('Location update failed:', e);
        }
      },
      (e) => {
        console.warn('GPS tracking error:', e);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  };

  const resolve = async () => {
    if (!alert) return;

    setBusy(true);

    try {
      const updated = await updateStatus(alert.id, 'RESOLVED');

      setAlert(updated);
      setStatus('RESOLVED');

      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }

      watchRef.current = null;

      setMessage(
        'You are marked SAFE. The SOS has been resolved and live location sharing has stopped.'
      );
    } catch (e) {
      setMessage('Could not resolve the SOS. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const updateField = (key, value) => {
    setStudent((s) => ({
      ...s,
      [key]: value,
    }));
  };

  const sosActive = status === 'ACTIVE' || status === 'RESPONDED';

  return (
    <main className="student-shell">
      <div className="student-container">

        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">
              <Shield />
            </div>

            <div>
              <b>Campus SOS</b>
              <span>Student emergency system</span>
            </div>
          </div>

          <a href="/security" className="nav-link">
            Security dashboard
          </a>
        </header>

        <section className="hero">

          <div className="hero-copy">
            <span className="live-pill">
              <span /> Campus emergency support
            </span>

            <h1>
              Need help?
              <br />
              <strong>Get assistance now.</strong>
            </h1>

            <p>
              Your location is shared with campus security only while an SOS
              is active.
            </p>
          </div>

          <button
            className="sos-button"
            disabled={busy || sosActive}
            onClick={trigger}
          >
            <div>
              <AlertTriangle size={46} />

              <span>
                {busy ? 'WAIT' : sosActive ? 'ACTIVE' : 'SOS'}
              </span>

              <small>
                {sosActive ? 'Emergency Active' : 'Emergency'}
              </small>
            </div>
          </button>

        </section>

        {message && (
          <div
            className={`notice ${
              status === 'READY'
                ? 'notice-error'
                : 'notice-info'
            }`}
          >
            {message}
          </div>
        )}

        <section className="profile-card">
          <div className="section-title">
            <UserRound size={18} />

            <div>
              <b>Student profile</b>
              <span>Used to identify your emergency alert</span>
            </div>
          </div>

          <div className="form-grid">
            {[
              ['name', 'Student name'],
              ['studentId', 'Student ID'],
              ['hostel', 'Hostel'],
              ['room', 'Room number'],
              ['phone', 'Emergency WhatsApp number'],
            ].map(([key, label]) => (
              <label key={key}>
                {label}

                <input
                  value={student[key]}
                  onChange={(e) =>
                    updateField(key, e.target.value)
                  }
                  disabled={sosActive}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="status-card">

          <div className="section-title">
            <Crosshair size={18} />

            <div>
              <b>Emergency status</b>
              <span>Current SOS and location state</span>
            </div>
          </div>

          <div className="status-row">

            <div>
              <small>Status</small>

              <strong
                className={`text-${status
                  .toLowerCase()
                  .replaceAll(' ', '-')}`}
              >
                {status}
              </strong>
            </div>

            <div>
              <small>GPS</small>

              <strong>
                {location ? 'Location available' : 'Waiting'}
              </strong>
            </div>

            <div>
              <small>Tracking</small>

              <strong>
                {sosActive ? 'LIVE' : 'Stopped'}
              </strong>
            </div>

          </div>

          {location && (
            <div className="coords">
              <MapPin size={17} />

              <span>
                {location.latitude.toFixed(6)},{' '}
                {location.longitude.toFixed(6)}
              </span>

              <span>
                ±{Math.round(location.accuracy)}m
              </span>
            </div>
          )}

          {alert && sosActive && (
            <button
              className="btn btn-green full"
              onClick={resolve}
              disabled={busy}
              style={{
                fontSize: '20px',
                fontWeight: '700',
                padding: '18px',
                marginTop: '18px',
              }}
            >
              <CheckCircle size={22} />

              {busy ? 'PLEASE WAIT...' : 'I AM SAFE'}
            </button>
          )}

          {student.phone && (
            <a
              className="emergency-contact"
              href={`tel:${student.phone}`}
            >
              <Phone size={17} />

              <span>
                <b>Emergency contact</b>
                <small>{student.phone}</small>
              </span>
            </a>
          )}

        </section>

        <footer>
          Campus SOS demo · GPS is used only for emergency tracking.
        </footer>

      </div>
    </main>
  );
}
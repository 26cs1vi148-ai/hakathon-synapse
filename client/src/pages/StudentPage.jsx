import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Crosshair,
  MapPin,
  Phone,
  Shield,
  UserRound,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
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

  const [fakeCall, setFakeCall] = useState(false);
  const [callConnected, setCallConnected] = useState(false);
  const [callMuted, setCallMuted] = useState(false);

  const watchRef = useRef(null);
  const ringtoneRef = useRef(null);
  const lastRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('campusStudent', JSON.stringify(student));
  }, [student]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation?.clearWatch(watchRef.current);
      }

      if (ringtoneRef.current) {
        stopRingtone();
      }
    };
  }, []);

  const startFakeCall = () => {
    setFakeCall(true);
    setCallConnected(false);
    setCallMuted(false);
  };

  const declineFakeCall = () => {
    setFakeCall(false);
    setCallConnected(false);

    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const acceptFakeCall = () => {
    setCallConnected(true);

    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const toggleMute = () => {
    setCallMuted((value) => !value);
  };
const startRingtone = () => {
  if (ringtoneRef.current) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  ctx.resume();
  const gain = ctx.createGain();

  gain.gain.value = 0.12;
  gain.connect(ctx.destination);

  const ring = () => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    osc1.frequency.value = 700;
    osc2.frequency.value = 900;

    osc1.connect(gain);
    osc2.connect(gain);

    osc1.start();
    osc2.start();

    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  };

  ring();

  const timer = setInterval(ring, 1200);

  ringtoneRef.current = { ctx, gain, timer };
};

const stopRingtone = () => {
  if (!ringtoneRef.current) return;

  clearInterval(ringtoneRef.current.timer);
  ringtoneRef.current.ctx.close();

  ringtoneRef.current = null;
};
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

          <button
            type="button"
            onClick={startFakeCall}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '15px',
              borderRadius: '14px',
              border: '1px solid #dbe3ee',
              background: '#f8fafc',
              color: '#172033',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <PhoneCall size={20} />
            SIMULATE CAMPUS CALL
          </button>

        </section>

        <footer>
          Campus SOS demo · GPS is used only for emergency tracking.
        </footer>

      </div>

      {fakeCall && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background:
              'linear-gradient(180deg, #17202a 0%, #263238 100%)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '70px 28px 45px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '15px',
                opacity: 0.75,
                marginBottom: '28px',
              }}
            >
              {callConnected ? 'CALL IN PROGRESS' : 'INCOMING CALL'}
            </div>

            <div
              style={{
                width: '105px',
                height: '105px',
                borderRadius: '50%',
                background: '#455a64',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 22px',
                boxShadow: '0 0 0 8px rgba(255,255,255,0.06)',
              }}
            >
              <Shield size={52} />
            </div>

            <div
              style={{
                fontSize: '30px',
                fontWeight: '600',
                marginBottom: '8px',
              }}
            >
              MOM
            </div>

            <div
              style={{
                fontSize: '17px',
                opacity: 0.7,
              }}
            >
              {callConnected
                ? 'Connected · Demo Call'
                : 'Mobile · Demo Call'}
            </div>
          </div>

          {!callConnected ? (
            <div
              style={{
                width: '100%',
                maxWidth: '360px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={declineFakeCall}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#e53935',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 10px',
                    cursor: 'pointer',
                  }}
                >
                  <PhoneOff size={30} />
                </button>

                <span style={{ fontSize: '14px', opacity: 0.8 }}>
                  Decline
                </span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={acceptFakeCall}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#20c45a',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 10px',
                    cursor: 'pointer',
                  }}
                >
                  <PhoneCall size={30} />
                </button>

                <span style={{ fontSize: '14px', opacity: 0.8 }}>
                  Accept
                </span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '16px',
                  opacity: 0.8,
                  marginBottom: '22px',
                }}
              >
                This is a demonstration call.
              </div>

              <button
                type="button"
                onClick={toggleMute}
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  cursor: 'pointer',
                }}
              >
                {callMuted ? <VolumeX /> : <Volume2 />}
              </button>

              <div style={{ fontSize: '14px', opacity: 0.8 }}>
                {callMuted ? 'Muted' : 'Speaker'}
              </div>

              <button
                type="button"
                onClick={declineFakeCall}
                style={{
                  marginTop: '35px',
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#e53935',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <PhoneOff size={30} />
              </button>

              <div style={{ marginTop: '10px', fontSize: '14px' }}>
                End call
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
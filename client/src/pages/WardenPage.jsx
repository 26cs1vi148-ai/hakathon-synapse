import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  MapPin,
  RefreshCw,
  Shield,
  UserRound,
  FileText,
  CheckCircle,
  ChevronDown
} from 'lucide-react';

import {
  getAlerts,
  updateStatus,
  createStudentInvite,
  getStudents
} from '../services/api';

import { subscribeToSosEvents } from '../services/realtime';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';

export default function WardenPage() {
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');

  const [studentsLoading, setStudentsLoading] = useState(true);

  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [newSosPopup, setNewSosPopup] = useState(null);

  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const knownAlertsRef = useRef(new Set());
  const soundRef = useRef(null);
  const soundIntervalRef = useRef(null);

  // Keeps the latest student list available to live-event callbacks.
  const studentsRef = useRef([]);

  /* =========================
     EMERGENCY SOUND
  ========================= */

  const stopEmergencySound = () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }

    if (soundRef.current) {
      try {
        soundRef.current.close();
      } catch {}

      soundRef.current = null;
    }
  };

  const playEmergencySound = () => {
    stopEmergencySound();

    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    try {
      const ctx = new AudioContext();
      soundRef.current = ctx;

      const beep = () => {
        if (!soundRef.current || ctx.state === 'closed') {
          return;
        }

        try {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();

          oscillator.frequency.value = 850;
          gain.gain.value = 0.18;

          oscillator.connect(gain);
          gain.connect(ctx.destination);

          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.35);
        } catch {}
      };

      beep();

      soundIntervalRef.current = setInterval(
        beep,
        700
      );
    } catch (error) {
      console.error('Emergency sound error:', error);
    }
  };

  /* =========================
     ADD STUDENT / QR
  ========================= */

  const handleAddStudent = async () => {
    setInviteLoading(true);
    setError('');

    try {
      const data = await createStudentInvite();

      setInviteUrl(data.inviteUrl);
      setInviteExpiry(data.expiresAt);
      setShowInvite(true);
    } catch (error) {
      console.error(error);
      setError('Could not create student invite.');
    } finally {
      setInviteLoading(false);
    }
  };

  /* =========================
     LOAD STUDENTS
  ========================= */

  const loadStudents = async () => {
    setStudentsLoading(true);

    try {
      const data = await getStudents();

      const list = Array.isArray(data)
        ? data
        : [];

      studentsRef.current = list;
      setStudents(list);

      // If currently selected student no longer exists,
      // automatically return to ALL.
      setSelectedStudentId((current) => {
        if (current === 'ALL') {
          return current;
        }

        const exists = list.some(
          (student) =>
            (student.studentId || student.id) ===
            current
        );

        return exists ? current : 'ALL';
      });

      return list;
    } catch (error) {
      console.error('Could not load students:', error);

      studentsRef.current = [];
      setStudents([]);

      setError(
        'Could not load connected students. Please make sure the warden is logged in.'
      );

      return [];
    } finally {
      setStudentsLoading(false);
    }
  };

  /* =========================
     FIND ALERTS BELONGING
     TO THIS WARDEN
  ========================= */

  const getWardenAlerts = (
    alertList,
    studentList = studentsRef.current
  ) => {
    if (!Array.isArray(alertList)) {
      return [];
    }

    if (!Array.isArray(studentList)) {
      return [];
    }

    const studentIds = new Set(
      studentList.map(
        (student) =>
          student.studentId || student.id
      )
    );

    return alertList.filter((alert) =>
      studentIds.has(alert.studentId)
    );
  };

  /* =========================
     LOGOUT
  ========================= */

  const handleLogout = async () => {
    try {
      stopEmergencySound();

      await signOut(auth);

      window.location.href =
        '/warden-login';
    } catch {
      setError(
        'Could not log out. Please try again.'
      );
    }
  };

  /* =========================
     LOAD SOS ALERTS
  ========================= */

  const loadAlerts = async () => {
    try {
      const data = await getAlerts();

      const list = Array.isArray(data)
        ? data
        : [];

      const visibleList =
        getWardenAlerts(list);

      /*
       * IMPORTANT:
       * Only alerts belonging to students connected
       * to this warden can trigger the emergency sound.
       */

      const attendingAlert =
        visibleList.find(
          (a) => a.status === 'ATTENDING'
        );

      if (attendingAlert) {
        stopEmergencySound();
        setNewSosPopup(null);
      }

      /*
       * First load should not make every old SOS
       * look like a new SOS.
       */

      if (knownAlertsRef.current.size > 0) {
        const newAlert =
          visibleList.find(
            (a) =>
              !knownAlertsRef.current.has(a.id) &&
              a.status === 'ACTIVE'
          );

        if (newAlert) {
          setNewSosPopup(newAlert);
          playEmergencySound();
        }
      }

      knownAlertsRef.current =
        new Set(
          visibleList.map((a) => a.id)
        );

      /*
       * Keep the complete server response in state.
       * The UI filters it using the connected students.
       */
      setAlerts(list);

      return list;
    } catch (error) {
      console.error(
        'Could not load SOS alerts:',
        error
      );

      setError(
        'Could not load SOS alerts. Make sure the backend is running on port 5000.'
      );

      return [];
    }
  };

  /* =========================
     REFRESH EVERYTHING
  ========================= */

  const handleRefresh = async () => {
    setError('');

    const list = await loadStudents();

    /*
     * loadAlerts uses studentsRef, which now contains
     * the freshly loaded students.
     */
    await loadAlerts(list);
  };

  /* =========================
     INITIAL LOAD + LIVE EVENTS
  ========================= */

  useEffect(() => {
    let mounted = true;

    const initialise = async () => {
      const list = await loadStudents();

      if (!mounted) return;

      await loadAlerts(list);
    };

    initialise();

    const unsubscribe =
      subscribeToSosEvents(() => {
        /*
         * Whenever a new SOS event arrives:
         * refresh students and alerts.
         */
        loadStudents().then(() => {
          loadAlerts();
        });
      });

    return () => {
      mounted = false;

      try {
        unsubscribe?.();
      } catch {}

      stopEmergencySound();
    };
  }, []);

  /* =========================
     VISIBLE ALERTS
  ========================= */

  const visibleAlerts = useMemo(() => {
    if (studentsLoading) {
      return [];
    }

    const studentIds = new Set(
      students.map(
        (student) =>
          student.studentId || student.id
      )
    );

    return alerts.filter((alert) =>
      studentIds.has(alert.studentId)
    );
  }, [
    alerts,
    students,
    studentsLoading
  ]);

  /* =========================
     SELECTED STUDENT FILTER
  ========================= */

  const studentAlerts = useMemo(() => {
    if (
      selectedStudentId === 'ALL'
    ) {
      return visibleAlerts;
    }

    return visibleAlerts.filter(
      (alert) =>
        alert.studentId ===
        selectedStudentId
    );
  }, [
    visibleAlerts,
    selectedStudentId
  ]);

  /* =========================
     ACTIVE / RESOLVED
  ========================= */

  const activeAlerts = useMemo(
    () =>
      studentAlerts.filter((a) =>
        [
          'ACTIVE',
          'ATTENDING',
          'SAFE'
        ].includes(a.status)
      ),
    [studentAlerts]
  );

  const resolvedAlerts = useMemo(
    () =>
      studentAlerts.filter(
        (a) =>
          a.status === 'RESOLVED'
      ),
    [studentAlerts]
  );

  /* =========================
     UPDATE SOS STATUS
  ========================= */

  const markStatus = async (
    id,
    status
  ) => {
    const note =
      (notes[id] || '').trim();

    /*
     * Resolving an SOS ALWAYS requires
     * the warden to describe what was done.
     */
    if (
      status === 'RESOLVED' &&
      !note
    ) {
      setError(
        'Please describe what you did for the student before resolving the SOS.'
      );
      return;
    }

    setBusyId(id);
    setError('');

    const wardenEmail =
      auth.currentUser?.email || '';

    try {
      const updated =
        await updateStatus(
          id,
          status,
          note,
          wardenEmail
        );

      setAlerts((items) =>
        items.map((item) =>
          item.id === id
            ? updated
            : item
        )
      );

      setNotes((items) => ({
        ...items,
        [id]: ''
      }));

      if (
        status === 'ATTENDING'
      ) {
        stopEmergencySound();
        setNewSosPopup(null);
      }

      if (
        status === 'RESOLVED'
      ) {
        stopEmergencySound();
        setNewSosPopup(null);
      }
    } catch (error) {
      console.error(error);

      setError(
        'Could not update the SOS status.'
      );
    } finally {
      setBusyId(null);
    }
  };

  /* =========================
     HISTORY HELPERS
  ========================= */

  const getActionHistory = (
    alert
  ) => {
    if (
      !Array.isArray(
        alert.actionHistory
      )
    ) {
      return [];
    }

    return alert.actionHistory;
  };

  const getWardenNotes = (
    alert
  ) => {
    if (
      !Array.isArray(
        alert.wardenNotes
      )
    ) {
      return [];
    }

    return alert.wardenNotes;
  };

  /* =========================
     SELECTED STUDENT
  ========================= */

  const selectedStudent =
    students.find(
      (student) =>
        (student.studentId ||
          student.id) ===
        selectedStudentId
    ) || null;

  /* =========================
     TIME FORMAT
  ========================= */

  const formatTime = (
    value
  ) => {
    if (!value) {
      return '—';
    }

    try {
      return new Date(
        value
      ).toLocaleString(
        'en-IN',
        {
          timeZone:
            'Asia/Kolkata'
        }
      );
    } catch {
      return String(value);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f4f7fb',
        padding: 24
      }}
    >

      {/* =========================
          QR INVITE MODAL
      ========================= */}

      {showInvite && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'center',
            zIndex: 9999,
            padding: 20
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 18,
              padding: 28,
              textAlign: 'center',
              boxSizing:
                'border-box'
            }}
          >
            <h2
              style={{
                marginTop: 0
              }}
            >
              Add Student
            </h2>

            <p
              style={{
                color: '#64748b'
              }}
            >
              Ask the student to scan
              this QR code to create
              their Campus SOS
              account.
            </p>

            {inviteUrl && (
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'center',
                  margin:
                    '24px 0'
                }}
              >
                <QRCodeSVG
                  value={
                    inviteUrl
                  }
                  size={240}
                  level="H"
                />
              </div>
            )}

            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                wordBreak:
                  'break-all'
              }}
            >
              Invite expires:{' '}
              {inviteExpiry
                ? new Date(
                    inviteExpiry
                  ).toLocaleString()
                : '—'}
            </p>

            <button
              onClick={() =>
                setShowInvite(
                  false
                )
              }
              style={{
                marginTop: 12,
                width: '100%',
                padding:
                  '12px 16px',
                border: 'none',
                borderRadius: 10,
                background:
                  '#1d4ed8',
                color: '#fff',
                fontWeight: 700,
                cursor:
                  'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* =========================
          NEW SOS POPUP
      ========================= */}

      {newSosPopup && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            width:
              'min(380px, calc(100vw - 40px))',
            background: '#fff',
            border:
              '2px solid #ef4444',
            borderRadius: 14,
            padding: 18,
            boxShadow:
              '0 15px 40px rgba(0,0,0,0.2)',
            zIndex: 9998
          }}
        >
          <div
            style={{
              color: '#b91c1c',
              fontWeight: 800,
              fontSize: 18
            }}
          >
            🚨 NEW SOS ALERT
          </div>

          <h3
            style={{
              margin:
                '10px 0 5px'
            }}
          >
            {newSosPopup.name ||
              'Unknown student'}
          </h3>

          <div
            style={{
              color: '#475569'
            }}
          >
            Student ID:{' '}
            {newSosPopup.studentId ||
              '—'}
          </div>

          <button
            onClick={() => {
              stopEmergencySound();
              setNewSosPopup(
                null
              );
            }}
            style={{
              marginTop: 14,
              width: '100%',
              padding: 10,
              border: 'none',
              borderRadius: 8,
              background:
                '#dc2626',
              color: '#fff',
              fontWeight: 700,
              cursor:
                'pointer'
            }}
          >
            View / Attend SOS
          </button>
        </div>
      )}

      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto'
        }}
      >

        {/* =========================
            HEADER
        ========================= */}

        <header
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: 15,
            marginBottom: 24,
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <Shield size={30} />

            <div>
              <h1
                style={{
                  margin: 0
                }}
              >
                Warden Dashboard
              </h1>

              <p
                style={{
                  margin:
                    '4px 0 0',
                  color:
                    '#64748b'
                }}
              >
                Live Campus SOS
                monitoring
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap:
                'wrap',
              gap: 10
            }}
          >
            <button
              onClick={
                handleRefresh
              }
              style={{
                padding:
                  '10px 14px',
                borderRadius: 10,
                border:
                  '1px solid #cbd5e1',
                background: '#fff',
                cursor:
                  'pointer'
              }}
            >
              <RefreshCw
                size={17}
                style={{
                  verticalAlign:
                    'middle'
                }}
              />{' '}
              Refresh
            </button>

            <button
              onClick={
                handleLogout
              }
              style={{
                padding:
                  '10px 14px',
                borderRadius: 10,
                border:
                  '1px solid #fecaca',
                background: '#fff',
                color:
                  '#b91c1c',
                cursor:
                  'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* =========================
            CONNECTED STUDENTS
        ========================= */}

        <section
          style={{
            background: '#fff',
            border:
              '1px solid #dbeafe',
            borderRadius: 14,
            padding: 18,
            marginBottom: 22,
            boxShadow:
              '0 3px 12px rgba(15,23,42,0.04)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12
            }}
          >
            <UserRound size={21} />

            <h2
              style={{
                margin: 0,
                fontSize: 19
              }}
            >
              Connected Students
            </h2>

            <span
              style={{
                background:
                  '#eff6ff',
                color:
                  '#1d4ed8',
                borderRadius:
                  999,
                padding:
                  '4px 9px',
                fontSize: 12,
                fontWeight: 700
              }}
            >
              {students.length}
            </span>
          </div>

          {studentsLoading ? (
            <div
              style={{
                padding: 20,
                textAlign:
                  'center',
                color:
                  '#64748b',
                background:
                  '#f8fafc',
                borderRadius:
                  10
              }}
            >
              Loading connected
              students...
            </div>
          ) : (
            <>
              {/* STUDENT DROPDOWN */}

              <div
                style={{
                  position:
                    'relative'
                }}
              >
                <select
                  value={
                    selectedStudentId
                  }
                  onChange={(e) => {
                    const value =
                      e.target.value;

                    if (
                      value ===
                      '__ADD_STUDENT__'
                    ) {
                      setSelectedStudentId(
                        'ALL'
                      );

                      handleAddStudent();

                      return;
                    }

                    setSelectedStudentId(
                      value
                    );
                  }}
                  style={{
                    width: '100%',
                    appearance:
                      'none',
                    padding:
                      '13px 45px 13px 14px',
                    borderRadius:
                      10,
                    border:
                      '1px solid #cbd5e1',
                    background:
                      '#f8fafc',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor:
                      'pointer'
                  }}
                >
                  <option value="ALL">
                    👥 All Connected
                    Students
                  </option>

                  {students.map(
                    (student) => {
                      const id =
                        student.studentId ||
                        student.id;

                      return (
                        <option
                          key={id}
                          value={id}
                        >
                          {student.name ||
                            'Unnamed Student'}{' '}
                          —{' '}
                          {id ||
                            'No ID'}
                        </option>
                      );
                    }
                  )}

                  <option value="__ADD_STUDENT__">
                    ➕ Add Student
                  </option>
                </select>

                <ChevronDown
                  size={18}
                  style={{
                    position:
                      'absolute',
                    right: 14,
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                    pointerEvents:
                      'none'
                  }}
                />
              </div>

              {/* ADD STUDENT BUTTON AT BOTTOM */}

              <button
                onClick={
                  handleAddStudent
                }
                disabled={
                  inviteLoading
                }
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding:
                    '12px 16px',
                  borderRadius: 10,
                  border:
                    '1px solid #bfdbfe',
                  background:
                    '#eff6ff',
                  color:
                    '#1d4ed8',
                  cursor:
                    inviteLoading
                      ? 'not-allowed'
                      : 'pointer',
                  fontWeight: 800
                }}
              >
                {inviteLoading
                  ? 'Creating QR...'
                  : '➕ Add Student'}
              </button>

              {/* NO STUDENTS MESSAGE */}

              {students.length ===
                0 && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 10,
                    background:
                      '#fff7ed',
                    border:
                      '1px solid #fed7aa',
                    color:
                      '#9a3412',
                    fontSize: 14
                  }}
                >
                  <strong>
                    No students connected
                    yet.
                  </strong>

                  <div
                    style={{
                      marginTop: 5
                    }}
                  >
                    Click
                    <strong>
                      {' '}
                      ➕ Add Student
                    </strong>{' '}
                    below and give the
                    generated QR code to
                    the student.
                  </div>
                </div>
              )}

              {/* SELECTED STUDENT INFO */}

              {selectedStudent && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 10,
                    background:
                      '#f8fafc',
                    border:
                      '1px solid #e2e8f0'
                  }}
                >
                  <strong>
                    {
                      selectedStudent.name
                    }
                  </strong>

                  <div
                    style={{
                      marginTop: 5,
                      color:
                        '#64748b',
                      fontSize: 14
                    }}
                  >
                    ID:{' '}
                    {selectedStudent.studentId ||
                      selectedStudent.id ||
                      '—'}
                    {' • '}
                    {selectedStudent.hostel ||
                      'Hostel —'}
                    {' • '}
                    Room{' '}
                    {selectedStudent.room ||
                      '—'}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* =========================
            ERROR
        ========================= */}

        {error && (
          <div
            style={{
              padding: 14,
              marginBottom: 18,
              borderRadius: 10,
              background:
                '#fee2e2',
              color:
                '#991b1b'
            }}
          >
            {error}
          </div>
        )}

        {/* =========================
            ACTIVE COUNT
        ========================= */}

        <section
          style={{
            padding: 18,
            marginBottom: 20,
            borderRadius: 14,
            background: '#fff',
            border:
              '1px solid #e2e8f0'
          }}
        >
          <strong>
            {activeAlerts.length}{' '}
            active SOS alert
            {activeAlerts.length ===
            1
              ? ''
              : 's'}
          </strong>

          <span
            style={{
              marginLeft: 10,
              color:
                '#64748b'
            }}
          >
            {selectedStudent
              ? `Showing alerts for ${selectedStudent.name}`
              : 'Alerts currently requiring attention'}
          </span>
        </section>

        {/* =========================
            ACTIVE SOS
        ========================= */}

        <h2
          style={{
            marginBottom: 14
          }}
        >
          🚨 Active SOS
        </h2>

        {activeAlerts.length ===
        0 ? (
          <section
            style={{
              padding: 35,
              marginBottom: 35,
              textAlign:
                'center',
              borderRadius: 14,
              background: '#fff',
              border:
                '1px solid #e2e8f0'
            }}
          >
            <Shield size={42} />

            <h3>
              No active SOS
            </h3>

            <p
              style={{
                color:
                  '#64748b'
              }}
            >
              New student SOS
              alerts will appear
              here automatically.
            </p>
          </section>
        ) : (
          <div
            style={{
              display:
                'grid',
              gap: 18,
              marginBottom:
                40
            }}
          >
            {activeAlerts.map(
              (alert) => (
                <article
                  key={alert.id}
                  style={{
                    background:
                      '#fff',
                    border:
                      '1px solid #fecaca',
                    borderRadius:
                      14,
                    padding: 20,
                    boxShadow:
                      '0 5px 18px rgba(127,29,29,0.06)'
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',
                      justifyContent:
                        'space-between',
                      gap: 15,
                      flexWrap:
                        'wrap'
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: 8
                        }}
                      >
                        <AlertTriangle
                          size={
                            22
                          }
                        />

                        <h3
                          style={{
                            margin:
                              0
                          }}
                        >
                          {alert.name ||
                            'Unknown student'}
                        </h3>
                      </div>

                      <p
                        style={{
                          margin:
                            '8px 0 0',
                          color:
                            '#64748b'
                        }}
                      >
                        Student ID:{' '}
                        <strong>
                          {alert.studentId ||
                            '—'}
                        </strong>
                      </p>
                    </div>

                    <span
                      style={{
                        padding:
                          '6px 10px',
                        borderRadius:
                          999,
                        background:
                          alert.status ===
                          'ATTENDING'
                            ? '#fef3c7'
                            : '#fee2e2',
                        color:
                          alert.status ===
                          'ATTENDING'
                            ? '#92400e'
                            : '#991b1b',
                        fontWeight:
                          800,
                        fontSize:
                          12
                      }}
                    >
                      {alert.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display:
                        'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit,minmax(180px,1fr))',
                      gap: 10,
                      marginTop:
                        16
                    }}
                  >
                    <div
                      style={{
                        padding:
                          12,
                        background:
                          '#f8fafc',
                        borderRadius:
                          10
                      }}
                    >
                      <strong>
                        Hostel
                      </strong>

                      <div
                        style={{
                          color:
                            '#64748b',
                          marginTop:
                            3
                        }}
                      >
                        {alert.hostel ||
                          '—'}
                      </div>
                    </div>

                    <div
                      style={{
                        padding:
                          12,
                        background:
                          '#f8fafc',
                        borderRadius:
                          10
                      }}
                    >
                      <strong>
                        Room
                      </strong>

                      <div
                        style={{
                          color:
                            '#64748b',
                          marginTop:
                            3
                        }}
                      >
                        {alert.room ||
                          '—'}
                      </div>
                    </div>

                    <div
                      style={{
                        padding:
                          12,
                        background:
                          '#f8fafc',
                        borderRadius:
                          10
                      }}
                    >
                      <strong>
                        Phone
                      </strong>

                      <div
                        style={{
                          color:
                            '#64748b',
                          marginTop:
                            3
                        }}
                      >
                        {alert.phone ||
                          '—'}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop:
                        16,
                      padding:
                        14,
                      background:
                        '#f8fafc',
                      borderRadius:
                        10
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: 7,
                        fontWeight:
                          700
                      }}
                    >
                      <MapPin
                        size={
                          18
                        }
                      />
                      Current Location
                    </div>

                    <div
                      style={{
                        marginTop:
                          7,
                        color:
                          '#64748b'
                      }}
                    >
                      {alert.latitude !=
                        null &&
                      alert.longitude !=
                        null
                        ? `${alert.latitude}, ${alert.longitude}`
                        : 'Location not available'}
                    </div>

                    {alert.latitude !=
                      null &&
                      alert.longitude !=
                        null && (
                        <a
                          href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display:
                              'inline-block',
                            marginTop:
                              8,
                            color:
                              '#1d4ed8',
                            fontWeight:
                              700
                          }}
                        >
                          Open in Google
                          Maps
                        </a>
                      )}
                  </div>

                  <div
                    style={{
                      marginTop:
                        16,
                      padding:
                        14,
                      borderRadius:
                        10,
                      background:
                        '#fff7ed',
                      border:
                        '1px solid #fed7aa'
                    }}
                  >
                    <label
                      style={{
                        display:
                          'block',
                        fontWeight:
                          700,
                        marginBottom:
                          8
                      }}
                    >
                      <FileText
                        size={
                          17
                        }
                        style={{
                          verticalAlign:
                            'middle'
                        }}
                      />{' '}
                      Warden Action /
                      Resolution Note
                    </label>

                    <textarea
                      value={
                        notes[
                          alert.id
                        ] || ''
                      }
                      onChange={(e) =>
                        setNotes(
                          (items) => ({
                            ...items,
                            [alert.id]:
                              e.target
                                .value
                          })
                        )
                      }
                      placeholder="Describe what you did for this student..."
                      rows={3}
                      style={{
                        width:
                          '100%',
                        boxSizing:
                          'border-box',
                        resize:
                          'vertical',
                        padding:
                          11,
                        borderRadius:
                          8,
                        border:
                          '1px solid #cbd5e1',
                        fontFamily:
                          'inherit'
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display:
                        'flex',
                      gap: 10,
                      flexWrap:
                        'wrap',
                      marginTop:
                        14
                    }}
                  >
                    <button
                      onClick={() =>
                        markStatus(
                          alert.id,
                          'ATTENDING'
                        )
                      }
                      disabled={
                        busyId ===
                        alert.id
                      }
                      style={{
                        padding:
                          '11px 16px',
                        border:
                          'none',
                        borderRadius:
                          9,
                        background:
                          '#f59e0b',
                        color:
                          '#fff',
                        fontWeight:
                          800,
                        cursor:
                          'pointer'
                      }}
                    >
                      {busyId ===
                      alert.id
                        ? 'Updating...'
                        : '⚠️ ATTEND'}
                    </button>

                    <button
                      onClick={() =>
                        markStatus(
                          alert.id,
                          'RESOLVED'
                        )
                      }
                      disabled={
                        busyId ===
                        alert.id
                      }
                      style={{
                        padding:
                          '11px 16px',
                        border:
                          'none',
                        borderRadius:
                          9,
                        background:
                          '#16a34a',
                        color:
                          '#fff',
                        fontWeight:
                          800,
                        cursor:
                          'pointer'
                      }}
                    >
                      <CheckCircle
                        size={
                          16
                        }
                        style={{
                          verticalAlign:
                            'middle'
                        }}
                      />{' '}
                      RESOLVE
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop:
                        12,
                      color:
                        '#64748b',
                      fontSize:
                        13
                    }}
                  >
                    Created:{' '}
                    {formatTime(
                      alert.createdAt
                    )}
                  </div>
                </article>
              )
            )}
          </div>
        )}

        {/* =========================
            RESOLVED SOS HISTORY
        ========================= */}

        <h2
          style={{
            marginBottom: 14
          }}
        >
          📋 Resolved SOS History
        </h2>

        {resolvedAlerts.length ===
        0 ? (
          <section
            style={{
              padding: 30,
              marginBottom: 35,
              textAlign:
                'center',
              borderRadius: 14,
              background: '#fff',
              border:
                '1px solid #e2e8f0'
            }}
          >
            <FileText
              size={40}
            />

            <h3>
              No resolved SOS yet
            </h3>

            <p
              style={{
                color:
                  '#64748b'
              }}
            >
              Resolved SOS cases
              will appear here with
              the warden's action
              history.
            </p>
          </section>
        ) : (
          <div
            style={{
              display:
                'grid',
              gap: 18,
              paddingBottom:
                30
            }}
          >
            {resolvedAlerts.map(
              (alert) => {
                const history =
                  getActionHistory(
                    alert
                  );

                const wardenNotes =
                  getWardenNotes(
                    alert
                  );

                return (
                  <article
                    key={
                      alert.id
                    }
                    style={{
                      background:
                        '#fff',
                      border:
                        '1px solid #bbf7d0',
                      borderRadius:
                        14,
                      padding:
                        20
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        gap: 15,
                        flexWrap:
                          'wrap'
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin:
                              0
                          }}
                        >
                          {
                            alert.name
                          }
                        </h3>

                        <div
                          style={{
                            marginTop:
                              5,
                            color:
                              '#64748b'
                          }}
                        >
                          Student ID:{' '}
                          {alert.studentId ||
                            '—'}
                          {' • '}
                          {alert.hostel ||
                            '—'}
                          {' • Room '}
                          {alert.room ||
                            '—'}
                        </div>
                      </div>

                      <span
                        style={{
                          padding:
                            '6px 10px',
                          borderRadius:
                            999,
                          background:
                            '#dcfce7',
                          color:
                            '#166534',
                          fontWeight:
                            800,
                          fontSize:
                            12
                        }}
                      >
                        RESOLVED
                      </span>
                    </div>

                    <div
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit,minmax(220px,1fr))',
                        gap: 10,
                        marginTop:
                          16
                      }}
                    >
                      <div
                        style={{
                          padding:
                            12,
                          background:
                            '#f8fafc',
                          borderRadius:
                            10
                        }}
                      >
                        <strong>
                          SOS Created
                        </strong>

                        <div
                          style={{
                            marginTop:
                              4,
                            color:
                              '#64748b'
                          }}
                        >
                          {formatTime(
                            alert.createdAt
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          padding:
                            12,
                          background:
                            '#f8fafc',
                          borderRadius:
                            10
                        }}
                      >
                        <strong>
                          Resolved
                        </strong>

                        <div
                          style={{
                            marginTop:
                              4,
                            color:
                              '#64748b'
                          }}
                        >
                          {formatTime(
                            alert.resolvedAt
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          padding:
                            12,
                          background:
                            '#f8fafc',
                          borderRadius:
                            10
                        }}
                      >
                        <strong>
                          Warden
                        </strong>

                        <div
                          style={{
                            marginTop:
                              4,
                            color:
                              '#64748b'
                          }}
                        >
                          {alert.wardenEmail ||
                            '—'}
                        </div>
                      </div>
                    </div>

                    {/* WARDEN NOTES */}

                    {wardenNotes.length >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            18
                        }}
                      >
                        <h4
                          style={{
                            marginBottom:
                              8
                          }}
                        >
                          📝 Warden Notes
                        </h4>

                        <div
                          style={{
                            display:
                              'grid',
                            gap: 8
                          }}
                        >
                          {wardenNotes.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                                style={{
                                  padding:
                                    12,
                                  background:
                                    '#f8fafc',
                                  borderRadius:
                                    9,
                                  border:
                                    '1px solid #e2e8f0'
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight:
                                      700
                                  }}
                                >
                                  {item.note ||
                                    item.text ||
                                    '—'}
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      4,
                                    color:
                                      '#64748b',
                                    fontSize:
                                      12
                                  }}
                                >
                                  {item.wardenEmail ||
                                    alert.wardenEmail ||
                                    'Warden'}{' '}
                                  •{' '}
                                  {formatTime(
                                    item.createdAt ||
                                      item.timestamp
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* ACTION TIMELINE */}

                    {history.length >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            18
                        }}
                      >
                        <h4
                          style={{
                            marginBottom:
                              10
                          }}
                        >
                          🕒 Action Timeline
                        </h4>

                        <div
                          style={{
                            display:
                              'grid',
                            gap: 9
                          }}
                        >
                          {history.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                                style={{
                                  padding:
                                    12,
                                  borderLeft:
                                    '4px solid #16a34a',
                                  background:
                                    '#f0fdf4',
                                  borderRadius:
                                    8
                                }}
                              >
                                <strong>
                                  {item.status ||
                                    item.action ||
                                    'Action'}
                                </strong>

                                {item.note && (
                                  <div
                                    style={{
                                      marginTop:
                                        4
                                    }}
                                  >
                                    {
                                      item.note
                                    }
                                  </div>
                                )}

                                <div
                                  style={{
                                    marginTop:
                                      4,
                                    fontSize:
                                      12,
                                    color:
                                      '#64748b'
                                  }}
                                >
                                  {item.wardenEmail ||
                                    alert.wardenEmail ||
                                    'Warden'}{' '}
                                  •{' '}
                                  {formatTime(
                                    item.createdAt ||
                                      item.timestamp
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {wardenNotes.length ===
                      0 &&
                      history.length ===
                        0 && (
                        <div
                          style={{
                            marginTop:
                              18,
                            padding:
                              12,
                            borderRadius:
                              9,
                            background:
                              '#fff7ed',
                            color:
                              '#9a3412'
                          }}
                        >
                          No action timeline
                          recorded for
                          this SOS.
                        </div>
                      )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>
    </main>
  );
}
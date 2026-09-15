import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { api, registerStudent } from '../services/api';

export default function StudentRegister() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const invite = params.get('invite') || '';

  const [form, setForm] = useState({
    name: '',
    studentId: '',
    hostel: '',
    room: '',
    phone: '',
    email: '',
    password: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!invite) {
      setError('Invalid or missing invitation QR code.');
      return;
    }

    if (
      !form.name.trim() ||
      !form.studentId.trim() ||
      !form.hostel.trim() ||
      !form.room.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      setError('Please fill all required fields.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    const email = form.email.trim().toLowerCase();
    const studentId = form.studentId.trim();

    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      /*
       * STEP 1
       * Check invitation + Student ID BEFORE creating
       * the Firebase account.
       */
      await api.post('/students/check-registration', {
        inviteToken: invite,
        studentId
      });

      /*
       * STEP 2
       * Student ID is available.
       * NOW create Firebase account.
       */
      const firebaseResult = await createUserWithEmailAndPassword(
        auth,
        email,
        form.password
      );

      if (!firebaseResult.user) {
        throw new Error('Could not create Firebase account.');
      }

      /*
       * STEP 3
       * Firebase account exists.
       * Now connect it to the warden invitation.
       */
      const result = await registerStudent({
        inviteToken: invite,
        name: form.name.trim(),
        studentId,
        hostel: form.hostel.trim(),
        room: form.room.trim(),
        phone: form.phone.trim(),
        email
      });

      /*
       * Backend returns:
       * {
       *   message: "...",
       *   student: {...}
       * }
       */
      const student = result.student || result;

      localStorage.setItem(
        'campusStudent',
        JSON.stringify(student)
      );

      alert('Student registration successful!');

      navigate('/');
    } catch (err) {
      console.error('Student registration error:', err);

      let message = 'Registration failed. Please try again.';

      /*
       * Duplicate Student ID
       */
      if (err.response?.status === 409) {
        message =
          err.response?.data?.message ||
          'This Student ID is already registered.';
      }

      /*
       * Invalid/expired invitation
       */
      else if (err.response?.status === 400) {
        message =
          err.response?.data?.message ||
          'Invalid or expired invitation.';
      }

      /*
       * Firebase errors
       */
      else if (err.code === 'auth/email-already-in-use') {
        message =
          'This email is already registered in Firebase. Please use another email.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password must contain at least 6 characters.';
      } else if (err.code === 'auth/network-request-failed') {
        message =
          'Network error. Please check your internet connection.';
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '30px 16px',
        background: '#f5f7fb'
      }}
    >
      <div
        style={{
          maxWidth: '620px',
          margin: '0 auto',
          background: '#fff',
          padding: '30px',
          borderRadius: '18px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
        }}
      >
        <h1 style={{ marginBottom: '10px' }}>
          🎓 Student Registration
        </h1>

        <p style={{ color: '#666', marginBottom: '25px' }}>
          Create your student account using the invitation from your warden.
        </p>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '14px',
              borderRadius: '10px',
              marginBottom: '20px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label>Full Name *</label>

          <input
            name="name"
            value={form.name}
            onChange={change}
            placeholder="Enter full name"
            required
            style={inputStyle}
          />

          <label>Student ID *</label>

          <input
            name="studentId"
            value={form.studentId}
            onChange={change}
            placeholder="Example: VTE224"
            required
            style={inputStyle}
          />

          <label>Hostel *</label>

          <input
            name="hostel"
            value={form.hostel}
            onChange={change}
            placeholder="Example: Boys Hostel 2"
            required
            style={inputStyle}
          />

          <label>Room *</label>

          <input
            name="room"
            value={form.room}
            onChange={change}
            placeholder="Example: B-204"
            required
            style={inputStyle}
          />

          <label>Phone</label>

          <input
            name="phone"
            value={form.phone}
            onChange={change}
            placeholder="Enter phone number"
            style={inputStyle}
          />

          <label>Email *</label>

          <input
            type="email"
            name="email"
            value={form.email}
            onChange={change}
            placeholder="student@example.com"
            required
            style={inputStyle}
          />

          <label>Password *</label>

          <input
            type="password"
            name="password"
            value={form.password}
            onChange={change}
            placeholder="Minimum 6 characters"
            required
            minLength={6}
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '20px',
              border: 'none',
              borderRadius: '10px',
              background: loading ? '#999' : '#2563eb',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading
              ? 'Checking & Creating Account...'
              : 'Create Student Account'}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px',
  marginTop: '7px',
  marginBottom: '16px',
  border: '1px solid #d1d5db',
  borderRadius: '9px',
  fontSize: '15px'
};
import crypto from 'crypto';
import { store } from '../store/index.js';

/*
 * Create a secure hash of the invitation token.
 */
function hashInviteToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}


/*
 * =========================================================
 * CREATE STUDENT INVITE
 * =========================================================
 */

export async function createStudentInvite(req, res) {
  try {
    const wardenUid = req.user?.uid;

    if (!wardenUid) {
      return res.status(401).json({
        message: 'Warden authentication required.'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const tokenHash = hashInviteToken(token);

    const createdAt = new Date();

    /*
     * Invitation valid for 24 hours.
     */
    const expiresAt = new Date(
      createdAt.getTime() + 24 * 60 * 60 * 1000
    );

    const invite = {
      id: tokenHash,
      tokenHash,
      wardenUid,
      wardenEmail: req.user?.email || '',
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false
    };

    /*
     * Save invitation.
     *
     * Firestore store should support this collection.
     */
    if (store.createStudentInvite) {
      await store.createStudentInvite(invite);
    } else if (store.saveStudentInvite) {
      await store.saveStudentInvite(invite);
    } else {
      /*
       * If your current store does not yet have invite storage,
       * use this error instead of silently failing.
       */
      return res.status(500).json({
        message:
          'Student invitation storage is not configured in the server.'
      });
    }

    const frontendUrl =
      process.env.CLIENT_URL?.split(',')[0] ||
      'http://localhost:5173';

    const inviteUrl =
      `${frontendUrl}/student-register?invite=${token}`;

    return res.status(201).json({
      inviteUrl,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error(
      'Create student invite error:',
      error
    );

    return res.status(500).json({
      message: 'Could not create student invitation.'
    });
  }
}


/*
 * =========================================================
 * CHECK STUDENT REGISTRATION
 * =========================================================
 *
 * THIS IS THE IMPORTANT NEW FUNCTION.
 *
 * It runs BEFORE Firebase account creation.
 *
 * It checks:
 *
 * 1. Invitation exists
 * 2. Invitation is not used
 * 3. Invitation is not expired
 * 4. Student ID is not already registered
 *
 * If anything fails, Firebase account is NOT created.
 */

export async function checkStudentRegistration(req, res) {
  try {
    const {
      inviteToken,
      studentId
    } = req.body || {};

    if (!inviteToken) {
      return res.status(400).json({
        message: 'Student invitation is required.'
      });
    }

    if (!studentId || !studentId.trim()) {
      return res.status(400).json({
        message: 'Student ID is required.'
      });
    }

    const cleanStudentId = studentId.trim();

    const tokenHash = hashInviteToken(
      inviteToken.trim()
    );

    /*
     * Find invitation.
     */
    let invite = null;

    if (store.getStudentInvite) {
      invite = await store.getStudentInvite(tokenHash);
    } else if (store.getInvite) {
      invite = await store.getInvite(tokenHash);
    }

    if (!invite) {
      return res.status(400).json({
        message: 'Invalid or expired invitation.'
      });
    }

    /*
     * Invitation already used.
     */
    if (invite.used === true) {
      return res.status(400).json({
        message: 'This invitation has already been used.'
      });
    }

    /*
     * Invitation expired.
     */
    if (
      invite.expiresAt &&
      new Date(invite.expiresAt) < new Date()
    ) {
      return res.status(400).json({
        message: 'This invitation has expired.'
      });
    }

    /*
     * Check whether Student ID already exists.
     */
    const existingStudent =
      await store.getStudent(cleanStudentId);

    if (existingStudent && existingStudent.wardenUid) {
      return res.status(409).json({
        message:
          'This Student ID is already registered.'
      });
    }

    /*
     * Everything is okay.
     *
     * Firebase account can now safely be created.
     */
    return res.json({
      ok: true,
      message: 'Student ID is available.'
    });

  } catch (error) {
    console.error(
      'Check student registration error:',
      error
    );

    return res.status(500).json({
      message:
        'Could not validate student registration.'
    });
  }
}


/*
 * =========================================================
 * FINAL STUDENT REGISTRATION
 * =========================================================
 */

export async function registerStudent(req, res) {
  try {
    const {
      inviteToken,
      name,
      studentId,
      hostel,
      room,
      phone
    } = req.body || {};

    /*
     * Firebase user must be logged in.
     */
    if (!req.user?.uid) {
      return res.status(401).json({
        message: 'Student authentication required.'
      });
    }

    if (!inviteToken) {
      return res.status(400).json({
        message: 'Student invitation is required.'
      });
    }

    if (
      !name ||
      !studentId ||
      !hostel ||
      !room
    ) {
      return res.status(400).json({
        message:
          'Name, Student ID, Hostel and Room are required.'
      });
    }

    const cleanStudentId = studentId.trim();

    const tokenHash = hashInviteToken(
      inviteToken.trim()
    );

    /*
     * Get invitation.
     */
    let invite = null;

    if (store.getStudentInvite) {
      invite = await store.getStudentInvite(tokenHash);
    } else if (store.getInvite) {
      invite = await store.getInvite(tokenHash);
    }

    if (!invite) {
      return res.status(400).json({
        message: 'Invalid or expired invitation.'
      });
    }

    /*
     * Invitation already used.
     */
    if (invite.used === true) {
      return res.status(400).json({
        message:
          'This invitation has already been used.'
      });
    }

    /*
     * Invitation expired.
     */
    if (
      invite.expiresAt &&
      new Date(invite.expiresAt) < new Date()
    ) {
      return res.status(400).json({
        message: 'This invitation has expired.'
      });
    }

    /*
     * IMPORTANT:
     * Check Student ID AGAIN.
     *
     * This protects against two students trying to
     * register the same ID at almost the same time.
     */
    const existingStudent =
  await store.getStudent(cleanStudentId);

if (existingStudent && existingStudent.wardenUid) {
  return res.status(409).json({
    message:
      'This Student ID is already registered.'
  });
}
    /*
     * Create student record.
     */
    const student = {
      id: cleanStudentId,

      uid: req.user.uid,

      studentId: cleanStudentId,

      name: name.trim(),

      hostel: hostel.trim(),

      room: room.trim(),

      phone:
        typeof phone === 'string'
          ? phone.trim()
          : '',

      /*
       * Connect this student to the warden
       * who created the QR invitation.
       */
      wardenUid: invite.wardenUid,

      wardenEmail:
        invite.wardenEmail || '',

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()
    };

    /*
     * Save student.
     */
    await store.saveStudent(student);

    /*
     * Mark invitation as used.
     */
    if (store.markStudentInviteUsed) {
      await store.markStudentInviteUsed(
        tokenHash
      );
    } else if (store.markInviteUsed) {
      await store.markInviteUsed(
        tokenHash
      );
    }

    return res.status(201).json({
      message:
        'Student registered successfully.',

      student
    });

  } catch (error) {
    console.error(
      'Register student error:',
      error
    );

    return res.status(500).json({
      message:
        'Could not register student.'
    });
  }
}


/*
 * =========================================================
 * LIST STUDENTS FOR CURRENT WARDEN
 * =========================================================
 */

export async function listStudents(req, res) {
  try {
    const students =
      await store.listStudents();

    const userUid =
      req.user?.uid || '';

    const userEmail =
      (req.user?.email || '').toLowerCase();

    const ownStudents =
      students.filter(
        (student) =>
          student.wardenUid === userUid ||
          (
            !student.wardenUid &&
            student.wardenEmail &&
            student.wardenEmail.toLowerCase() ===
              userEmail
          )
      );

    return res.json(ownStudents);

  } catch (error) {
    console.error(
      'List students error:',
      error
    );

    return res.status(500).json({
      message:
        'Could not load students.'
    });
  }
}


/*
 * =========================================================
 * GET CURRENT STUDENT
 * =========================================================
 */

export async function getMyStudent(req, res) {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        message:
          'Student authentication required.'
      });
    }

    const students =
      await store.listStudents();

    const student =
      students.find(
        (item) => item.uid === uid
      );

    if (!student) {
      return res.status(404).json({
        message:
          'Student profile not found.'
      });
    }

    return res.json({
      student
    });

  } catch (error) {
    console.error(
      'Get my student error:',
      error
    );

    return res.status(500).json({
      message:
        'Could not load student profile.'
    });
  }
}
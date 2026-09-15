import express from 'express';

import {
  createStudentInvite,
  checkStudentRegistration,
  registerStudent,
  listStudents,
  getMyStudent
} from '../controllers/studentController.js';

import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/*
 * Warden creates student invitation.
 */
router.post(
  '/invite',
  requireAuth,
  createStudentInvite
);

/*
 * Student checks invitation + Student ID.
 *
 * IMPORTANT:
 * This route does NOT require Firebase login.
 *
 * It is intentionally called BEFORE Firebase account creation.
 */
router.post(
  '/check-registration',
  checkStudentRegistration
);

/*
 * Final student registration.
 *
 * Firebase authentication is required here.
 */
router.post(
  '/register',
  requireAuth,
  registerStudent
);

/*
 * Warden gets students connected to them.
 */
router.get(
  '/',
  requireAuth,
  listStudents
);

/*
 * Logged-in student gets their own profile.
 */
router.get(
  '/me',
  requireAuth,
  getMyStudent
);

export default router;
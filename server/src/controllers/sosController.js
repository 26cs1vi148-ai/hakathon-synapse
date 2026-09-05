import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { store } from '../store/index.js';
import { publish } from '../utils/events.js';

const sosSchema = z.object({
  studentId: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(120), hostel: z.string().trim().min(1).max(120), room: z.string().trim().min(1).max(50), phone: z.string().trim().max(30).default(''), latitude: z.number().finite().gte(-90).lte(90), longitude: z.number().finite().gte(-180).lte(180), accuracy: z.number().finite().nonnegative().optional()
});
const locationSchema = z.object({ latitude: z.number().finite().gte(-90).lte(90), longitude: z.number().finite().gte(-180).lte(180), accuracy: z.number().finite().nonnegative().optional() });
const statusSchema = z.object({ status: z.enum(['ACTIVE','RESPONDED','RESOLVED']) });

export async function listAlerts(req,res,next){ try { res.json(await store.listAlerts()); } catch(e){ next(e); } }

export async function createSos(req,res,next){
  try {
    const input = sosSchema.parse(req.body);
    const existing = await store.hasActiveForStudent(input.studentId);
    if (existing) return res.status(409).json({ message:'This student already has an active SOS.', sosId: existing.id });
    const now = new Date().toISOString();
    const alert = { id: randomUUID(), ...input, status:'ACTIVE', createdAt:now, updatedAt:now, resolvedAt:null };
    await store.createStudent({ id: input.studentId, ...input });
    await store.createAlert(alert);
    await store.addLocation({ id: randomUUID(), sosId: alert.id, latitude:input.latitude, longitude:input.longitude, accuracy:input.accuracy ?? null, timestamp:now });
    publish('sos.created', alert); publish('sos.location', alert);
    res.status(201).json(alert);
  } catch(e){ next(e); }
}

export async function updateLocation(req,res,next){
  try {
    const input = locationSchema.parse(req.body);
    const alert = await store.getAlert(req.params.sosId);
    if (!alert) return res.status(404).json({message:'SOS not found.'});
    if (alert.status === 'RESOLVED') return res.status(400).json({message:'SOS is resolved.'});
    const now = new Date().toISOString();
    const updated = await store.updateAlert(alert.id, { latitude:input.latitude, longitude:input.longitude, accuracy:input.accuracy ?? null, updatedAt:now });
    await store.addLocation({ id:randomUUID(), sosId:alert.id, ...input, timestamp:now });
    publish('sos.location', updated);
    res.json(updated);
  } catch(e){ next(e); }
}

export async function updateStatus(req,res,next){
  try {
    const {status} = statusSchema.parse(req.body);
    const alert = await store.getAlert(req.params.sosId);
    if (!alert) return res.status(404).json({message:'SOS not found.'});
    const now = new Date().toISOString();
    const updated = await store.updateAlert(alert.id, { status, updatedAt:now, resolvedAt:status === 'RESOLVED' ? now : null });
    publish('sos.status', updated);
    res.json(updated);
  } catch(e){ next(e); }
}

export async function createDemo(req,res,next){
  try {
    const existing = await store.hasActiveForStudent('DEMO001');
    if (existing) return res.status(409).json({message:'Demo SOS already active.', sosId:existing.id});
    const now = new Date().toISOString();
    const alert = { id:randomUUID(), studentId:'DEMO001', name:'Demo Student', hostel:'Demo Hostel', room:'A-101', phone:'919999999999', latitude:22.719568, longitude:75.857727, accuracy:8, status:'ACTIVE', createdAt:now, updatedAt:now, resolvedAt:null, demo:true };
    await store.createStudent({id:'DEMO001', ...alert}); await store.createAlert(alert); await store.addLocation({id:randomUUID(),sosId:alert.id,latitude:alert.latitude,longitude:alert.longitude,accuracy:8,timestamp:now});
    publish('sos.created',alert); publish('sos.location',alert); res.status(201).json(alert);
  } catch(e){next(e)}
}

export async function simulateLocation(req,res,next){
  try {
    const alert = await store.getAlert(req.params.sosId);
    if (!alert) return res.status(404).json({message:'SOS not found.'});
    const lat = alert.latitude + 0.00005; const lng = alert.longitude + 0.000035;
    const now = new Date().toISOString();
    const updated = await store.updateAlert(alert.id,{latitude:lat,longitude:lng,accuracy:8,updatedAt:now});
    await store.addLocation({id:randomUUID(),sosId:alert.id,latitude:lat,longitude:lng,accuracy:8,timestamp:now}); publish('sos.location',updated); res.json(updated);
  } catch(e){next(e)}
}

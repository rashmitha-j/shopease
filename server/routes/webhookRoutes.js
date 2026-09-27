import express, { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/webhookController.js';

const router = Router();

// Mounted in app.js BEFORE express.json(): the signature is checked against the raw bytes,
// so this route must receive the body unparsed (as a Buffer).
router.post('/razorpay/webhook', express.raw({ type: 'application/json', limit: '100kb' }), handleRazorpayWebhook);

export default router;

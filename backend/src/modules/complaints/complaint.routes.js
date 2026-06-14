const express = require('express');
const router = express.Router();
const complaintController = require('./complaint.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth');

router.use(requireAuth);

// Mendapatkan daftar komplain (semua role, logic disesuaikan di service)
router.get('/', complaintController.getComplaints);

// Mendapatkan detail komplain
router.get('/:id', complaintController.getComplaintById);

// Buyer membuat komplain (berdasarkan orderId)
router.post('/order/:orderId', requireRole('buyer'), complaintController.createComplaint);

// Seller membalas komplain
router.post('/:id/reply', requireRole('seller'), complaintController.replyComplaint);

// Buyer menerima/menolak solusi (jika menolak, otomatis ter-eskalasi ke admin_review)
router.post('/:id/resolve', requireRole('buyer'), complaintController.resolveComplaint);

// Admin memberikan keputusan akhir
router.post('/:id/admin-resolve', requireRole('superadmin'), complaintController.adminResolveComplaint);

module.exports = router;

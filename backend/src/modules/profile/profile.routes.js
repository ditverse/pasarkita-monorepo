const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const profileController = require('./profile.controller');

const router = express.Router();

router.use(requireAuth);

// Profile
router.get('/', profileController.getProfile);
router.patch('/', profileController.updateProfile);

// Addresses
router.get('/addresses', profileController.getAddresses);
router.post('/addresses', profileController.addAddress);
router.put('/addresses/:id', profileController.updateAddress);
router.delete('/addresses/:id', profileController.deleteAddress);
router.put('/addresses/:id/primary', profileController.setPrimaryAddress);

module.exports = router;

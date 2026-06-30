const express = require('express');
const router = express.Router();
const adsController = require('./ads.controller');

router.get('/home-carousel', adsController.getHomeCarousel);
router.post('/:id/view', adsController.recordView);
router.post('/:id/click', adsController.recordClick);

module.exports = router;

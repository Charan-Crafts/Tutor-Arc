const express = require('express');
const router = express.Router();
const {
    createLiveSession,
    getAllLiveSessions,
    getLiveSessionById,
    updateLiveSession,
    deleteLiveSession
} = require('../controllers/liveSessionController');

// Create a new live session
router.post('/', createLiveSession);

// Get all live sessions
router.get('/', getAllLiveSessions);

// Get a single live session by id
router.get('/:id', getLiveSessionById);

// Update a live session
router.put('/:id', updateLiveSession);

// Delete a live session
router.delete('/:id', deleteLiveSession);

module.exports = router;


const LiveSession = require('../models/LiveSession');

// Create a new live session
const createLiveSession = async (req, res) => {
    try {
        const { userurl } = req.body;

        if (!userurl) {
            return res.status(400).json({
                success: false,
                message: 'userurl is required'
            });
        }

        const liveSession = new LiveSession({
            userurl: userurl
        });

        await liveSession.save();

        res.status(201).json({
            success: true,
            message: 'Live session created successfully',
            data: liveSession
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating live session',
            error: error.message
        });
    }
};

// Get all live sessions
const getAllLiveSessions = async (req, res) => {
    try {
        const liveSessions = await LiveSession.find().sort({ id: -1 });

        res.status(200).json({
            success: true,
            count: liveSessions.length,
            data: liveSessions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching live sessions',
            error: error.message
        });
    }
};

// Get a single live session by id
const getLiveSessionById = async (req, res) => {
    try {
        const liveSession = await LiveSession.findOne({ id: req.params.id });

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: 'Live session not found'
            });
        }

        res.status(200).json({
            success: true,
            data: liveSession
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching live session',
            error: error.message
        });
    }
};

// Update a live session
const updateLiveSession = async (req, res) => {
    try {
        const { userurl } = req.body;

        const liveSession = await LiveSession.findOneAndUpdate(
            { id: req.params.id },
            { userurl: userurl, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: 'Live session not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Live session updated successfully',
            data: liveSession
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating live session',
            error: error.message
        });
    }
};

// Delete a live session
const deleteLiveSession = async (req, res) => {
    try {
        const liveSession = await LiveSession.findOneAndDelete({ id: req.params.id });

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: 'Live session not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Live session deleted successfully',
            data: liveSession
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting live session',
            error: error.message
        });
    }
};

module.exports = {
    createLiveSession,
    getAllLiveSessions,
    getLiveSessionById,
    updateLiveSession,
    deleteLiveSession
};


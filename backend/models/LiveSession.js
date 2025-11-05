const mongoose = require('mongoose');
const Counter = require('./Counter');

const liveSessionSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true
    },
    userurl: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-increment id before saving
liveSessionSchema.pre('save', async function (next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                { _id: 'liveSessionId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.id = counter.seq;
        } catch (error) {
            return next(error);
        }
    }
    this.updatedAt = Date.now();
    next();
});

const LiveSession = mongoose.model('LiveSession', liveSessionSchema);

module.exports = LiveSession;


const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  correctAnswers: { type: Map, of: Boolean, default: {} },
  wrongAnswers: { type: Map, of: Boolean, default: {} },
  userAnswers: { type: Map, of: String, default: {} },
  answeredQuestions: { type: Map, of: Boolean, default: {} },
  currentCategory: { type: String, default: '全部' },
  updatedAt: { type: Date, default: Date.now }
});

progressSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
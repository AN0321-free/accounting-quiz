const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: String, required: true, unique: true },
  plan: { type: String, enum: ['daily', 'weekly', 'lifetime'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled', 'expired'], default: 'pending' },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
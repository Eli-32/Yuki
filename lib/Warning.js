import mongoose from 'mongoose';

const warningSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  groupId: { type: String, required: true },
  warnings: [{
    cause: { type: String, required: true },
    date: { type: Date, default: Date.now },
    issuer: { type: String, required: true }
  }]
});

export default mongoose.model('Warning', warningSchema);
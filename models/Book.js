const mongoose = require('mongoose');

const CONDITIONS = ['New', 'Good', 'Fair'];
const STATUSES = ['available', 'reserved', 'sold'];

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    author: { type: String, required: true, trim: true, maxlength: 80 },
    courseCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    edition: { type: String, default: '', trim: true, maxlength: 40 },
    condition: { type: String, enum: CONDITIONS, default: 'Good' },
    price: { type: Number, required: true, min: 0, max: 100000 },
    status: { type: String, enum: STATUSES, default: 'available' },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    contact: { type: String, required: true, trim: true, maxlength: 80 },
    sellerName: { type: String, required: true, trim: true, maxlength: 80 },
    sellerUsername: { type: String, required: true, trim: true, lowercase: true, maxlength: 20 }
  },
  { timestamps: true }
);

bookSchema.index({ courseCode: 1, status: 1 });

module.exports = mongoose.model('Book', bookSchema);
module.exports.CONDITIONS = CONDITIONS;
module.exports.STATUSES = STATUSES;

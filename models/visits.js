const mongoose = require('mongoose');

const schemaOptions = {
  timestamps: {createdAt: 'created_at', updatedAt: 'updated_at'},
};

const VisitsSchema = new mongoose.Schema({
    counter: { type: Number, required: true },
  }, schemaOptions);

module.exports = mongoose.model('visits', VisitsSchema, 'visits');
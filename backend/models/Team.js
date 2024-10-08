const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  logo: { type: String },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  tournaments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }], // Participated tournaments
}, { timestamps: true });

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;

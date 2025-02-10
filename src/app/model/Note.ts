import mongoose from "mongoose";

const noteSchema = new mongoose.Schema({
  songId: { type: String, required: true },
  note: { type: String, required: true },
});

export default mongoose.models.Note || mongoose.model("Note", noteSchema);

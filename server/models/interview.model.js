import mongoose from "mongoose";

const questionsSchema = new mongoose.Schema({
     question: String,
  difficulty: String,
  timeLimit: Number,
  answer: String,
  feedback: String,
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  communication: { type: Number, default: 0 },
  correctness: { type: Number, default: 0 },
  confidenceGap: String,
  confidenceImprovement: String,
  communicationGap: String,
  communicationImprovement: String,
  correctnessGap: String,
  correctnessImprovement: String,
  sampleAnswer: String,
})

const proctoringSchema = new mongoose.Schema({
  tabAwayCount: { type: Number, default: 0, min: 0 },
  cameraDisconnectCount: { type: Number, default: 0, min: 0 },
  multipleFaceCount: { type: Number, default: 0, min: 0 },
  noFaceCount: { type: Number, default: 0, min: 0 },
  lookAwayCount: { type: Number, default: 0, min: 0 },
}, { _id: false });


const interviewSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    role:{
        type:String,
        required:true
    },
    experience:{
        type:String,
        required:true
    },
    mode:{
        type:String,
        enum:["HR" ,"Technical"],
        required:true
    },
    resumeText:{
     type:String
    },
    questions:[questionsSchema],

    finalScore: { type: Number, default: 0 },
    proctoring: { type: proctoringSchema, default: () => ({}) },

    status: {
      type: String,
      enum: ["Incompleted", "completed"],
      default: "Incompleted",
    }
},{timestamps:true})

const Interview = mongoose.model("Interview" , interviewSchema)


export default Interview
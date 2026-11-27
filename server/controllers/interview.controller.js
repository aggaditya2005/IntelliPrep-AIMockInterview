import fs from "fs"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openRouter.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

const INTERVIEW_CREDIT_COST = 20;

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume required" });
    }
    const filepath = req.file.path

    const fileBuffer = await fs.promises.readFile(filepath)
    const uint8Array = new Uint8Array(fileBuffer)

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    let resumeText = "";

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items.map(item => item.str).join(" ");
      resumeText += pageText + "\n";
    }


    resumeText = resumeText
      .replace(/\s+/g, " ")
      .trim();

    const messages = [
      {
        role: "system",
        content: `
Extract structured data from resume.

Return strictly JSON:

{
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}
`
      },
      {
        role: "user",
        content: resumeText
      }
    ];


    const aiResponse = await askAi(messages)

    const parsed = JSON.parse(aiResponse);

    fs.unlinkSync(filepath)


    res.json({
      role: parsed.role,
      experience: parsed.experience,
      projects: parsed.projects,
      skills: parsed.skills,
      resumeText
    });

  } catch (error) {
    console.error(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: error.message });
  }
};


export const generateQuestion = async (req, res) => {
  try {
    let { role, experience, mode, resumeText, projects, skills } = req.body

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !experience || !mode) {
      return res.status(400).json({ message: "Role, Experience and Mode are required." })
    }

    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.credits < INTERVIEW_CREDIT_COST) {
      return res.status(400).json({
        message: `Not enough credits. ${INTERVIEW_CREDIT_COST} required to start an interview.`
      });
    }

    const projectText = Array.isArray(projects) && projects.length
      ? projects.join(", ")
      : "None";

    const skillsText = Array.isArray(skills) && skills.length
      ? skills.join(", ")
      : "None";

    const safeResume = resumeText?.trim() || "None";

    const userPrompt = `
    Role:${role}
    Experience:${experience}
    InterviewMode:${mode}
    Projects:${projectText}
    Skills:${skillsText},
    Resume:${safeResume}
    `;

    if (!userPrompt.trim()) {
      return res.status(400).json({
        message: "Prompt content is empty."
      });
    }

    const messages = [

      {
        role: "system",
        content: `
You are a real human interviewer conducting a professional interview.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 5 interview questions.

Strict Rules:
- Each question must contain between 15 and 25 words.
- Each question must be a single complete sentence.
- Do NOT number them.
- Do NOT add explanations.
- Do NOT add extra text before or after.
- One question per line only.
- Keep language simple and conversational.
- Questions must feel practical and realistic.

Difficulty progression:
Question 1 → easy  
Question 2 → easy  
Question 3 → medium  
Question 4 → medium  
Question 5 → hard  

Make questions based on the candidate’s role, experience,interviewMode, projects, skills, and resume details.
`
      }
      ,
      {
        role: "user",
        content: userPrompt
      }
    ];


    const aiResponse = await askAi(messages)

    if (!aiResponse || !aiResponse.trim()) {
           
      return res.status(500).json({
        message: "AI returned empty response."
      });

    }

    const questionsArray = aiResponse
      .split("\n")
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .slice(0, 5);

    if (questionsArray.length === 0) {
      
      return res.status(500).json({
        message: "AI failed to generate questions."
      });
    }

    user.credits -= INTERVIEW_CREDIT_COST;
    await user.save();

    const interview = await Interview.create({
      userId: user._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      questions: questionsArray.map((q, index) => ({
        question: q,
        difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
        timeLimit: [60, 60, 90, 90, 120][index],
      }))
    })

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: user.name,
      questions: interview.questions
    });
  } catch (error) {
    return res.status(500).json({message:`failed to create interview ${error}`})
  }
}

const calculateVoiceConfidence = (metrics) => {
  if (!metrics || typeof metrics !== "object") return 0;

  const duration = Number(metrics.durationSeconds) || 0;
  const speechRatio = Math.max(0, Math.min(1, Number(metrics.speechRatio) || 0));
  const averageRms = Number(metrics.averageRms) || 0;
  const rmsVariation = Number(metrics.rmsCoefficientOfVariation);
  const pitchVariation = Number(metrics.pitchCoefficientOfVariation);

  if (duration < 1 || speechRatio < 0.05 || averageRms < 0.004) return 0;

  const audibility = averageRms >= 0.012
    ? 10
    : Math.max(0, (averageRms / 0.012) * 10);
  const continuity = speechRatio >= 0.7
    ? 10
    : Math.max(0, (speechRatio / 0.7) * 10);
  const volumeConsistency = Math.max(
    0,
    10 - Math.max(0, rmsVariation || 1) * 5
  );
  const pitchConsistency = pitchVariation >= 0 && pitchVariation <= 2
    ? Math.max(0, 10 - pitchVariation * 5)
    : 5;
  const durationStability = duration >= 8
    ? 10
    : Math.max(4, (duration / 8) * 10);

  return Math.round(
    (audibility + continuity + volumeConsistency + pitchConsistency + durationStability) / 5
  );
};


export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken, voiceMetrics } = req.body

    const interview = await Interview.findById(interviewId)
    if (!interview || !Number.isInteger(questionIndex) || !interview.questions[questionIndex]) {
      return res.status(404).json({ message: "Interview question not found." })
    }

    const question = interview.questions[questionIndex]
    const candidateAnswer = typeof answer === "string" ? answer.trim() : "";
    const voiceConfidence = candidateAnswer
      ? calculateVoiceConfidence(voiceMetrics)
      : 0;
    const answerStatus = !candidateAnswer
      ? "No answer was submitted. Do not evaluate the candidate; assign zero scores and explain the missing response."
      : timeTaken > question.timeLimit
        ? "The answer exceeded its time limit. Do not evaluate the candidate; assign zero scores and explain the time limit."
        : "Evaluate the candidate's answer normally.";

    const messages = [
      {
        role: "system",
        content: `
You are an interview coach evaluating a candidate's answer and creating a learning report.

Evaluate fairly using the question and candidate response. Score communication and correctness from 0 to 10. Do not infer confidence, vocal delivery, personality, or emotion from text or facial data. Confidence is calculated separately only from captured voice-signal metrics and must not be changed from the candidate response.

For communication and correctness, provide:
- A concise, specific gap observed in this answer.
- One practical action the candidate can take to improve.

Also provide concise overall feedback and an example of a strong answer that directly addresses the question. Interview questions can have multiple valid answers: label the answer as an example, not the only correct answer. Tailor it to the candidate's response when available.

${answerStatus}
If the answer is missing or over time, return zero for all scores, explain why in feedback and the gap fields, still give useful improvement actions, and still write the example answer.

Keep all feedback constructive and specific. Do not invent candidate experience, facts, or achievements in the example answer; use placeholders or describe what a candidate should cover when personal details are unknown.
Return ONLY valid JSON, with no markdown or extra text, matching this shape:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "concise overall feedback",
  "confidenceGap": "what was lacking in this answer",
  "confidenceImprovement": "actionable confidence improvement",
  "communicationGap": "what was lacking in this answer",
  "communicationImprovement": "actionable communication improvement",
  "correctnessGap": "what was incorrect, missing, or unclear",
  "correctnessImprovement": "actionable correctness improvement",
  "sampleAnswer": "a concise example strong answer"
}

For an evaluated answer, finalScore must be the average of confidence, communication, and correctness rounded to the nearest whole number. For missing or over-time answers, all scores and finalScore must be 0.
`
      }
      ,
      {
        role: "user",
        content: `
Question: ${question.question}
Candidate response: ${candidateAnswer || "[No answer submitted]"}
Voice metrics: ${JSON.stringify(voiceMetrics || {})}
Time limit: ${question.timeLimit} seconds
Time taken: ${timeTaken} seconds
`
      }
    ];


    const aiResponse = await askAi(messages)


    const parsed = JSON.parse(aiResponse);
    parsed.confidence = voiceConfidence;
    if (candidateAnswer && timeTaken <= question.timeLimit) {
      parsed.finalScore = Math.round(
        (voiceConfidence + Number(parsed.communication || 0) + Number(parsed.correctness || 0)) / 3
      );
    } else {
      parsed.confidence = 0;
      parsed.communication = 0;
      parsed.correctness = 0;
      parsed.finalScore = 0;
    }

    parsed.confidenceGap = parsed.confidence > 7
      ? "Voice delivery was clear and consistent in the captured audio."
      : parsed.confidence > 4
        ? "Voice delivery was audible but showed some inconsistency."
        : "The captured voice signal was quiet, brief, or inconsistent.";
    parsed.confidenceImprovement = parsed.confidence > 7
      ? "Maintain a steady volume and speaking pace."
      : "Speak continuously at a steady volume, with fewer pauses and clear articulation.";

    question.answer = candidateAnswer;
    question.confidence = parsed.confidence;
    question.communication = parsed.communication;
    question.correctness = parsed.correctness;
    question.score = parsed.finalScore;
    question.feedback = parsed.feedback;
    question.confidenceGap = parsed.confidenceGap;
    question.confidenceImprovement = parsed.confidenceImprovement;
    question.communicationGap = parsed.communicationGap;
    question.communicationImprovement = parsed.communicationImprovement;
    question.correctnessGap = parsed.correctnessGap;
    question.correctnessImprovement = parsed.correctnessImprovement;
    question.sampleAnswer = parsed.sampleAnswer;
    await interview.save();

    return res.status(200).json({ feedback: parsed.feedback })
  } catch (error) {
    return res.status(500).json({message:`failed to submit answer ${error}`})

  }
}


export const finishInterview = async (req,res) => {
  try {
    const { interviewId } = req.body
    const proctoring = req.body.proctoring && typeof req.body.proctoring === "object"
      ? req.body.proctoring
      : {}
    const interview = await Interview.findById(interviewId)
    if(!interview){
      return res.status(400).json({message:"failed to find Interview"})
    }

    interview.proctoring = {
      tabAwayCount: Number.isInteger(proctoring.tabAwayCount) && proctoring.tabAwayCount >= 0
        ? proctoring.tabAwayCount
        : 0,
      cameraDisconnectCount: Number.isInteger(proctoring.cameraDisconnectCount) && proctoring.cameraDisconnectCount >= 0
        ? proctoring.cameraDisconnectCount
        : 0,
      multipleFaceCount: Number.isInteger(proctoring.multipleFaceCount) && proctoring.multipleFaceCount >= 0
        ? proctoring.multipleFaceCount
        : 0,
      noFaceCount: Number.isInteger(proctoring.noFaceCount) && proctoring.noFaceCount >= 0
        ? proctoring.noFaceCount
        : 0,
      lookAwayCount: Number.isInteger(proctoring.lookAwayCount) && proctoring.lookAwayCount >= 0
        ? proctoring.lookAwayCount
        : 0,
    };

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const finalScore = totalQuestions
      ? totalScore / totalQuestions
      : 0;

    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

    interview.finalScore = finalScore;
    interview.status = "completed";

    await interview.save();

    return res.status(200).json({
       finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      proctoring: interview.proctoring,
      questionWiseScore: interview.questions.map((q) => ({
        question: q.question,
        answer: q.answer || "",
        score: q.score || 0,
        feedback: q.feedback || "",
        confidence: q.confidence || 0,
        communication: q.communication || 0,
        correctness: q.correctness || 0,
        confidenceGap: q.confidenceGap || "",
        confidenceImprovement: q.confidenceImprovement || "",
        communicationGap: q.communicationGap || "",
        communicationImprovement: q.communicationImprovement || "",
        correctnessGap: q.correctnessGap || "",
        correctnessImprovement: q.correctnessImprovement || "",
        sampleAnswer: q.sampleAnswer || "",
      })),
    })
  } catch (error) {
    return res.status(500).json({message:`failed to finish Interview ${error}`})
  }
}


export const getMyInterviews = async (req,res) => {
  try {
    const interviews = await Interview.find({userId:req.userId})
    .sort({ createdAt: -1 })
    .select("role experience mode finalScore status createdAt");

    return res.status(200).json(interviews)

  } catch (error) {
     return res.status(500).json({message:`failed to find currentUser Interview ${error}`})
  }
}

export const getInterviewReport = async (req,res) => {
  try {
    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }


    const totalQuestions = interview.questions.length;

    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });
    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

       return res.json({
      finalScore: interview.finalScore,
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      proctoring: interview.proctoring ?? {
        tabAwayCount: 0,
        cameraDisconnectCount: 0,
        multipleFaceCount: 0,
        noFaceCount: 0,
        lookAwayCount: 0,
      },
      questionWiseScore: interview.questions
    });

  } catch (error) {
    return res.status(500).json({message:`failed to find currentUser Interview report ${error}`})
  }
}





import React from 'react'
import maleVideo from "../assets/videos/male-ai.mp4"
import femaleVideo from "../assets/videos/female-ai.mp4"
import Timer from './Timer'
import { motion } from "motion/react"
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { useState } from 'react'
import { useRef } from 'react'
import { useEffect } from 'react'
import axios from "axios"
import { ServerUrl } from '../App'
import { BsArrowRight } from 'react-icons/bs'
import { getGazeDirectionAlert, getFacePose } from '../utils/faceProctoring'

function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, questions, userName } = interviewData;
  const [isIntroPhase, setIsIntroPhase] = useState(true);

  const [isMicOn, setIsMicOn] = useState(false);
  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const micEnabledRef = useRef(false);
  const audioContextRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceAnalyserRef = useRef(null);
  const voiceIntervalRef = useRef(null);
  const voiceCaptureRef = useRef(null);
  const cameraStatusRef = useRef("off");
  const aiPlayingRef = useRef(false);
  const micRestartTimeoutRef = useRef(null);
  const [speechSupported] = useState(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [micError, setMicError] = useState(
    speechSupported ? "" : "Speech recognition is not supported in this browser. You can type your answers."
  );
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(
    questions[0]?.timeLimit || 60
  );
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceGender, setVoiceGender] = useState("male");
  const [subtitle, setSubtitle] = useState("");


  const videoRef = useRef(null);
  const webcamRef = useRef(null);
  const webcamStreamRef = useRef(interviewData.cameraStream);
  const faceLandmarkerRef = useRef(interviewData.faceLandmarker);
  const faceBaselineRef = useRef(interviewData.faceBaseline);
  const isMountedRef = useRef(true);
  const proctoringEventsRef = useRef([]);
  const cameraAlertStateRef = useRef({ candidate: null, since: 0, active: null });
  const [cameraStatus, setCameraStatus] = useState(
    interviewData.cameraStream?.active &&
      interviewData.cameraStream.getVideoTracks().some((track) => track.readyState === "live" && !track.muted)
      ? "on"
      : "off"
  );
  const [cameraError, setCameraError] = useState("");
  const [proctoringAlert, setProctoringAlert] = useState("");

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    cameraStatusRef.current = cameraStatus;
  }, [cameraStatus]);

  useEffect(() => {
    micEnabledRef.current = isMicOn;
  }, [isMicOn]);

  useEffect(() => {
    aiPlayingRef.current = isAIPlaying;
  }, [isAIPlaying]);

  const recordProctoringEvent = (type) => {
    proctoringEventsRef.current = [...proctoringEventsRef.current, type];
  };

  const startMic = () => {
    const recognition = recognitionRef.current;
    if (
      !recognition ||
      recognitionActiveRef.current ||
      !micEnabledRef.current ||
      cameraStatusRef.current !== "on" ||
      aiPlayingRef.current
    ) return;

    try {
      recognition.start();
      recognitionActiveRef.current = true;
      setMicError("");
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        console.error("Unable to start speech recognition:", error);
        setMicError("Could not start speech recognition. Check microphone permission and try again.");
      }
    }
  };

  const stopMic = () => {
    clearTimeout(micRestartTimeoutRef.current);
    micRestartTimeoutRef.current = null;
    const wasActive = recognitionActiveRef.current;
    recognitionActiveRef.current = false;
    if (wasActive) {
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          console.error("Unable to stop speech recognition:", error);
        }
      }
    }
    setInterimTranscript("");
  };

  const resetVoiceCapture = () => {
    voiceCaptureRef.current = {
      startedAt: performance.now(),
      rmsValues: [],
      pitchValues: [],
      speechFrames: 0,
      totalFrames: 0,
    };
  };

  const estimatePitch = (samples, sampleRate) => {
    let bestOffset = -1;
    let bestCorrelation = 0;
    const minOffset = Math.floor(sampleRate / 500);
    const maxOffset = Math.floor(sampleRate / 80);

    for (let offset = minOffset; offset <= maxOffset; offset += 1) {
      let correlation = 0;
      for (let i = 0; i < samples.length - offset; i += 1) {
        correlation += samples[i] * samples[i + offset];
      }
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    return bestOffset > 0 ? sampleRate / bestOffset : 0;
  };

  const stopVoiceCapture = () => {
    clearInterval(voiceIntervalRef.current);
    voiceIntervalRef.current = null;
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    voiceAnalyserRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;

    const capture = voiceCaptureRef.current;
    if (!capture) return null;
    const rmsValues = capture.rmsValues;
    const pitchValues = capture.pitchValues;
    const average = (values) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const variance = (values, mean) =>
      values.length ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length : 0;
    const rmsAverage = average(rmsValues);
    const rmsVariance = variance(rmsValues, rmsAverage);
    const pitchAverage = average(pitchValues);
    const pitchVariance = variance(pitchValues, pitchAverage);
    const durationSeconds = Math.max(0, (performance.now() - capture.startedAt) / 1000);

    return {
      durationSeconds: Number(durationSeconds.toFixed(2)),
      speechRatio: capture.totalFrames
        ? Number((capture.speechFrames / capture.totalFrames).toFixed(3))
        : 0,
      averageRms: Number(rmsAverage.toFixed(5)),
      rmsCoefficientOfVariation: rmsAverage
        ? Number((Math.sqrt(rmsVariance) / rmsAverage).toFixed(3))
        : 1,
      averagePitchHz: Number(pitchAverage.toFixed(1)),
      pitchCoefficientOfVariation: pitchAverage
        ? Number((Math.sqrt(pitchVariance) / pitchAverage).toFixed(3))
        : 1,
    };
  };

  const startVoiceCapture = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      resetVoiceCapture();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (!micEnabledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      voiceStreamRef.current = stream;
      voiceAnalyserRef.current = analyser;
      audioContextRef.current = context;

      const samples = new Float32Array(analyser.fftSize);
      voiceIntervalRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (let i = 0; i < samples.length; i += 1) {
          energy += samples[i] * samples[i];
        }
        const rms = Math.sqrt(energy / samples.length);
        const capture = voiceCaptureRef.current;
        if (!capture) return;

        capture.totalFrames += 1;
        capture.rmsValues.push(rms);
        if (rms >= 0.012) {
          capture.speechFrames += 1;
          const pitch = estimatePitch(samples, context.sampleRate);
          if (pitch >= 80 && pitch <= 500) capture.pitchValues.push(pitch);
        }
      }, 250);
    } catch (error) {
      console.error("Unable to start voice analysis:", error);
      setMicError("Voice analysis could not start. Check microphone permission and try again.");
    }
  };

  const startWebcam = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access requires a supported browser and a secure connection.");
      setCameraStatus("off");
      return;
    }

    setCameraError("");
    setCameraStatus("requesting");
    try {
      webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      webcamStreamRef.current = stream;
      const handleCameraUnavailable = () => {
        if (webcamStreamRef.current !== stream) return;
        webcamStreamRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        if (webcamRef.current) {
          webcamRef.current.srcObject = null;
        }
        setCameraStatus("off");
        setCameraError("The camera disconnected. Reconnect it to continue.");
        recordProctoringEvent("camera-disconnected");
      };
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", handleCameraUnavailable, { once: true });
        track.addEventListener("mute", () => {
          if (webcamStreamRef.current !== stream) return;
          setCameraStatus("off");
          setCameraError("The camera feed paused. Reconnect it to continue.");
          recordProctoringEvent("camera-disconnected");
        }, { once: true });
      });
      setCameraStatus("connecting");
    } catch (error) {
      console.error("Unable to start webcam:", error);
      setCameraError("Camera access was not available. Check browser permissions and try again.");
      setCameraStatus("off");
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordProctoringEvent("tab-hidden");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!["on", "connecting"].includes(cameraStatus) || !webcamRef.current || !webcamStreamRef.current) return;

    const video = webcamRef.current;
    const stream = webcamStreamRef.current;
    let active = true;
    const handleVideoReady = () => {
      if (!active || webcamStreamRef.current !== stream || video.videoWidth === 0) return;
      setCameraError("");
      setCameraStatus("on");
    };

    video.muted = true;
    video.playsInline = true;
    if (video.srcObject !== stream) video.srcObject = stream;
    video.addEventListener("loadeddata", handleVideoReady);
    video.addEventListener("playing", handleVideoReady);
    video.play().then(handleVideoReady).catch((error) => {
      console.error("Unable to play webcam preview:", error);
      setCameraError("The webcam opened but its preview could not start. Reconnect the camera.");
      setCameraStatus("off");
    });

    return () => {
      active = false;
      video.removeEventListener("loadeddata", handleVideoReady);
      video.removeEventListener("playing", handleVideoReady);
    };
  }, [cameraStatus]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return undefined;

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setMicError("");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText.trim()) {
        setAnswer((previous) => `${previous}${previous.trim() ? " " : ""}${finalText.trim()}`);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      recognitionActiveRef.current = false;
      if (event.error === "aborted" || event.error === "no-speech") return;

      console.error("Speech recognition error:", event.error);
      const errorMessages = {
        "not-allowed": "Microphone permission was denied. Allow microphone access in your browser and try again.",
        "service-not-allowed": "Speech recognition is blocked by this browser or network.",
        "audio-capture": "No microphone was found. Connect a microphone and try again.",
        network: "Speech recognition lost its network connection. Check your connection and try again.",
      };
      setMicError(errorMessages[event.error] || "Speech recognition stopped. Try turning the microphone off and on.");
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micEnabledRef.current = false;
        setIsMicOn(false);
      }
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;
      if (micEnabledRef.current && cameraStatusRef.current === "on" && !aiPlayingRef.current) {
        micRestartTimeoutRef.current = setTimeout(startMic, 250);
      }
    };

    recognitionRef.current = recognition;
    return () => {
      clearTimeout(micRestartTimeoutRef.current);
      micEnabledRef.current = false;
      recognitionActiveRef.current = false;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      if (recognitionActiveRef.current) {
        try {
          recognition.stop();
        } catch (error) {
          if (error.name !== "InvalidStateError") {
            console.error("Unable to clean up speech recognition:", error);
          }
        }
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (cameraStatus === "on") {
      if (micEnabledRef.current && !aiPlayingRef.current) {
        micRestartTimeoutRef.current = setTimeout(startMic, 0);
      }
    } else {
      micRestartTimeoutRef.current = setTimeout(stopMic, 0);
    }

    return () => clearTimeout(micRestartTimeoutRef.current);
  }, [cameraStatus]);

  useEffect(() => {
    if (cameraStatus !== "on" || !webcamRef.current || !faceLandmarkerRef.current) return;

    let active = true;
    let frameId;
    let lastVideoTime = -1;
    const alertMessages = {
      "no-face": "No face detected. Make sure your face is visible to the webcam.",
      "multiple-faces": "More than one face is visible. Please make sure you are alone in the frame.",
      "looking-sideways": "You appear to be looking away from the screen.",
      "looking-down": "You appear to be looking down for an extended moment.",
    };

    const analyzeFrame = () => {
      if (!active) return;
      const video = webcamRef.current;
      if (video?.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const now = performance.now();
        let faces;
        try {
          faces = faceLandmarkerRef.current.detectForVideo(video, now).faceLandmarks;
        } catch (error) {
          console.error("Webcam face analysis stopped:", error);
          setCameraError("Webcam analysis stopped. Reconnect the camera to continue.");
          setCameraStatus("off");
          return;
        }
        let condition = null;

        if (faces.length === 0) {
          condition = "no-face";
        } else if (faces.length > 1) {
          condition = "multiple-faces";
        } else {
          const pose = getFacePose(faces[0]);
          if (pose && faceBaselineRef.current) {
            condition = getGazeDirectionAlert(pose, faceBaselineRef.current);
          }
        }

        const alertState = cameraAlertStateRef.current;
        if (condition !== alertState.candidate) {
          alertState.candidate = condition;
          alertState.since = now;
          if (!condition) {
            alertState.active = null;
            setProctoringAlert("");
          }
        }

        if (condition && now - alertState.since >= 1200 && alertState.active !== condition) {
          alertState.active = condition;
          proctoringEventsRef.current = [...proctoringEventsRef.current, condition];
          setProctoringAlert(alertMessages[condition]);
        }
      }

      frameId = requestAnimationFrame(analyzeFrame);
    };

    frameId = requestAnimationFrame(analyzeFrame);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [cameraStatus]);


  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      // Try known female voices first
      const femaleVoice =
        voices.find(v =>
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("samantha") ||
          v.name.toLowerCase().includes("female")
        );

      if (femaleVoice) {
        setSelectedVoice(femaleVoice);
        setVoiceGender("female");
        return;
      }

      // Try known male voices
      const maleVoice =
        voices.find(v =>
          v.name.toLowerCase().includes("david") ||
          v.name.toLowerCase().includes("mark") ||
          v.name.toLowerCase().includes("male")
        );

      if (maleVoice) {
        setSelectedVoice(maleVoice);
        setVoiceGender("male");
        return;
      }

      // Fallback: first voice (assume female)
      setSelectedVoice(voices[0]);
      setVoiceGender("female");
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

  }, [])

  const videoSource = voiceGender === "male" ? maleVideo : femaleVideo;


  /* ---------------- SPEAK FUNCTION ---------------- */
  const speakText = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      // Add natural pauses after commas and periods
      const humanText = text
        .replace(/,/g, ", ... ")
        .replace(/\./g, ". ... ");

      const utterance = new SpeechSynthesisUtterance(humanText);

      utterance.voice = selectedVoice;

      // Human-like pacing
      utterance.rate = 0.92;     // slightly slower than normal
      utterance.pitch = 1.05;    // small warmth
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsAIPlaying(true);
          aiPlayingRef.current = true;
        stopMic()
        videoRef.current?.play();
      };


      utterance.onend = () => {
        videoRef.current?.pause();
        videoRef.current.currentTime = 0;
        setIsAIPlaying(false);
        aiPlayingRef.current = false;



        if (micEnabledRef.current) {
          startMic();
        }
        setTimeout(() => {
          setSubtitle("");
          resolve();
        }, 300);
      };


      setSubtitle(text);

      window.speechSynthesis.speak(utterance);
    });
  };


  useEffect(() => {
    if (!selectedVoice) {
      return;
    }
    const runIntro = async () => {
      if (isIntroPhase) {
        await speakText(
          `Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`
        );

        await speakText(
          "I'll ask you a few questions. Just answer naturally, and take your time. Let's begin."
        );

        setIsIntroPhase(false)
      } else if (currentQuestion) {
        await new Promise(r => setTimeout(r, 800));

        // If last question (hard level)
        if (currentIndex === questions.length - 1) {
          await speakText("Alright, this one might be a bit more challenging.");
        }

        await speakText(currentQuestion.question);

        if (isMicOn) {
          startMic();
        }
      }

    }

    runIntro()


  }, [selectedVoice, isIntroPhase, currentIndex])



  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;
    if (cameraStatus !== "on") return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0;
        }
        return prev - 1

      })
    }, 1000);

    return () => clearInterval(timer)

  }, [isIntroPhase, currentIndex, cameraStatus])

  useEffect(() => {
  if (!isIntroPhase && currentQuestion) {
    setTimeLeft(currentQuestion.timeLimit || 60);
  }
}, [currentIndex]);


  const toggleMic = () => {
    if (isMicOn) {
      micEnabledRef.current = false;
      stopMic();
      stopVoiceCapture();
      setMicError("");
      setIsMicOn(false);
    } else {
      micEnabledRef.current = true;
      setIsMicOn(true);
      startVoiceCapture();
      if (!recognitionRef.current) {
        setMicError("Speech transcription is not available in this browser. Voice capture is required.");
        return;
      }
      startMic();
      if (!recognitionActiveRef.current) {
        setMicError("Microphone did not start. Check browser microphone permission and try again.");
      }
    }
  };


  const submitAnswer = async () => {
    if (isSubmitting || cameraStatus !== "on" || !isMicOn) return;
    micEnabledRef.current = false;
    stopMic()
    const voiceMetrics = stopVoiceCapture();
    setIsMicOn(false);
    setIsSubmitting(true)

    try {
      const result = await axios.post(ServerUrl + "/api/interview/submit-answer", {
        interviewId,
        questionIndex: currentIndex,
        answer,
        voiceMetrics,
        timeTaken:
          currentQuestion.timeLimit - timeLeft,
      } , {withCredentials:true})

      setFeedback(result.data.feedback)
      speakText(result.data.feedback)
      setIsSubmitting(false)
    } catch (error) {
console.log(error)
setIsSubmitting(false)
    }
  }

  const handleNext =async () => {
    if (cameraStatus !== "on") return;
    setAnswer("");
    setFeedback("");
    resetVoiceCapture();

    if (currentIndex + 1 >= questions.length) {
      finishInterview();
      return;
    }

    await speakText("Alright, let's move to the next question.");

    setCurrentIndex(currentIndex + 1);
    setTimeout(() => {
      if (isMicOn) startMic();
    }, 500);

   
  }

  const finishInterview = async () => {
    if (cameraStatus !== "on") return;
    stopMic()
    setIsMicOn(false)
    try {
      const proctoring = {
        tabAwayCount: proctoringEventsRef.current.filter((event) => event === "tab-hidden").length,
        cameraDisconnectCount: proctoringEventsRef.current.filter((event) => event === "camera-disconnected").length,
        multipleFaceCount: proctoringEventsRef.current.filter((event) => event === "multiple-faces").length,
        noFaceCount: proctoringEventsRef.current.filter((event) => event === "no-face").length,
        lookAwayCount: proctoringEventsRef.current.filter((event) => event === "looking-sideways" || event === "looking-down").length,
      };
      const result = await axios.post(ServerUrl+ "/api/interview/finish" , { interviewId, proctoring} , {withCredentials:true})

      console.log(result.data)
      onFinish(result.data)
    } catch (error) {
      console.log(error)
    }
  }


   useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    if (timeLeft === 0 && !isSubmitting && !feedback) {
      submitAnswer()
    }
  }, [timeLeft, cameraStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopVoiceCapture();
      webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      }

      window.speechSynthesis.cancel();
    };
  }, []);







  return (
    <div className='min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-100 flex items-center justify-center p-4 sm:p-6'>
      <div className='w-full max-w-350 min-h-[80vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col lg:flex-row overflow-hidden'>

        {/* video section */}
        <div className='w-full lg:w-[35%] bg-slate-950 flex flex-col items-center p-6 space-y-6 border-r border-slate-800'>
          <div className='relative w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 shadow-xl'>
            <video
              src={videoSource}
              key={videoSource}
              ref={videoRef}
              muted
              playsInline
              preload="auto"
              className="aspect-[4/3] w-full object-cover"
            />
            <div className='absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/60 px-3 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur'>
              AI INTERVIEWER
            </div>
          </div>

          <div className='w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-sm'>
            <div className='mb-3 flex items-center justify-between gap-3'>
              <div>
                <h3 className='font-semibold text-gray-800'>Required webcam monitoring</h3>
                <p className='text-xs text-gray-500'>Video is processed locally and is not recorded.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cameraStatus === "on" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                {cameraStatus === "on" ? "Camera on" : cameraStatus === "connecting" ? "Connecting..." : cameraStatus === "requesting" ? "Requesting..." : "Camera required"}
              </span>
            </div>
            {["on", "connecting"].includes(cameraStatus) ? (
              <video
                ref={webcamRef}
                autoPlay
                muted
                playsInline
                className='mb-3 aspect-video w-full rounded-xl bg-gray-900 object-cover'
                aria-label='Your live webcam preview'
              />
            ) : (
              <div className='mb-3 flex aspect-video items-center justify-center rounded-xl bg-gray-900 px-4 text-center text-sm text-white'>
                {cameraStatus === "requesting" ? "Waiting for camera permission..." : "Reconnect the webcam to continue."}
              </div>
            )}
            {proctoringAlert && (
              <p role='status' aria-live='polite' className='mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900'>
                Proctoring warning: {proctoringAlert}
              </p>
            )}
            {cameraError && <p role='alert' className='mb-3 text-sm text-red-600'>{cameraError}</p>}
            {cameraStatus !== "on" && (
              <button
                type='button'
                onClick={startWebcam}
                disabled={cameraStatus === "requesting"}
                className='w-full rounded-xl border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60'
              >
                {cameraStatus === "requesting" ? "Waiting for permission..." : "Reconnect webcam"}
              </button>
            )}
            <p className='mt-2 text-xs leading-relaxed text-gray-500'>
              The timer and answer controls pause if the camera disconnects. Sustained face-count or gaze/head-direction changes trigger warnings; they can be wrong and are not proof of misconduct. The check is not a confidence score. Facial expressions are not analyzed.
            </p>
          </div>

          {/* subtitle */}
          {subtitle && (
            <div className='w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm'>
              <p className='text-gray-700 text-sm sm:text-base font-medium text-center leading-relaxed'>{subtitle}</p>
            </div>
          )}


          {/* timer Area */}
          <div className='w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-6 space-y-5'>
            <div className='flex justify-between items-center'>
              <span className='text-sm text-gray-500'>
                Interview Status
              </span>
              {isAIPlaying && <span className='text-sm font-semibold text-emerald-600'>
                {isAIPlaying ? "AI Speaking" : ""}
              </span>}
            </div>

            <div className="h-px bg-gray-200"></div>

            <div className='flex justify-center'>

              <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} />
            </div>

            <div className="h-px bg-gray-200"></div>

            <div className='grid grid-cols-2 gap-6 text-center'>
              <div>
                <span className='text-2xl font-bold text-emerald-600'>{currentIndex + 1}</span>
                <span className='text-xs text-gray-400'>Current Questions</span>
              </div>

              <div>
                <span className='text-2xl font-bold text-emerald-600'>{questions.length}</span>
                <span className='text-xs text-gray-400'>Total Questions</span>
              </div>
            </div>


          </div>
        </div>

        {/* Text section */}

        <div className='flex-1 flex flex-col p-4 sm:p-6 md:p-8 relative'>
          <h2 className='text-xl sm:text-2xl font-bold text-emerald-600 mb-6'>
            AI Smart Interview
          </h2>


          {!isIntroPhase && (<div className='relative mb-6 bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm'>
            <p className='text-xs sm:text-sm text-gray-400 mb-2'>
              Question {currentIndex + 1} of {questions.length}
            </p>

            <div className='text-base sm:text-lg font-semibold text-gray-800 leading-relaxed '>{currentQuestion?.question}</div>
          </div>)
          }
          <div
            aria-label="Voice transcription"
            className="flex-1 min-h-36 bg-gray-100 p-4 sm:p-6 rounded-2xl border border-gray-200 text-gray-800 overflow-y-auto whitespace-pre-wrap">
            {answer || "Turn on the microphone and speak your answer. Text transcription is for display only."}
          </div>
              {interimTranscript && (
                <p aria-live='polite' className='mt-2 text-sm text-gray-500'>
                  Hearing: {interimTranscript}
                </p>
              )}
              {micError && (
                <p role='alert' className='mt-2 text-sm text-amber-700'>
                  {micError}
                </p>
              )}
              {!speechSupported && (
                <p className='mt-2 text-sm text-gray-500'>
                  Voice transcription and voice capture are unavailable in this browser.
                </p>
              )}


         {!feedback ? ( <div className='flex items-center gap-4 mt-6'>
            <motion.button
              onClick={toggleMic}
                  type='button'
                  aria-label={isMicOn ? "Turn microphone off" : "Turn microphone on"}
                  aria-pressed={isMicOn}
                  disabled={!speechSupported || cameraStatus !== "on"}
              whileTap={{ scale: 0.9 }}
                  className='w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50'>
              {isMicOn ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20}/>}
            </motion.button>
            <span className='text-sm text-gray-600' aria-live='polite'>
                  {isMicOn ? "Microphone enabled" : "Tap the mic to start voice transcription"}
            </span>

            <motion.button
            onClick={submitAnswer}
            disabled={isSubmitting || cameraStatus !== "on" || !isMicOn}
              whileTap={{ scale: 0.95 }}
              className='flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-3 sm:py-4 rounded-2xl shadow-lg hover:opacity-90 transition font-semibold disabled:bg-gray-500'>
              {isSubmitting?"Submitting...":"Submit Answer"}

            </motion.button>

          </div>):(
            <motion.div 
             initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            className='mt-6 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm'>
              <p className='text-emerald-700 font-medium mb-4'>{feedback}</p>

              <button
              onClick={handleNext}
              disabled={cameraStatus !== "on"}

               className='w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-3 rounded-xl shadow-md hover:opacity-90 transition flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-60'>
                Next Question <BsArrowRight size={18}/>
              </button>

            </motion.div>
          )}
        </div>
      </div>

    </div>
  )
}

export default Step2Interview

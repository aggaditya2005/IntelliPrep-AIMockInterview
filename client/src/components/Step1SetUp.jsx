import React from 'react'
import { motion } from "motion/react"
import {
    FaUserTie,
    FaBriefcase,
    FaFileUpload,
    FaMicrophoneAlt,
    FaChartLine,
    FaVideo,
} from "react-icons/fa";
import { useEffect, useRef, useState } from 'react';
import axios from "axios"
import { ServerUrl } from '../App';
import { useDispatch, useSelector } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import { averageFacePose, createFaceLandmarker, getFacePose } from '../utils/faceProctoring';
function Step1SetUp({ onStart }) {
    const {userData}= useSelector((state)=>state.user)
    const dispatch = useDispatch()
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("");
    const [mode, setMode] = useState("Technical");
    const [resumeFile, setResumeFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [skills, setSkills] = useState([]);
    const [resumeText, setResumeText] = useState("");
    const [analysisDone, setAnalysisDone] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [cameraStatus, setCameraStatus] = useState("off");
    const [cameraError, setCameraError] = useState("");
    const cameraVideoRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const faceLandmarkerRef = useRef(null);
    const faceBaselineRef = useRef(null);
    const cameraFrameRef = useRef(null);
    const cameraTransferredRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            cancelAnimationFrame(cameraFrameRef.current);
            if (!cameraTransferredRef.current) {
                cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
                faceLandmarkerRef.current?.close();
            }
        };
    }, []);

    const stopCamera = () => {
        cancelAnimationFrame(cameraFrameRef.current);
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        faceLandmarkerRef.current?.close();
        cameraStreamRef.current = null;
        faceLandmarkerRef.current = null;
        faceBaselineRef.current = null;
        if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = null;
        }
        setCameraStatus("off");
    };

    const startCameraCheck = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError("Camera access requires a supported browser and a secure connection.");
            setCameraStatus("error");
            return;
        }

        stopCamera();
        setCameraError("");
        setCameraStatus("requesting");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: "user" },
            });
            if (!isMountedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            cameraStreamRef.current = stream;
            const handleCameraUnavailable = () => {
                if (cameraStreamRef.current !== stream || cameraTransferredRef.current) return;
                cancelAnimationFrame(cameraFrameRef.current);
                setCameraError("The camera disconnected. Restart the camera check to continue.");
                setCameraStatus("error");
            };
            stream.getVideoTracks()[0]?.addEventListener("ended", handleCameraUnavailable, { once: true });
            stream.getVideoTracks()[0]?.addEventListener("mute", handleCameraUnavailable, { once: true });

            if (!cameraVideoRef.current) {
                throw new Error("Camera preview is unavailable.");
            }
            cameraVideoRef.current.srcObject = stream;
            await cameraVideoRef.current.play();

            setCameraStatus("loading");
            const faceLandmarker = await createFaceLandmarker();
            if (!isMountedRef.current) {
                faceLandmarker.close();
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            if (!stream.active || stream.getVideoTracks()[0]?.muted) {
                faceLandmarker.close();
                setCameraError("The camera disconnected. Restart the camera check to continue.");
                setCameraStatus("error");
                return;
            }
            faceLandmarkerRef.current = faceLandmarker;
            setCameraStatus("calibrating");

            const calibrationPoses = [];
            let lastVideoTime = -1;
            const collectCalibration = () => {
                if (!isMountedRef.current || !cameraVideoRef.current || !faceLandmarkerRef.current) return;
                if (!stream.active) {
                    setCameraError("The camera disconnected. Restart the camera check to continue.");
                    setCameraStatus("error");
                    return;
                }
                const video = cameraVideoRef.current;
                if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
                    lastVideoTime = video.currentTime;
                    let results;
                    try {
                        results = faceLandmarker.detectForVideo(video, performance.now());
                    } catch (error) {
                        console.error("Face-check calibration failed:", error);
                        setCameraError("The face check could not analyze the camera. Retry before continuing.");
                        setCameraStatus("error");
                        return;
                    }
                    const faces = results.faceLandmarks;
                    if (faces.length === 1) {
                        const pose = getFacePose(faces[0]);
                        if (pose) calibrationPoses.push(pose);
                        if (calibrationPoses.length >= 24) {
                            faceBaselineRef.current = averageFacePose(calibrationPoses);
                            setCameraStatus("ready");
                            return;
                        }
                    } else {
                        calibrationPoses.length = 0;
                    }
                }
                cameraFrameRef.current = requestAnimationFrame(collectCalibration);
            };
            cameraFrameRef.current = requestAnimationFrame(collectCalibration);
        } catch (error) {
            console.error("Unable to initialize the required webcam check:", error);
            setCameraError("Camera check failed. Allow camera access and retry; an internet connection is needed to load the face-detection model.");
            setCameraStatus("error");
        }
    };

    const handleUploadResume = async () => {
        if (!resumeFile || analyzing) return;
        setAnalyzing(true)

        const formdata = new FormData()
        formdata.append("resume", resumeFile)

        try {
            const result = await axios.post(ServerUrl + "/api/interview/resume", formdata, { withCredentials: true })

            console.log(result.data)

            setRole(result.data.role || "");
            setExperience(result.data.experience || "");
            setProjects(result.data.projects || []);
            setSkills(result.data.skills || []);
            setResumeText(result.data.resumeText || "");
            setAnalysisDone(true);

            setAnalyzing(false);

        } catch (error) {
            console.log(error)
            setAnalyzing(false);
        }
    }

    const handleStart = async () => {
        const videoTrack = cameraStreamRef.current?.getVideoTracks()[0];
        if (
            cameraStatus !== "ready" ||
            !cameraStreamRef.current?.active ||
            !videoTrack ||
            videoTrack.muted ||
            !faceLandmarkerRef.current
        ) return;
        setLoading(true)
        try {
           const result = await axios.post(ServerUrl + "/api/interview/generate-questions" , {role, experience, mode , resumeText, projects, skills } , {withCredentials:true}) 
           console.log(result.data)
           if(userData){
            dispatch(setUserData({...userData , credits:result.data.creditsLeft}))
           }
           setLoading(false)
           cameraTransferredRef.current = true;
           cancelAnimationFrame(cameraFrameRef.current);
           onStart({
            ...result.data,
            cameraStream: cameraStreamRef.current,
            faceLandmarker: faceLandmarkerRef.current,
            faceBaseline: faceBaselineRef.current,
           })

        } catch (error) {
            console.log(error)
            setLoading(false)
        }
    }
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4'>

            <div className='w-full max-w-6xl bg-white rounded-3xl shadow-2xl grid md:grid-cols-2 overflow-hidden'>

                <motion.div
                    initial={{ x: -80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7 }}
                    className='relative bg-gradient-to-br from-green-50 to-green-100 p-12 flex flex-col justify-center'>

                    <h2 className="text-4xl font-bold text-gray-800 mb-6">
                        Start Your AI Interview
                    </h2>

                    <p className="text-gray-600 mb-10">
                        Practice real interview scenarios powered by AI.
                        Improve communication, technical skills, and confidence.
                    </p>

                    <div className='space-y-5'>

                        {
                            [
                                {
                                    icon: <FaUserTie className="text-green-600 text-xl" />,
                                    text: "Choose Role & Experience",
                                },
                                {
                                    icon: <FaMicrophoneAlt className="text-green-600 text-xl" />,
                                    text: "Smart Voice Interview",
                                },
                                {
                                    icon: <FaChartLine className="text-green-600 text-xl" />,
                                    text: "Performance Analytics",
                                },
                            ].map((item, index) => (
                                <motion.div key={index}
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 + index * 0.15 }}
                                    whileHover={{ scale: 1.03 }}
                                    className='flex items-center space-x-4 bg-white p-4 rounded-xl shadow-sm cursor-pointer'>
                                    {item.icon}
                                    <span className='text-gray-700 font-medium'>{item.text}</span>

                                </motion.div>
                            ))
                        }
                    </div>



                </motion.div>



                <motion.div
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7 }}
                    className="p-12 bg-white">

                    <h2 className='text-3xl font-bold text-gray-800 mb-8'>
                        Interview SetUp
                    </h2>


                    <div className='space-y-6'>

                        <div className='relative'>
                            <FaUserTie className='absolute top-4 left-4 text-gray-400' />

                            <input type='text' placeholder='Enter role'
                                className='w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition'
                                onChange={(e) => setRole(e.target.value)} value={role} />
                        </div>


                        <div className='relative'>
                            <FaBriefcase className='absolute top-4 left-4 text-gray-400' />

                            <input type='text' placeholder='Experience (e.g. 2 years)'
                                className='w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition'
                                onChange={(e) => setExperience(e.target.value)} value={experience} />



                        </div>

                        <select value={mode}
                            onChange={(e) => setMode(e.target.value)}
                            className='w-full py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition'>

                            <option value="Technical">Technical Interview</option>
                            <option value="HR">HR Interview</option>

                        </select>

                        <div className='rounded-xl border border-emerald-200 bg-emerald-50 p-4'>
                            <div className='mb-3 flex items-center gap-2'>
                                <FaVideo className='text-emerald-700' />
                                <h3 className='font-semibold text-gray-800'>Required webcam check</h3>
                            </div>
                            <video
                                ref={cameraVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className='mb-3 aspect-video w-full rounded-lg bg-gray-900 object-cover'
                                aria-label='Live webcam preview'
                            />
                            <p className='mb-3 text-sm text-gray-700' aria-live='polite'>
                                {cameraStatus === "ready" && "Camera and face check ready."}
                                {cameraStatus === "requesting" && "Waiting for camera permission..."}
                                {cameraStatus === "loading" && "Loading the on-device face check..."}
                                {cameraStatus === "calibrating" && "Center one face and look toward the camera to calibrate."}
                                {cameraStatus === "off" && "Enable your camera and pass the face check before starting."}
                                {cameraStatus === "error" && "Camera check unavailable."}
                            </p>
                            {cameraError && <p role='alert' className='mb-3 text-sm text-red-700'>{cameraError}</p>}
                            {cameraStatus !== "ready" && (
                                <button
                                    type='button'
                                    onClick={startCameraCheck}
                                    disabled={["requesting", "loading", "calibrating"].includes(cameraStatus)}
                                    className='w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60'
                                >
                                    {cameraStatus === "error" ? "Retry camera check" : "Enable required webcam"}
                                </button>
                            )}
                            <p className='mt-3 text-xs leading-relaxed text-gray-600'>
                                Webcam access is required to continue. Face checks run in your browser; video is not saved or uploaded. Alerts can be wrong and are not proof of misconduct. The check approximates gaze and head direction, not confidence.
                            </p>
                        </div>

                        {!analysisDone && (
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                onClick={() => document.getElementById("resumeUpload").click()}
                                className='border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition'>

                                <FaFileUpload className='text-4xl mx-auto text-green-600 mb-3' />

                                <input type="file"
                                    accept="application/pdf"
                                    id="resumeUpload"
                                    className='hidden'
                                    onChange={(e) => setResumeFile(e.target.files[0])} />

                                <p className='text-gray-600 font-medium'>
                                    {resumeFile ? resumeFile.name : "Click to upload resume (Optional)"}
                                </p>

                                {resumeFile && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUploadResume()
                                        }}

                                        className='mt-4 bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition'>
                                        {analyzing ? "Analyzing..." : "Analyze Resume"}



                                    </motion.button>)}

                            </motion.div>


                        )}

                        {analysisDone && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className='bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4'>
                                <h3 className='text-lg font-semibold text-gray-800'>
                                    Resume Analysis Result</h3>

                                {projects.length > 0 && (
                                    <div>
                                        <p className='font-medium text-gray-700 mb-1'>
                                            Projects:</p>

                                        <ul className='list-disc list-inside text-gray-600 space-y-1'>
                                            {projects.map((p, i) => (
                                                <li key={i}>{p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {skills.length > 0 && (
                                    <div>
                                        <p className='font-medium text-gray-700 mb-1'>
                                            Skills:</p>

                                        <div className='flex flex-wrap gap-2'>
                                            {skills.map((s, i) => (
                                                <span key={i} className='bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm'>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </motion.div>
                        )}


                        <motion.button
                        onClick={handleStart}
                            disabled={!role || !experience || loading || cameraStatus !== "ready"}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                            className='w-full disabled:bg-gray-600 bg-green-600 hover:bg-green-700 text-white py-3 rounded-full text-lg font-semibold transition duration-300 shadow-md'>
                            {loading ? "Starting..." : "Start Interview"}


                        </motion.button>
                    </div>

                </motion.div>
            </div>

        </motion.div>
    )
}

export default Step1SetUp

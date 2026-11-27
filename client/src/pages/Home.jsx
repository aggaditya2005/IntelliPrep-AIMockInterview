import React from 'react'
import Navbar from '../components/Navbar'
import { useSelector } from 'react-redux'
import { motion } from "motion/react";
import {
  BsRobot,
  BsMic,
  BsClock,
  BsBarChart,
  BsFileEarmarkText,
  BsBriefcase,
  BsArrowUpRight,
  BsEnvelope
} from "react-icons/bs";
import { HiSparkles } from "react-icons/hi";
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AuthModel from '../components/AuthModel';
import hrImg from "../assets/HR.png";
import techImg from "../assets/tech.png";
import confidenceImg from "../assets/confi.png";
import creditImg from "../assets/credit.png";
import evalImg from "../assets/ai-ans.png";
import resumeImg from "../assets/resume.png";
import pdfImg from "../assets/pdf.png";
import analyticsImg from "../assets/history.png";
import maleAvatarVideo from "../assets/videos/male-ai.mp4";
import Footer from '../components/Footer';


function Home() {
  const { userData } = useSelector((state) => state.user)
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate()
  const jobAlertsFormUrl = import.meta.env.VITE_N8N_JOB_ALERT_FORM_URL
    || (import.meta.env.DEV && "http://localhost:5678/form/24adbe6c-d9ba-4707-b359-711ed611af48")
  return (
    <div className='min-h-screen bg-[#f8f7fc] flex flex-col'>
      <Navbar />

      <main className='flex-1 px-5 py-12 sm:px-8 sm:py-16'>
        <div className='max-w-6xl mx-auto'>

          <section className='grid items-center gap-12 pb-20 md:grid-cols-[1.05fr_0.95fr] md:gap-16 md:pb-28'>
            <div>
              <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm'>
                <HiSparkles size={16} className="text-emerald-600" />
                AI-powered interview practice
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className='max-w-2xl text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl'>
                Walk into your next interview
                <span className='mt-2 block text-emerald-700'>ready for anything.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className='mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg'>
                Build confidence with realistic, role-based mock interviews, thoughtful follow-up questions, and feedback that helps you improve.
              </motion.p>

              <div className='mt-8 flex flex-wrap gap-3'>
                <motion.button
                  onClick={() => {
                    if (!userData) {
                      setShowAuth(true)
                      return;
                    }
                    navigate("/interview")
                  }}
                  whileHover={{ opacity: 0.9, scale: 1.03 }}
                  whileTap={{ opacity: 1, scale: 0.98 }}
                  className='rounded-full bg-emerald-800 px-7 py-3.5 font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900'>
                  Start practicing
                </motion.button>

                <motion.button
                  onClick={() => {
                    if (!userData) {
                      setShowAuth(true)
                      return;
                    }
                    navigate("/history")
                  }}
                  whileHover={{ opacity: 0.9, scale: 1.03 }}
                  whileTap={{ opacity: 1, scale: 0.98 }}
                  className='rounded-full border border-slate-200 bg-white px-7 py-3.5 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50'>
                  View your progress
                </motion.button>
              </div>

              <div className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500'>
                <span className='inline-flex items-center gap-2'><BsMic className='text-emerald-700' /> Voice-powered practice</span>
                <span className='inline-flex items-center gap-2'><BsBarChart className='text-emerald-700' /> Actionable feedback</span>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className='relative mx-auto w-full max-w-[500px]'>
              <div className='absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-emerald-100 via-teal-50 to-lime-100 blur-2xl' />
              <div className='relative overflow-hidden rounded-[2rem] border border-white bg-slate-950 p-3 shadow-2xl shadow-emerald-950/15'>
                <div className='relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-800 to-slate-950'>
                  <video
                    className='aspect-[4/4.2] w-full object-cover object-top'
                    src={maleAvatarVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-label='AI interviewer avatar preview'
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/20' />
                  <div className='absolute left-5 right-5 top-5 flex items-center justify-between'>
                    <span className='rounded-full border border-white/15 bg-slate-950/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur'>YOUR AI INTERVIEWER</span>
                    <span className='inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700'>
                      <span className='h-2 w-2 rounded-full bg-emerald-500' /> Ready
                    </span>
                  </div>
                  <div className='absolute inset-x-5 bottom-5'>
                    <p className='text-sm font-medium text-emerald-200'>PRACTICE, WITH PURPOSE</p>
                    <p className='mt-1 text-2xl font-semibold text-white'>A more confident you starts here.</p>
                  </div>
                </div>
                <div className='flex items-center justify-between gap-3 px-3 py-4 text-sm text-white'>
                  <span className='font-medium'>Realistic conversations. Useful feedback.</span>
                  <span className='flex shrink-0 items-center gap-1.5 text-emerald-300'><BsMic /> Voice ready</span>
                </div>
              </div>
            </motion.div>
          </section>

          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            aria-labelledby="job-alerts-title"
            className="relative overflow-hidden mb-28 rounded-[2rem] bg-gradient-to-br from-green-950 via-green-900 to-emerald-700 p-8 text-white shadow-xl md:p-12"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-white/5" />
            <div className="pointer-events-none absolute -bottom-28 right-1/4 h-64 w-64 rounded-full bg-green-400/10 blur-3xl" />

            <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-green-50">
                  <HiSparkles size={16} />
                  Free career feature
                </div>
                <h2 id="job-alerts-title" className="text-3xl font-semibold leading-tight md:text-4xl">
                  Your next opportunity,{" "}
                  <span className="text-green-200">delivered to your inbox.</span>
                </h2>
                <p className="mt-4 max-w-xl leading-relaxed text-green-50/80">
                  Tell us the roles, locations, skills, experience level, and employment type you prefer.
                  Get relevant job postings by email—completely free.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-green-50/80">
                  <span className="inline-flex items-center gap-2"><BsBriefcase /> Matched to your preferences</span>
                  <span className="inline-flex items-center gap-2"><BsEnvelope /> Sent to your email</span>
                </div>
              </div>

              {jobAlertsFormUrl ? (
                <a
                  href={jobAlertsFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-3 rounded-full bg-white px-7 py-4 font-semibold text-green-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  Get free job alerts
                  <BsArrowUpRight size={18} />
                </a>
              ) : (
                <p className="max-w-56 text-sm text-green-50/80">
                  Job alerts are being set up. Please check back soon.
                </p>
              )}
            </div>
            <p className="relative mt-8 border-t border-white/15 pt-5 text-xs text-green-50/70">
              Complete the form to get started. Your job alerts are delivered by email.
            </p>
          </motion.section>

          <div className='flex flex-col md:flex-row justify-center items-center gap-10 mb-28'>
            {
              [
                {
                  icon: <BsRobot size={24} />,
                  step: "STEP 1",
                  title: "Role & Experience Selection",
                  desc: "AI adjusts difficulty based on selected job role."
                },
                {
                  icon: <BsMic size={24} />,
                  step: "STEP 2",
                  title: "Smart Voice Interview",
                  desc: "Dynamic follow-up questions based on your answers."
                },
                {
                  icon: <BsClock size={24} />,
                  step: "STEP 3",
                  title: "Timer Based Simulation",
                  desc: "Real interview pressure with time tracking."
                }
              ].map((item, index) => (
                <motion.div key={index}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 + index * 0.2 }}
                  whileHover={{ rotate: 0, scale: 1.06 }}

                  className={`
        relative bg-white rounded-3xl border-2 border-green-100 
        hover:border-green-500 p-10 w-80 max-w-[90%] shadow-md hover:shadow-2xl 
        transition-all duration-300
        ${index === 0 ? "rotate-[-4deg]" : ""}
        ${index === 1 ? "rotate-[3deg] md:-mt-6 shadow-xl" : ""}
        ${index === 2 ? "rotate-[-3deg]" : ""}
      `}>

                  <div className='absolute -top-8 left-1/2 -translate-x-1/2 bg-white border-2 border-green-500 text-green-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg'>
                    {item.icon}</div>
                  <div className='pt-10 text-center'>
                    <div className='text-xs text-green-600 font-semibold mb-2 tracking-wider'>{item.step}</div>
                    <h3 className='font-semibold mb-3 text-lg'>{item.title}</h3>
                    <p className='text-sm text-gray-500 leading-relaxed'>{item.desc}</p>
                  </div>


                </motion.div>
              ))
            }
          </div>


          <div className='mb-32'>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className='text-4xl font-semibold text-center mb-16'>
              Advanced AI{" "}
              <span className="text-green-600">Capabilities</span>

            </motion.h2>

            <div className='grid md:grid-cols-2 gap-10'>
              {
                [
                  {
                    image: evalImg,
                    icon: <BsBarChart size={20} />,
                    title: "AI Answer Evaluation",
                    desc: "Scores communication, technical accuracy and confidence."
                  },
                  {
                    image: resumeImg,
                    icon: <BsFileEarmarkText size={20} />,
                    title: "Resume Based Interview",
                    desc: "Project-specific questions based on uploaded resume."
                  },
                  {
                    image: pdfImg,
                    icon: <BsFileEarmarkText size={20} />,
                    title: "Downloadable PDF Report",
                    desc: "Detailed strengths, weaknesses and improvement insights."
                  },
                  {
                    image: analyticsImg,
                    icon: <BsBarChart size={20} />,
                    title: "History & Analytics",
                    desc: "Track progress with performance graphs and topic analysis."
                  }
                ].map((item, index) => (
                  <motion.div key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className='bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all'>
                    <div className='flex flex-col md:flex-row items-center gap-8'>
                      <div className='w-full md:w-1/2 flex justify-center'>
                        <img src={item.image} alt={item.title} className='w-full h-auto object-contain max-h-64' />
                      </div>

                      <div className='w-full md:w-1/2'>
                        <div className='bg-green-50 text-green-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6'>
                          {item.icon}
                        </div>
                        <h3 className='font-semibold mb-3 text-xl'>{item.title}</h3>
                        <p className='text-gray-500 text-sm leading-relaxed'>{item.desc}</p>
                      </div>

                    </div>


                  </motion.div>
                ))
              }
            </div>


          </div>

          <div className='mb-32'>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className='text-4xl font-semibold text-center mb-16'>
              Multiple Interview{" "}
              <span className="text-green-600">Modes</span>

            </motion.h2>

            <div className='grid md:grid-cols-2 gap-10'>
              {
                [
                  {
                    img: hrImg,
                    title: "HR Interview Mode",
                    desc: "Behavioral and communication based evaluation."
                  },
                  {
                    img: techImg,
                    title: "Technical Mode",
                    desc: "Deep technical questioning based on selected role."
                  },

                  {
                    img: confidenceImg,
                    title: "Confidence Detection",
                    desc: "Basic tone and voice analysis insights."
                  },
                  {
                    img: creditImg,
                    title: "Credits System",
                    desc: "Unlock premium interview sessions easily."
                  }
                ].map((mode, index) => (
                  <motion.div key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ y: -6 }}
                    className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all">

                    <div className='flex items-center justify-between gap-6'>
                      <div className="w-1/2">
                        <h3 className="font-semibold text-xl mb-3">
                          {mode.title}
                        </h3>

                        <p className="text-gray-500 text-sm leading-relaxed">
                          {mode.desc}
                        </p>
                      </div>

                      {/* RIGHT IMAGE */}
                      <div className="w-1/2 flex justify-end">
                        <img
                          src={mode.img}
                          alt={mode.title}
                          className="w-28 h-28 object-contain"
                        />
                      </div>



                    </div>


                  </motion.div>
                ))
              }
            </div>


          </div>

        </div>
      </main>

      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}

        <Footer/>

    </div>
  )
}

export default Home

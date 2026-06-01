import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260329_050842_be71947f-f16e-4a14-810c-06e83d23ddb5.mp4";

const navLinks = ["Platform", "Features", "Technology", "Impact", "Community", "Contact"];

const trustIndicators = [
  { icon: "🤖", label: "AI Powered" },
  { icon: "⚡", label: "Edge Computing" },
  { icon: "📊", label: "Real-Time Analytics" },
  { icon: "🌱", label: "Sustainable Technology" },
];

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOpacity, setVideoOpacity] = useState(0);
  const animationRef = useRef<number>(0);
  const [scrolled, setScrolled] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let startTime: number | null = null;
    const FADE_DURATION = 250;

    const fadeIn = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / FADE_DURATION, 1);
      setVideoOpacity(progress);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(fadeIn);
      }
    };

    const fadeOut = () => {
      startTime = null;
      const doFadeOut = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / FADE_DURATION, 1);
        setVideoOpacity(1 - progress);
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(doFadeOut);
        }
      };
      animationRef.current = requestAnimationFrame(doFadeOut);
    };

    const handleCanPlay = () => {
      setVideoLoaded(true);
    };

    const handlePlay = () => {
      startTime = null;
      animationRef.current = requestAnimationFrame(fadeIn);
    };

    const handleTimeUpdate = () => {
      if (video.duration - video.currentTime <= 0.3) {
        fadeOut();
      }
    };

    // If video is already ready, set loaded
    if (video.readyState >= 3) {
      setVideoLoaded(true);
    }

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("timeupdate", handleTimeUpdate);

    // Fallback: show video after 1 second even if events don't fire
    const fallbackTimer = setTimeout(() => {
      setVideoOpacity(1);
    }, 1000);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      cancelAnimationFrame(animationRef.current);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#0B3D2E]">
      {/* Background image fallback */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(https://mgx-backend-cdn.metadl.com/generate/images/1297646/2026-05-30/ptauubaaahcq/hero-ai-recycling-robot.png)`, opacity: videoLoaded && !videoError ? 0 : 0.6 }}
      />

      {/* Video Background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          className="min-w-[115%] min-h-[115%] object-cover object-top"
          style={{ opacity: videoError ? 0 : videoOpacity }}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoError(true)}
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B3D2E]/50 via-[#0B3D2E]/30 to-[#0B3D2E]/70" />

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0B3D2E]/90 backdrop-blur-xl shadow-lg shadow-black/10 py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="font-schibsted font-bold text-xl text-white tracking-tight">
            GreenGuard
          </div>
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="font-schibsted text-sm text-white/80 hover:text-white transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden sm:block font-schibsted text-sm text-white/90 border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition-all">
              Learn More
            </button>
            <button className="font-schibsted text-sm bg-[#12B76A] text-white px-5 py-2 rounded-full hover:bg-[#12B76A]/90 transition-all shadow-lg shadow-[#12B76A]/20">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
          <span className="font-inter text-sm text-white/90">AI Powered Recycling Intelligence</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="font-fustat font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white max-w-5xl leading-tight"
        >
          Transform Waste Into{" "}
          <span className="gradient-text">Environmental Intelligence</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="font-inter text-lg md:text-xl text-white/70 max-w-2xl mt-6 leading-relaxed"
        >
          GreenGuard combines AI, robotics, and environmental analytics to automatically identify, sort, and measure recyclable waste in real time.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-10"
        >
          <button className="font-inter font-semibold text-base bg-[#12B76A] text-white px-8 py-4 rounded-full hover:bg-[#12B76A]/90 transition-all shadow-xl shadow-[#12B76A]/30 hover:shadow-[#12B76A]/50 hover:-translate-y-0.5">
            Get Started
          </button>
          <button className="font-inter font-medium text-base text-white border border-white/30 px-8 py-4 rounded-full hover:bg-white/10 transition-all flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Watch Demo
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="flex flex-wrap items-center justify-center gap-6 mt-16"
        >
          {trustIndicators.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-inter text-xs text-white/70">{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-white/60"
          />
        </div>
      </motion.div>
    </section>
  );
}
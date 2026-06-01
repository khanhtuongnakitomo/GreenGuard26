import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const steps = [
  { id: 1, title: "Object Detection", desc: "Sensor detects waste item insertion", icon: "👁️", color: "#00D4FF" },
  { id: 2, title: "ESP32-S3 Trigger", desc: "Microcontroller activates the system", icon: "⚡", color: "#12B76A" },
  { id: 3, title: "Jetson Nano", desc: "Edge AI captures and processes image", icon: "🧠", color: "#0B3D2E" },
  { id: 4, title: "YOLOv8n", desc: "AI identifies waste type in real-time", icon: "🎯", color: "#00D4FF" },
  { id: 5, title: "AI Decision", desc: "Engine selects optimal target bin", icon: "🤖", color: "#12B76A" },
  { id: 6, title: "Smart Sorting", desc: "Robotic mechanism moves item to bin", icon: "⚙️", color: "#0B3D2E" },
  { id: 7, title: "Event Data", desc: "Detection event is generated & logged", icon: "📡", color: "#00D4FF" },
  { id: 8, title: "Dashboard", desc: "Real-time analytics & impact metrics", icon: "📊", color: "#12B76A" },
];

export default function WorkflowSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 md:py-32 bg-[#0B3D2E] relative overflow-hidden" id="features">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#12B76A]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00D4FF]/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-block font-inter text-sm font-medium text-[#00D4FF] bg-[#00D4FF]/10 px-4 py-1.5 rounded-full mb-4">
            How It Works
          </span>
          <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-white mt-4">
            Intelligent Waste Sorting <span className="text-[#12B76A]">Pipeline</span>
          </h2>
          <p className="font-inter text-lg text-white/60 max-w-2xl mx-auto mt-6">
            From detection to dashboard — a complete AI-powered workflow that transforms waste into actionable environmental data.
          </p>
        </motion.div>

        {/* Horizontal scroll workflow */}
        <div className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
          <div className="flex gap-4 min-w-max">
            {steps.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 30 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative flex-shrink-0 w-56"
              >
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-[#12B76A]/30 transition-all duration-300 group h-full">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                    style={{ backgroundColor: `${step.color}15` }}
                  >
                    {step.icon}
                  </div>
                  <div className="font-space text-xs text-white/40 mb-1">STEP {step.id}</div>
                  <h3 className="font-sora font-bold text-white text-sm mb-2">{step.title}</h3>
                  <p className="font-inter text-xs text-white/50 leading-relaxed">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 text-[#12B76A]/50 z-10">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Connection line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 1.5, delay: 0.5 }}
          className="h-0.5 bg-gradient-to-r from-[#00D4FF] via-[#12B76A] to-[#0B3D2E] mt-8 rounded-full origin-left"
        />
      </div>
    </section>
  );
}
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const technologies = [
  {
    name: "YOLOv8n",
    desc: "State-of-the-art object detection model optimized for edge deployment with real-time inference",
    category: "AI Model",
    color: "#00D4FF",
  },
  {
    name: "Jetson Nano",
    desc: "NVIDIA edge AI computing platform delivering GPU-accelerated inference at the edge",
    category: "Edge Computing",
    color: "#12B76A",
  },
  {
    name: "ESP32-S3",
    desc: "Dual-core microcontroller with WiFi/BLE for sensor management and system orchestration",
    category: "Embedded",
    color: "#0B3D2E",
  },
  {
    name: "Edge AI",
    desc: "On-device machine learning inference without cloud dependency for instant decisions",
    category: "Architecture",
    color: "#00D4FF",
  },
  {
    name: "Computer Vision",
    desc: "Advanced image processing pipeline for waste classification and quality assessment",
    category: "AI/ML",
    color: "#12B76A",
  },
  {
    name: "Robotics Control",
    desc: "Precision servo-driven sorting mechanism with multi-bin targeting capability",
    category: "Hardware",
    color: "#0B3D2E",
  },
  {
    name: "React Dashboard",
    desc: "Real-time environmental intelligence dashboard with live metrics and analytics",
    category: "Frontend",
    color: "#00D4FF",
  },
  {
    name: "MongoDB Atlas",
    desc: "Cloud-native database for storing detection events and environmental impact data",
    category: "Database",
    color: "#12B76A",
  },
];

export default function TechStackSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden" id="technology">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#12B76A]/3 rounded-full blur-[100px]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-block font-inter text-sm font-medium text-[#12B76A] bg-[#12B76A]/10 px-4 py-1.5 rounded-full mb-4">
            Technology Stack
          </span>
          <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-[#111827] mt-4">
            Built With <span className="gradient-text">Cutting-Edge Tech</span>
          </h2>
          <p className="font-inter text-lg text-gray-500 max-w-2xl mx-auto mt-6">
            A carefully selected technology stack combining AI, embedded systems, and cloud infrastructure.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {technologies.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative"
            >
              <div className="h-full bg-[#F8FAFC] border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-black/5 transition-all duration-500 hover:-translate-y-2 hover:border-transparent overflow-hidden">
                {/* Hover gradient overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{ background: `linear-gradient(135deg, ${tech.color}08, ${tech.color}03)` }}
                />
                <div className="relative z-10">
                  <div
                    className="inline-block font-inter text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md mb-4"
                    style={{ color: tech.color, backgroundColor: `${tech.color}12` }}
                  >
                    {tech.category}
                  </div>
                  <h3 className="font-sora font-bold text-lg text-[#111827] mb-2">{tech.name}</h3>
                  <p className="font-inter text-sm text-gray-500 leading-relaxed">{tech.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
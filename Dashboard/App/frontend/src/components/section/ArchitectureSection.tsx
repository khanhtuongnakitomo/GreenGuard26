import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const architectureNodes = [
  { id: "user", label: "User", sublabel: "Inserts Waste", x: 5, y: 50 },
  { id: "sensor", label: "Sensor", sublabel: "IR Detection", x: 17, y: 50 },
  { id: "esp32", label: "ESP32-S3", sublabel: "MCU Trigger", x: 29, y: 50 },
  { id: "jetson", label: "Jetson Nano", sublabel: "Edge AI", x: 41, y: 50 },
  { id: "yolo", label: "YOLOv8n", sublabel: "Detection", x: 53, y: 50 },
  { id: "queue", label: "Local Queue", sublabel: "Event Buffer", x: 65, y: 50 },
  { id: "api", label: "Backend API", sublabel: "REST Server", x: 77, y: 50 },
  { id: "db", label: "MongoDB", sublabel: "Atlas Cloud", x: 89, y: 35 },
  { id: "dashboard", label: "Dashboard", sublabel: "Analytics", x: 89, y: 65 },
];

export default function ArchitectureSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 md:py-32 bg-[#0B3D2E] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#12B76A]/3 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-block font-inter text-sm font-medium text-[#00D4FF] bg-[#00D4FF]/10 px-4 py-1.5 rounded-full mb-4">
            System Architecture
          </span>
          <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-white mt-4">
            End-to-End <span className="text-[#12B76A]">Intelligence Pipeline</span>
          </h2>
          <p className="font-inter text-lg text-white/60 max-w-2xl mx-auto mt-6">
            A complete data flow from physical waste detection to cloud-based environmental analytics.
          </p>
        </motion.div>

        {/* Architecture Diagram */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 overflow-hidden"
        >
          {/* Grid background */}
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full" style={{ backgroundImage: "linear-gradient(rgba(18,183,106,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(18,183,106,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          </div>

          {/* Desktop Architecture */}
          <div className="hidden md:block relative h-64">
            {/* Connection lines */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              {architectureNodes.slice(0, -2).map((node, i) => {
                const next = architectureNodes[i + 1];
                if (!next || i >= 6) return null;
                return (
                  <motion.line
                    key={`line-${node.id}`}
                    x1={`${node.x + 4}%`}
                    y1={`${node.y}%`}
                    x2={`${next.x}%`}
                    y2={`${next.y}%`}
                    stroke="#12B76A"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={inView ? { pathLength: 1, opacity: 0.5 } : {}}
                    transition={{ duration: 0.5, delay: 0.5 + i * 0.15 }}
                  />
                );
              })}
              {/* Lines from API to DB and Dashboard */}
              <motion.line
                x1="81%" y1="50%" x2="87%" y2="35%"
                stroke="#00D4FF" strokeWidth="2" strokeDasharray="6 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView ? { pathLength: 1, opacity: 0.5 } : {}}
                transition={{ duration: 0.5, delay: 1.5 }}
              />
              <motion.line
                x1="81%" y1="50%" x2="87%" y2="65%"
                stroke="#00D4FF" strokeWidth="2" strokeDasharray="6 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView ? { pathLength: 1, opacity: 0.5 } : {}}
                transition={{ duration: 0.5, delay: 1.6 }}
              />
            </svg>

            {/* Nodes */}
            {architectureNodes.map((node, i) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.12, type: "spring" }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div className="bg-[#0B3D2E] border border-[#12B76A]/30 rounded-xl px-3 py-2 text-center hover:border-[#12B76A] hover:shadow-lg hover:shadow-[#12B76A]/20 transition-all duration-300 min-w-[90px]">
                  <div className="font-sora font-bold text-xs text-white whitespace-nowrap">{node.label}</div>
                  <div className="font-inter text-[10px] text-white/50 whitespace-nowrap">{node.sublabel}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Mobile Architecture (vertical) */}
          <div className="md:hidden space-y-3">
            {architectureNodes.map((node, i) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-[#12B76A]/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-space text-xs text-[#12B76A] font-bold">{i + 1}</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex-1">
                  <div className="font-sora font-bold text-sm text-white">{node.label}</div>
                  <div className="font-inter text-xs text-white/50">{node.sublabel}</div>
                </div>
                {i < architectureNodes.length - 1 && (
                  <div className="absolute left-[15px] mt-12 w-0.5 h-3 bg-[#12B76A]/30" />
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
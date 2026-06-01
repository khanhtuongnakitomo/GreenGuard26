import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const stats = [
  { value: "75%", label: "Recyclable waste ends up in landfills due to contamination", icon: "🚮" },
  { value: "40%", label: "Of recycling is rejected due to improper sorting by humans", icon: "❌" },
  { value: "0%", label: "Real-time environmental data from traditional waste systems", icon: "📉" },
];

function AnimatedCounter({ value, inView }: { value: string; inView: boolean }) {
  const numericPart = value.replace(/[^0-9]/g, "");
  const suffix = value.replace(/[0-9]/g, "");

  return (
    <motion.span
      className="font-space font-bold text-5xl md:text-6xl text-[#12B76A]"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.6, type: "spring" }}
    >
      {numericPart}{suffix}
    </motion.span>
  );
}

export default function ProblemSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden" id="platform">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #0B3D2E 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="max-w-7xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <span className="inline-block font-inter text-sm font-medium text-[#12B76A] bg-[#12B76A]/10 px-4 py-1.5 rounded-full mb-4">
            The Problem
          </span>
          <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-[#111827] mt-4">
            The World Has a <span className="gradient-text">Recycling Crisis</span>
          </h2>
          <p className="font-inter text-lg text-gray-500 max-w-2xl mx-auto mt-6">
            Traditional waste management lacks intelligence. Without real-time data and automated sorting, recyclable materials are lost forever.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              className="relative group"
            >
              <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-8 text-center hover:shadow-xl hover:shadow-[#12B76A]/5 transition-all duration-500 hover:-translate-y-1">
                <span className="text-4xl mb-4 block">{stat.icon}</span>
                <AnimatedCounter value={stat.value} inView={inView} />
                <p className="font-inter text-gray-600 mt-4 leading-relaxed">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#0B3D2E] to-[#12B76A] text-white px-6 py-3 rounded-full">
            <span className="font-inter font-medium text-sm">GreenGuard solves this with AI-powered environmental intelligence</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
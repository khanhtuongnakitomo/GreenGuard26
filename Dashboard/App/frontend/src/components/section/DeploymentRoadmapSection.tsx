import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const deployments = [
  { name: "Schools", desc: "K-12 educational institutions", icon: "🏫" },
  { name: "Universities", desc: "Higher education campuses", icon: "🎓" },
  { name: "Corporate", desc: "Office buildings & campuses", icon: "🏢" },
  { name: "Shopping Centers", desc: "Retail & commercial spaces", icon: "🛒" },
  { name: "Smart Cities", desc: "Municipal infrastructure", icon: "🌆" },
  { name: "Government", desc: "Public facilities & services", icon: "🏛️" },
];

const roadmap = [
  { phase: "Phase 1", title: "Prototype", desc: "Working proof of concept with AI sorting", status: "complete" },
  { phase: "Phase 2", title: "Pilot Program", desc: "Deployment in partner institutions", status: "current" },
  { phase: "Phase 3", title: "Multi-Campus", desc: "Scale across multiple locations", status: "upcoming" },
  { phase: "Phase 4", title: "Smart City", desc: "Municipal-level integration", status: "upcoming" },
  { phase: "Phase 5", title: "National Network", desc: "Environmental Intelligence Network", status: "upcoming" },
];

const whyReasons = [
  { title: "AI Driven", desc: "State-of-the-art machine learning for accurate waste classification" },
  { title: "Hardware + Software", desc: "Complete integration from sensors to cloud dashboard" },
  { title: "Real-Time Analytics", desc: "Instant environmental impact measurement and reporting" },
  { title: "Environmental Intelligence", desc: "Transform waste data into actionable sustainability insights" },
  { title: "Scalable Platform", desc: "From single unit to city-wide deployment architecture" },
];

const partners = [
  { name: "Government", icon: "🏛️" },
  { name: "Universities", icon: "🎓" },
  { name: "Businesses", icon: "💼" },
  { name: "Environmental Orgs", icon: "🌍" },
];

export default function DeploymentRoadmapSection() {
  const deployRef = useRef(null);
  const roadmapRef = useRef(null);
  const whyRef = useRef(null);
  const ctaRef = useRef(null);
  const deployInView = useInView(deployRef, { once: true, margin: "-100px" });
  const roadmapInView = useInView(roadmapRef, { once: true, margin: "-100px" });
  const whyInView = useInView(whyRef, { once: true, margin: "-100px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  return (
    <>
      {/* Deployment Opportunities */}
      <section className="py-24 md:py-32 bg-white" ref={deployRef}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={deployInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block font-inter text-sm font-medium text-[#12B76A] bg-[#12B76A]/10 px-4 py-1.5 rounded-full mb-4">
              Deployment
            </span>
            <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-[#111827] mt-4">
              Deploy <span className="gradient-text">Everywhere</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {deployments.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                animate={deployInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-6 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="font-sora font-bold text-[#111827]">{item.name}</h3>
                <p className="font-inter text-xs text-gray-500 mt-1">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={deployInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className="mt-12 rounded-3xl overflow-hidden"
          >
            <img
              src="https://mgx-backend-cdn.metadl.com/generate/images/1297646/2026-05-30/ptauu2iaahbq/deployment-smart-city-future.png"
              alt="Smart City Deployment"
              className="w-full h-48 md:h-64 object-cover rounded-3xl"
            />
          </motion.div>
        </div>
      </section>

      {/* Future Roadmap */}
      <section className="py-24 md:py-32 bg-[#0B3D2E] relative overflow-hidden" ref={roadmapRef}>
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#12B76A]/20 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={roadmapInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block font-inter text-sm font-medium text-[#00D4FF] bg-[#00D4FF]/10 px-4 py-1.5 rounded-full mb-4">
              Roadmap
            </span>
            <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-white mt-4">
              Future <span className="text-[#12B76A]">Vision</span>
            </h2>
          </motion.div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-[#12B76A]/20 transform md:-translate-x-1/2" />

            <div className="space-y-8">
              {roadmap.map((item, i) => (
                <motion.div
                  key={item.phase}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                  animate={roadmapInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className={`relative flex items-center gap-6 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} flex-row`}
                >
                  <div className="hidden md:block flex-1" />
                  <div className="relative z-10 flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      item.status === "complete" ? "bg-[#12B76A] border-[#12B76A]" :
                      item.status === "current" ? "bg-[#00D4FF] border-[#00D4FF] animate-pulse" :
                      "bg-transparent border-white/30"
                    }`}>
                      {item.status === "complete" && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="font-space text-xs text-[#00D4FF] mb-1">{item.phase}</div>
                    <h3 className="font-sora font-bold text-white">{item.title}</h3>
                    <p className="font-inter text-sm text-white/50 mt-1">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why GreenGuard */}
      <section className="py-24 md:py-32 bg-white" ref={whyRef}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={whyInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block font-inter text-sm font-medium text-[#12B76A] bg-[#12B76A]/10 px-4 py-1.5 rounded-full mb-4">
              Why Choose Us
            </span>
            <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-[#111827] mt-4">
              Why <span className="gradient-text">GreenGuard</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyReasons.map((reason, i) => (
              <motion.div
                key={reason.title}
                initial={{ opacity: 0, y: 20 }}
                animate={whyInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0B3D2E] to-[#12B76A] flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-sora font-bold text-[#111827] mb-2">{reason.title}</h3>
                <p className="font-inter text-sm text-gray-500 leading-relaxed">{reason.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Partners */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={whyInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-20 text-center"
          >
            <h3 className="font-sora font-bold text-xl text-[#111827] mb-8">Partners & Future Opportunities</h3>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {partners.map((partner) => (
                <div key={partner.name} className="flex items-center gap-3 bg-[#F8FAFC] border border-gray-100 rounded-full px-6 py-3">
                  <span className="text-2xl">{partner.icon}</span>
                  <span className="font-inter font-medium text-[#111827]">{partner.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 bg-[#0B3D2E] relative overflow-hidden" ref={ctaRef} id="contact">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#12B76A]/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00D4FF]/10 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <h2 className="font-sora font-extrabold text-3xl md:text-5xl text-white">
              Ready to Build Smarter{" "}
              <span className="text-[#12B76A]">Recycling Systems?</span>
            </h2>
            <p className="font-inter text-lg text-white/60 mt-6 max-w-xl mx-auto">
              Join us in transforming waste management through AI-powered environmental intelligence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <button className="font-inter font-semibold bg-[#12B76A] text-white px-8 py-4 rounded-full hover:bg-[#12B76A]/90 transition-all shadow-xl shadow-[#12B76A]/30 hover:-translate-y-0.5">
                Request Demo
              </button>
              <button className="font-inter font-medium text-white border border-white/30 px-8 py-4 rounded-full hover:bg-white/10 transition-all">
                Contact Team
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#071f17] py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-sora font-bold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                {["About", "Team", "Careers", "Press"].map((item) => (
                  <li key={item}>
                    <a href="#" className="font-inter text-sm text-white/50 hover:text-white/80 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-sora font-bold text-white mb-4">Technology</h4>
              <ul className="space-y-2">
                {["Platform", "AI Engine", "Edge Computing", "Dashboard"].map((item) => (
                  <li key={item}>
                    <a href="#" className="font-inter text-sm text-white/50 hover:text-white/80 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-sora font-bold text-white mb-4">Resources</h4>
              <ul className="space-y-2">
                {["Documentation", "Research", "Blog", "Support"].map((item) => (
                  <li key={item}>
                    <a href="#" className="font-inter text-sm text-white/50 hover:text-white/80 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-sora font-bold text-white mb-4">Contact</h4>
              <ul className="space-y-2">
                {["Email", "LinkedIn", "Twitter", "GitHub"].map((item) => (
                  <li key={item}>
                    <a href="#" className="font-inter text-sm text-white/50 hover:text-white/80 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="font-schibsted font-bold text-white">GreenGuard</div>
            <p className="font-inter text-sm text-white/40">© 2025 GreenGuard. All rights reserved. Environmental Intelligence Platform.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
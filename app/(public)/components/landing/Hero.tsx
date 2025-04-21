"use client";
import { motion } from "framer-motion";
import Link from "next/link";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center text-white px-4 overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster="/videos/trucks-background.mp4"
        >
          <source src="/videos/trucks-background.mp4" type="video/mp4" />
        </video>
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-gray-800/90 to-blue-900/90 opacity-50" />
      </div>

      <div className="relative z-20 max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="mb-8"
        >
          <h2 className="text-lg md:text-xl font-semibold text-blue-200 mb-4">
            COMPLETE FLEET COMPLIANCE SOLUTION
          </h2>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Streamline Your Fleet's <br />
            Compliance & Safety
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto mb-6">
            All-in-one platform for document tracking, MVR retrieval,
            Clearinghouse management, and driver onboarding
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm md:text-base text-blue-200">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Document Expiration Tracking
            </div>
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Automated MVR Retrieval
            </div>
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Clearinghouse Integration
            </div>
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Digital Driver Onboarding
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col md:flex-row gap-6 justify-center items-center"
        >
          <button
            onClick={() => {
              document.getElementById("contact")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="w-full md:w-auto bg-white text-blue-900 px-10 py-4 rounded-full font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center group"
          >
            <span>Start Free Trial</span>
            <svg
              className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
          <Link href="/sign-in">
            <button className="w-full md:w-auto bg-transparent border-2 border-white px-10 py-4 rounded-full font-semibold hover:bg-white hover:text-blue-900 transition-all flex items-center justify-center">
              <span>Login</span>
            </button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
        >
          {[
            ["500+", "Fleet Partners"],
            ["99.9%", "Compliance Rate"],
            ["10M+", "Miles Tracked"],
            ["98%", "Satisfaction"],
          ].map(([stat, label]) => (
            <div key={label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold">{stat}</div>
              <div className="text-sm text-blue-200">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;

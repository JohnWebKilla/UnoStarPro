"use client";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useState } from "react";

const Video = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="py-20 bg-gray-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-white mb-4">
            See Our Platform in Action
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Watch how UnoStarPro revolutionizes fleet management and FMCSA
            compliance
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl"
        >
          {!isPlaying ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors group"
                onClick={() => setIsPlaying(true)}
              >
                <Play className="h-8 w-8 text-blue-600 group-hover:scale-110 transition-transform" />
              </div>
              <img
                src="/video-thumbnail.jpg"
                alt="Video thumbnail"
                className="absolute inset-0 w-full h-full object-cover -z-10"
              />
            </div>
          ) : (
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1"
              title="UnoStarPro Platform Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0"
            />
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {[
            {
              title: "Easy Integration",
              description:
                "Seamlessly connects with your existing fleet systems",
            },
            {
              title: "Real-time Monitoring",
              description: "Track compliance and performance in real-time",
            },
            {
              title: "24/7 Support",
              description: "Expert assistance whenever you need it",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Video;

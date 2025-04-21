"use client";
import React from "react";
import { motion } from "framer-motion";
import {
  Truck,
  Shield,
  BarChart,
  Clock,
  FileCheck,
  Settings,
  LucideIcon,
} from "lucide-react";

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
}

const features: Feature[] = [
  {
    title: "Real-time Tracking",
    description:
      "Monitor your fleet's location and status in real-time with advanced GPS tracking.",
    icon: Truck,
    color: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    title: "Compliance Management",
    description:
      "Stay compliant with FMCSA regulations and maintain electronic records.",
    icon: Shield,
    color: "bg-green-50",
    iconColor: "text-green-600",
  },
  {
    title: "Performance Analytics",
    description:
      "Analyze fleet performance metrics and optimize operations efficiency.",
    icon: BarChart,
    color: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    title: "24/7 Support",
    description:
      "Round-the-clock expert assistance for all your fleet management needs.",
    icon: Clock,
    color: "bg-red-50",
    iconColor: "text-red-600",
  },
  {
    title: "Automated Reporting",
    description:
      "Generate comprehensive reports automatically for better decision making.",
    icon: FileCheck,
    color: "bg-yellow-50",
    iconColor: "text-yellow-600",
  },
  {
    title: "Custom Integration",
    description:
      "Seamless integration with your existing fleet management systems and tools.",
    icon: Settings,
    color: "bg-indigo-50",
    iconColor: "text-indigo-600",
  },
];

export default function Features(): JSX.Element {
  return (
    <section className="py-24 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-4xl font-bold mb-4 text-white"
          >
            Comprehensive Fleet Solutions
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-300 max-w-2xl mx-auto"
          >
            Everything you need to manage your fleet efficiently and stay
            compliant with regulations
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group relative p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
              <div
                className={`${feature.color} p-4 rounded-xl w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
              >
                <feature.icon className={`h-8 w-8 ${feature.iconColor}`} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">
                {feature.title}
              </h3>
              <p className="text-gray-300 leading-relaxed">
                {feature.description}
              </p>
              <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 w-0 group-hover:w-full transition-all duration-300" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

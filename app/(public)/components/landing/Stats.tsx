"use client";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useState, useEffect } from "react";
import { TrendingUp, Shield, Truck, Award } from "lucide-react";

const stats = [
  {
    label: "Fleet Partners",
    value: 500,
    suffix: "+",
    icon: Truck,
    description: "Active fleets using our platform",
    color: "bg-blue-500",
  },
  {
    label: "Compliance Rate",
    value: 99.9,
    suffix: "%",
    icon: Shield,
    description: "Industry-leading compliance success",
    color: "bg-green-500",
  },
  {
    label: "Miles Tracked",
    value: 10,
    suffix: "M+",
    icon: TrendingUp,
    description: "Miles monitored in real-time",
    color: "bg-purple-500",
  },
  {
    label: "Customer Satisfaction",
    value: 98,
    suffix: "%",
    icon: Award,
    description: "Client satisfaction rating",
    color: "bg-orange-500",
  },
];

const Counter = ({ value, suffix }: { value: number; suffix: string }) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true });

  useEffect(() => {
    if (inView) {
      const duration = 2000;
      const steps = 60;
      const stepValue = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += stepValue;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(current);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [inView, value]);

  return (
    <span
      ref={ref}
      className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800"
    >
      {count.toFixed(value % 1 === 0 ? 0 : 1)}
      {suffix}
    </span>
  );
};

const Stats = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-blue-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234a90e2' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Driving Success Through Numbers
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our platform has helped countless fleet companies achieve
            exceptional results in compliance, efficiency, and safety.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow group"
            >
              <div
                className={`absolute top-0 left-0 w-full h-1 ${stat.color} rounded-t-2xl transform origin-left transition-transform group-hover:scale-x-100`}
              />
              <div
                className={`inline-flex items-center justify-center p-3 ${stat.color} bg-opacity-10 rounded-xl mb-4`}
              >
                <stat.icon
                  className={`h-6 w-6 ${stat.color.replace("bg-", "text-")}`}
                />
              </div>
              <div className="mb-2">
                <Counter value={stat.value} suffix={stat.suffix} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {stat.label}
              </h3>
              <p className="text-sm text-gray-600">{stat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;

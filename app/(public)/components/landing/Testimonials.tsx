"use client";
import { motion } from "framer-motion";
import Image from "next/image";

const testimonials = [
  {
    name: "John Smith",
    role: "Fleet Manager, TransCargo Ltd",
    image: "/testimonials/person1.jpg",
    content:
      "This platform has revolutionized how we manage our fleet compliance. The real-time monitoring and instant alerts have saved us countless hours and potential violations.",
  },
  {
    name: "Sarah Johnson",
    role: "Safety Director, LogiTech Solutions",
    image: "/testimonials/person2.jpg",
    content:
      "The ELD monitoring system is incredibly user-friendly and reliable. It has helped us maintain a perfect compliance record for over two years.",
  },
  {
    name: "Michael Chen",
    role: "Operations Manager, Global Transit",
    image: "/testimonials/person3.jpg",
    content:
      "Outstanding support team and comprehensive compliance solutions. They truly understand the challenges of fleet management and provide excellent solutions.",
  },
];

const Testimonials = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Clients Say
          </h2>
          <p className="text-xl text-gray-600">
            Trusted by leading transportation companies
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow relative"
            >
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-4 border-white shadow-md">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="pt-8">
                <p className="text-gray-600 mb-6 italic">
                  "{testimonial.content}"
                </p>
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="font-semibold text-gray-900">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;


import React from 'react';
import { motion } from 'framer-motion';
import { paragraphs } from '@/data/paragraphs';

export const AboutSection = () => {

  return (
    <section id="about" className="min-h-screen py-20">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16 animate-on-scroll"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-5xl font-bold gradient-text mb-6">About Me</h2>
          <div className="w-24 h-1 gradient-background mx-auto rounded"></div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            className="animate-on-scroll"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="glass-card space-y-6">
              <h3 className="text-3xl gradient-text font-bold mb-4">{paragraphs.about.title}</h3>
              <p className="text-lg leading-relaxed">{paragraphs.about.description}</p>
              <p className="text-lg leading-relaxed">{paragraphs.about.additionalInfo}</p>
              <div className="flex flex-wrap gap-3 pt-4">
                {paragraphs.about.skills.map((skill, index) => (
                  <motion.span
                    key={skill}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="px-4 py-2 glow-button rounded-full text-sm font-medium backdrop-blur-sm"
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="animate-on-scroll"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="glass-card">
              <div className="relative">
                <div className="w-full h-80 bg-gradient-to-br from-purple-200/20 to-pink-400/20 rounded-lg flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
                    className="w-32 h-32 border-4 border-gradient rounded-full flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="w-20 h-20 gradient-background rounded-full flex items-center justify-center font-bold text-2xl"
                    >
                      JS
                    </motion.div>
                  </motion.div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-lg"></div>
                <div className="absolute bottom-4 left-4">
                  <h4 className="text-xl font-bold">Always Learning</h4>
                  <p>Exploring new technologies daily</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

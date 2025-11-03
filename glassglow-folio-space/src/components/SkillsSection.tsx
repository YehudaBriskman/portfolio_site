
import React from 'react';
import { motion } from 'framer-motion';
import { skillCategories } from '@/data/skils';
import { paragraphs } from '@/data/paragraphs';

export const SkillsSection = () => {
  return (
    <section id="skills" className="min-h-screen py-20">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16 animate-on-scroll"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-5xl font-bold gradient-text mb-6">Skills & Expertise</h2>
          <div className="w-24 h-1 gradient-background mx-auto rounded"></div>
          <p className="text-xl mt-6 max-w-2xl mx-auto">{paragraphs.skills.description}</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {skillCategories.map((category, categoryIndex) => (
            <motion.div
              key={category.title}
              className="glass-card animate-on-scroll"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: categoryIndex * 0.2 }}
            >
              <h3 className="text-2xl font-bold gradient-text mb-6 text-center">
                {category.title}
              </h3>
              <div className="space-y-6">
                {category.skills.map((skill, skillIndex) => (
                  <div key={skill.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className=" font-medium">{skill.name}</span>
                      <span className=" text-sm font-bold">{skill.level}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full gradient-background rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${skill.level}%` }}
                        viewport={{ once: true }}
                        transition={{ 
                          duration: 1.5, 
                          delay: categoryIndex * 0.2 + skillIndex * 0.1 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Interactive skill visualization */}
        <motion.div
          className="mt-16 glass-card animate-on-scroll"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <h3 className="text-3xl font-bold mb-8 text-center">
            Technologies I Love Working With
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[
              '⚛️', '🔥', '🎨', '📱', '☁️', '🐍',
              '🚀', '💻', '🎭', '🔧', '📊', '🌟'
            ].map((icon, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-center w-16 h-16 glass rounded-xl cursor-pointer group"
                whileHover={{ scale: 1.1, rotate: 10 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <span className="text-3xl group-hover:scale-125 transition-transform duration-300">
                  {icon}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

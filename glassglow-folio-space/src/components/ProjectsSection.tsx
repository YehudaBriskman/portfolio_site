// src/sections/ProjectsSection.tsx
import React from "react";
import { motion } from "framer-motion";
import { projects } from "@/data/projects";
import { paragraphs } from "@/data/paragraphs";
import { LazyApiImage } from "@/components/LazyApiImage";

const apiImageUrl = (imageId: string) =>
  // Example endpoints — pick ONE and implement on your server:
  // `/api/images/${encodeURIComponent(imageId)}`
  // or `/api/assets/project-image?name=${encodeURIComponent(imageId)}`
  `/api/images/${encodeURIComponent(imageId)}`;

export const ProjectsSection: React.FC = () => {
  return (
    <section id="projects" className="min-h-screen py-20">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16 animate-on-scroll"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-5xl font-bold gradient-text mb-6">
            Featured Projects
          </h2>
          <div className="w-24 h-1 gradient-background mx-auto rounded" />
          <p className="text-xl mt-6 max-w-2xl mx-auto">
            {paragraphs.projects.description}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {projects.map((project, index) => (
            <motion.div
              key={project.title}
              className="glass-card group cursor-pointer animate-on-scroll"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, rotateY: 5 }}
            >
              <div className="relative overflow-hidden rounded-lg mb-6 h-48">
                <LazyApiImage
                  apiSrc={apiImageUrl(project.image)}
                  alt={project.title}
                  className="w-full h-48"
                  // if you need auth headers / cookies:
                  requestInit={{
                    // credentials: "include",
                    // headers: { Authorization: `Bearer ${token}` },
                  }}
                  // Optional custom fallback
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-white/10 text-sm">
                      loading image…
                    </div>
                  }
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex space-x-3">
                    <button
                      title="Open project"
                      className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(project.link, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </button>
                    <button
                      title="Open GitHub"
                      className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (project.github) {
                          window.open(project.github, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-bold group-hover:gradient-text transition-all duration-300">
                  {project.title}
                </h3>
                <p className="leading-relaxed">{project.description}</p>
                <div className="flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 text-xs font-medium glow-button rounded-full text-secondary"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

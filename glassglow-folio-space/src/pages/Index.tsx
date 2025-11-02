
import React, { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { ThreeScene } from '../components/ThreeScene';
import { Navigation } from '../components/Navigation';
import { HeroSection } from '../components/HeroSection';
import { AboutSection } from '../components/AboutSection';
import { ProjectsSection } from '../components/ProjectsSection';
import { SkillsSection } from '../components/SkillsSection';
import { ContactSection } from '../components/ContactSection';
import { ThemeToggle } from '../components/ThemeToggle';
import { ParticleSystem } from '../components/ParticleSystem';

const Index = () => {
  const [darkMode, setDarkMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Scroll animation observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-x-hidden">
  
      {/* Particle System */}
      <ParticleSystem />
      
      {/* Fixed 3D Scene */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <ambientLight intensity={darkMode ? 0.3 : 0.5} />
          <pointLight position={[10, 10, 10]} intensity={darkMode ? 0.8 : 1.2} />
          <Stars 
            radius={300} 
            depth={60} 
            count={darkMode ? 1000 : 500} 
            factor={7} 
            saturation={0} 
            fade={true}
          />
          <ThreeScene darkMode={darkMode} />
          <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            autoRotate 
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>

      {/* Navigation - Left Side Full Height */}
      <Navigation darkMode={darkMode} />
      
      {/* Theme Toggle */}
      <ThemeToggle darkMode={darkMode} toggleTheme={toggleTheme} />

      {/* Main Content with left margin for desktop navbar */}
      <div className="relative z-10 ml-0 md:ml-28">
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <SkillsSection />
        <ContactSection />
      </div>
    </div>
  );
};

export default Index;


import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Navigation } from '../components/Navigation';
import { ThemeToggle } from '../components/ThemeToggle';

// Lazy load heavy section components for better performance
const HeroSection = lazy(() => import('../components/HeroSection').then(m => ({ default: m.HeroSection })));
const AboutSection = lazy(() => import('../components/AboutSection').then(m => ({ default: m.AboutSection })));
const ProjectsSection = lazy(() => import('../components/ProjectsSection').then(m => ({ default: m.ProjectsSection })));
const SkillsSection = lazy(() => import('../components/SkillsSection').then(m => ({ default: m.SkillsSection })));
const ContactSection = lazy(() => import('../components/ContactSection').then(m => ({ default: m.ContactSection })));

// Minimal loading skeleton for sections
const SectionLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-slate-500 rounded-full animate-spin"></div>
  </div>
);

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
      {/* Navigation - Left Side Full Height */}
      <Navigation darkMode={darkMode} />
      
      {/* Theme Toggle */}
      <ThemeToggle darkMode={darkMode} toggleTheme={toggleTheme} />

      {/* Main Content with left margin for desktop navbar */}
      <div className="relative z-10 ml-0 md:ml-28">
        <Suspense fallback={<SectionLoader />}>
          <HeroSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <AboutSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <ProjectsSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <SkillsSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <ContactSection />
        </Suspense>
      </div>
    </div>
  );
};

export default Index;

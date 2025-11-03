
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { navigation } from '@/data/navigation';

interface NavigationProps {
  darkMode: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ darkMode }) => {
  const [activeSection, setActiveSection] = useState('hero');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Update active section based on scroll position
      const sections = navigation.sections
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = navigation.navItems;

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Navigation - Left Sidebar - Always Visible Full Height */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-28 z-50 glass-nav-vertical">
        <div className="flex flex-col items-center justify-center space-y-11 py-8 h-full w-full">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`relative p-3 text-sm font-medium transition-all duration-300 rounded-lg w-[100%] ${
                activeSection === item.id
                  ? darkMode 
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-cyan-800'
                  : darkMode
                    ? 'text-gray-300 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
              title={item.label}
            >
              <span className="sr-only md:not-sr-only">{item.label}</span>
              {activeSection === item.id && (
                <motion.div
                  layoutId="activeIndicator"
                  style={{opacity: 0.6, width: '100%'}}
                  className={`absolute inset-0 rounded-lg ${
                    darkMode 
                      ? 'bg-gradient-to-r from-purple-400 to-pink-400'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600'
                  }`}
                  transition={{ duration: 0.3 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile Menu Button */}
      <motion.button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={`md:hidden fixed top-6 left-6 z-50 glass w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </motion.button>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.nav
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3 }}
              className="fixed left-0 top-0 h-full w-80 glass p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col space-y-8 mt-16">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`text-left px-4 py-3 text-lg font-medium transition-all duration-300 rounded-lg ${
                      activeSection === item.id
                        ? darkMode
                          ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400'
                          : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-600'
                        : darkMode
                          ? 'text-gray-300 hover:text-white hover:bg-white/10'
                          : 'text-gray-300 hover:text-white hover:bg-gray-900/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

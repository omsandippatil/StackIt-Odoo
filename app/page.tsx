'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Sun, Moon, Users, MessageSquare, Trophy, BookOpen, ArrowRight, Star } from 'lucide-react';

const GettingStartedPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isToggling, setIsToggling] = useState(false);

  const lightTheme = {
    bg: 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50',
    cardBg: 'bg-white/70 backdrop-blur-lg',
    primary: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    secondary: 'bg-gradient-to-r from-purple-500 to-pink-500',
    accent: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    text: 'text-slate-800',
    textSecondary: 'text-slate-600',
    border: 'border-white/20',
    shadow: 'shadow-lg shadow-blue-500/10',
    headerBg: 'bg-white/80 backdrop-blur-md',
    footerBg: 'bg-white/60 backdrop-blur-md'
  };

  const darkTheme = {
    bg: 'bg-gradient-to-br from-black via-gray-900 to-slate-900',
    cardBg: 'bg-gray-900/80 backdrop-blur-lg border-gray-700/50',
    primary: 'bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600',
    secondary: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600',
    accent: 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500',
    text: 'text-white',
    textSecondary: 'text-gray-300',
    border: 'border-gray-700/50',
    shadow: 'shadow-2xl shadow-purple-500/20',
    headerBg: 'bg-black/80 backdrop-blur-md border-gray-800/50',
    footerBg: 'bg-black/60 backdrop-blur-md border-gray-800/50'
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  const steps = [
    {
      title: "Welcome to StackIt",
      subtitle: "Your knowledge sharing community",
      description: "Join thousands of developers sharing knowledge, asking questions, and building together.",
      icon: <Users className="w-8 h-8 sm:w-10 md:w-12" />,
      features: ["Ask questions", "Share knowledge", "Connect with experts"],
      gradient: isDarkMode ? "from-cyan-400 to-blue-500" : "from-blue-500 to-indigo-600"
    },
    {
      title: "Ask Questions",
      subtitle: "Get answers from the community",
      description: "Stuck on a problem? Ask detailed questions and get help from experienced developers.",
      icon: <MessageSquare className="w-8 h-8 sm:w-10 md:w-12" />,
      features: ["Detailed explanations", "Code examples", "Best practices"],
      gradient: isDarkMode ? "from-purple-400 to-pink-500" : "from-purple-500 to-pink-500"
    },
    {
      title: "Share Knowledge",
      subtitle: "Help others grow",
      description: "Answer questions, share tutorials, and contribute to the community's collective knowledge.",
      icon: <BookOpen className="w-8 h-8 sm:w-10 md:w-12" />,
      features: ["Build reputation", "Help others", "Establish expertise"],
      gradient: isDarkMode ? "from-emerald-400 to-teal-500" : "from-emerald-500 to-teal-500"
    },
    {
      title: "Earn Recognition",
      subtitle: "Build your developer profile",
      description: "Get upvotes, badges, and recognition for your contributions to the community.",
      icon: <Trophy className="w-8 h-8 sm:w-10 md:w-12" />,
      features: ["Reputation system", "Achievement badges", "Leaderboards"],
      gradient: isDarkMode ? "from-yellow-400 to-orange-500" : "from-orange-500 to-red-500"
    }
  ];

  // Scroll animation hook
  const useScrollAnimation = (): [React.RefObject<HTMLDivElement | null>, boolean] => {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, amount: 0.3 });
    return [ref, isInView];
  };

  // Animation variants
  const slideInLeft = {
    hidden: { x: -100, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: ["easeOut"]
      }
    }
  };

  const slideInRight = {
    hidden: { x: 100, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: ["easeOut"]
      }
    }
  };

  const slideInUp = {
    hidden: { y: 100, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut" as const
      }
    }
  };

  const slideInDown = {
    hidden: { y: -100, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: ["easeOut"]
      }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1
      }
    }
  };

  const fadeInScale = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const handleThemeToggle = () => {
    setIsToggling(true);
    setTimeout(() => {
      setIsDarkMode(!isDarkMode);
    }, 300);
    setTimeout(() => {
      setIsToggling(false);
    }, 800);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  const cardVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.5,
        type: "spring" as const,
        stiffness: 100
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [steps.length]);

  // Get refs for scroll animations
  const [heroRef, heroInView] = useScrollAnimation();
  const [stepsRef, stepsInView] = useScrollAnimation();
  const [featuresRef, featuresInView] = useScrollAnimation();

  return (
    <div className={`min-h-screen ${theme.bg} transition-all duration-700 relative overflow-hidden`}>
      {/* Theme Toggle Overlay */}
      <AnimatePresence>
        {isToggling && (
          <motion.div
            className={`fixed inset-0 z-[100] ${isDarkMode ? 'bg-black' : 'bg-white'}`}
            initial={{ clipPath: 'circle(0% at 100% 0%)' }}
            animate={{ clipPath: 'circle(150% at 100% 0%)' }}
            exit={{ clipPath: 'circle(0% at 100% 0%)' }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header 
        className={`${theme.headerBg} ${theme.border} border-b sticky top-0 z-50`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-2 sm:space-x-3"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`w-8 h-8 sm:w-10 sm:h-10 ${theme.primary} rounded-lg flex items-center justify-center`}>
                <span className="font-bold text-sm sm:text-lg text-white">S</span>
              </div>
              <h1 className={`text-xl sm:text-2xl font-bold ${theme.text}`}>StackIt</h1>
            </motion.div>
            
            <motion.button
              onClick={handleThemeToggle}
              className={`p-2 rounded-full ${theme.cardBg} ${theme.border} border hover:scale-110 transition-all duration-300 ${theme.shadow}`}
              whileTap={{ scale: 0.9 }}
            >
              {isDarkMode ? 
                <Sun className={`w-4 h-4 sm:w-5 sm:h-5 ${theme.text}`} /> : 
                <Moon className={`w-4 h-4 sm:w-5 sm:h-5 ${theme.text}`} />
              }
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <motion.main 
        className="container mx-auto px-4 sm:px-6 py-8 sm:py-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Hero Section */}
        <motion.div 
          ref={heroRef}
          className="text-center mb-12 sm:mb-16"
          variants={staggerContainer}
          initial="hidden"
          animate={heroInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className={`text-3xl sm:text-4xl md:text-5xl font-bold ${theme.text} mb-4 sm:mb-6`}
          
          >
            Welcome to StackIt
          </motion.h2>
          <motion.p 
            className={`text-lg sm:text-xl ${theme.textSecondary} mb-6 sm:mb-8 max-w-2xl mx-auto px-4`}
            variants={slideInUp}
          >
            A modern platform for developers to ask questions, share knowledge, and grow together as a community.
          </motion.p>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center px-4"
          
          >
            <motion.button
              className={`${theme.primary} text-white px-6 sm:px-8 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:scale-105 transition-all duration-300 ${theme.shadow}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
            <motion.button
              className={`${theme.cardBg} ${theme.text} ${theme.border} border px-6 sm:px-8 py-3 rounded-lg font-semibold hover:scale-105 transition-all duration-300 ${theme.shadow}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Learn More
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Interactive Steps */}
        <motion.div 
          ref={stepsRef}
          className="max-w-4xl mx-auto mb-12 sm:mb-16"
         
          initial="hidden"
          animate={stepsInView ? "visible" : "hidden"}
        >
          <motion.div 
            className="flex justify-center mb-6 sm:mb-8 px-4"
            variants={itemVariants}
          >
            <div className="flex items-center overflow-x-auto pb-2">
              {steps.map((_, index) => (
                <div key={index} className="flex items-center flex-shrink-0">
                  <motion.button
                    onClick={() => setCurrentStep(index)}
                    className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      index === currentStep 
                        ? `bg-gradient-to-r ${steps[index].gradient}` 
                        : `${theme.cardBg} ${theme.border} border`
                    } ${theme.shadow}`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <span className={`font-bold text-xs sm:text-sm ${
                      index === currentStep ? 'text-white' : theme.text
                    }`}>
                      {index + 1}
                    </span>
                  </motion.button>
                  {index < steps.length - 1 && (
                    <div className={`w-8 sm:w-12 md:w-16 h-0.5 ${theme.border} border-t mx-1`} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className={`${theme.cardBg} ${theme.border} border rounded-xl p-6 sm:p-8 text-center ${theme.shadow}`}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <div className={`bg-gradient-to-r ${steps[currentStep].gradient} w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6`}>
                <div className="text-white">
                  {steps[currentStep].icon}
                </div>
              </div>
              
              <h3 className={`text-2xl sm:text-3xl font-bold ${theme.text} mb-2`}>
                {steps[currentStep].title}
              </h3>
              <p className={`text-base sm:text-lg ${theme.textSecondary} mb-3 sm:mb-4`}>
                {steps[currentStep].subtitle}
              </p>
              <p className={`${theme.textSecondary} mb-4 sm:mb-6 max-w-2xl mx-auto text-sm sm:text-base`}>
                {steps[currentStep].description}
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6">
                {steps[currentStep].features.map((feature, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center justify-center sm:justify-start gap-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Star className={`w-4 h-4 bg-gradient-to-r ${steps[currentStep].gradient} bg-clip-text text-transparent`} />
                    <span className={`${theme.text} font-medium text-sm sm:text-base`}>{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          ref={featuresRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto px-4"
          variants={staggerContainer}
          initial="hidden"
          animate={featuresInView ? "visible" : "hidden"}
        >
          {[
            {
              icon: <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8" />,
              title: "Smart Q&A",
              description: "Advanced question matching and intelligent answers",
              gradient: isDarkMode ? "from-blue-400 to-purple-500" : "from-blue-500 to-purple-600",
              direction: slideInLeft
            },
            {
              icon: <Users className="w-6 h-6 sm:w-8 sm:h-8" />,
              title: "Expert Community",
              description: "Connect with industry professionals and mentors",
              gradient: isDarkMode ? "from-green-400 to-teal-500" : "from-green-500 to-teal-600",
              direction: slideInUp
            },
            {
              icon: <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />,
              title: "Gamification",
              description: "Earn points, badges, and climb the leaderboard",
              gradient: isDarkMode ? "from-yellow-400 to-orange-500" : "from-orange-500 to-red-500",
              direction: slideInRight
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              className={`${theme.cardBg} ${theme.border} border rounded-xl p-4 sm:p-6 hover:scale-105 transition-all duration-300 ${theme.shadow}`}
             
              whileHover={{ y: -5 }}
            >
              <div className={`bg-gradient-to-r ${feature.gradient} w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center mb-3 sm:mb-4`}>
                <div className="text-white">
                  {feature.icon}
                </div>
              </div>
              <h4 className={`text-lg sm:text-xl font-bold ${theme.text} mb-2`}>
                {feature.title}
              </h4>
              <p className={`${theme.textSecondary} text-sm sm:text-base`}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.main>

      {/* Footer */}
      <motion.footer 
        className={`${theme.footerBg} ${theme.border} border-t mt-12 sm:mt-16 py-6 sm:py-8`}
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <p className={`${theme.textSecondary} text-sm sm:text-base`}>
            © 2025 StackIt. Built with ❤️ for developers, by developers.
          </p>
        </div>
      </motion.footer>
    </div>
  );
};

export default GettingStartedPage;
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUp, ArrowRight, ArrowLeft, ArrowDown, RotateCcw, ChevronUp, ChevronDown, MapPin, Flag, CornerUpLeft, CornerUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore, RouteStep } from '@/store/app-store';
import { useState } from 'react';

// Get maneuver icon based on instruction or maneuver type
function getManeuverIcon(maneuver: string, instruction?: string) {
  const maneuverLower = maneuver.toLowerCase();
  const instructionText = (instruction || '').toLowerCase();
  
  // Check for U-turn
  if (maneuverLower.includes('uturn') || instructionText.includes('กลับรถ')) {
    return <RotateCcw className="w-8 h-8" />;
  }
  
  // Check for sharp/slight left turns
  if (maneuverLower.includes('sharp left') || instructionText.includes('ซ้ายแฉก')) {
    return <CornerUpLeft className="w-8 h-8" />;
  }
  
  // Check for sharp/slight right turns
  if (maneuverLower.includes('sharp right') || instructionText.includes('ขวาแฉก')) {
    return <CornerUpRight className="w-8 h-8" />;
  }
  
  // Check for left turns (including Thai text)
  if (maneuverLower.includes('left') || instructionText.includes('ซ้าย')) {
    return <ArrowLeft className="w-8 h-8" />;
  }
  
  // Check for right turns (including Thai text)
  if (maneuverLower.includes('right') || instructionText.includes('ขวา')) {
    return <ArrowRight className="w-8 h-8" />;
  }
  
  // Check for straight/continue
  if (maneuverLower.includes('straight') || maneuverLower.includes('continue') || 
      instructionText.includes('ตรง') || instructionText.includes('ไปตรง')) {
    return <ArrowUp className="w-8 h-8" />;
  }
  
  // Check for arrive
  if (maneuverLower.includes('arrive') || instructionText.includes('ถึงปลายทาง')) {
    return <Flag className="w-8 h-8" />;
  }
  
  // Check for depart
  if (maneuverLower.includes('depart') || instructionText.includes('เริ่มต้น')) {
    return <MapPin className="w-8 h-8" />;
  }
  
  // Check for roundabout
  if (maneuverLower.includes('roundabout') || instructionText.includes('วงเวียน')) {
    return <RotateCcw className="w-8 h-8" />;
  }
  
  // Default - go straight
  return <ArrowUp className="w-8 h-8" />;
}

export default function NavigationPanel() {
  const { isNavigating, routeInfo, navigationTarget, stopNavigation, currentStepIndex, setCurrentStepIndex } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isNavigating || !routeInfo) return null;

  const currentStep = routeInfo.steps[currentStepIndex];
  const nextStep = routeInfo.steps[currentStepIndex + 1];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-40"
      >
        {/* Main navigation bar */}
        <div className="bg-white shadow-2xl border-t border-gray-200">
          {/* Current step - Always visible */}
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* Maneuver icon */}
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
                {currentStep && getManeuverIcon(currentStep.maneuver, currentStep.instruction)}
              </div>
              
              {/* Instruction */}
              <div className="flex-1 min-w-0">
                {currentStep && (
                  <>
                    <p className="text-lg font-bold text-gray-800 truncate">
                      {currentStep.instruction}
                    </p>
                    <p className="text-sm text-gray-500">
                      {currentStep.distance} • {currentStep.duration}
                    </p>
                  </>
                )}
              </div>
              
              {/* Distance */}
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-blue-600">{currentStep?.distance}</p>
              </div>
              
              {/* Expand/Collapse button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
              </button>
            </div>
            
            {/* Next step preview */}
            {nextStep && !isExpanded && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">
                  {getManeuverIcon(nextStep.maneuver, nextStep.instruction)}
                </div>
                <p className="text-sm text-gray-600 flex-1 truncate">{nextStep.instruction}</p>
                <span className="text-sm text-gray-400">{nextStep.distance}</span>
              </div>
            )}
          </div>
          
          {/* Expanded steps list */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden border-t border-gray-100"
              >
                <div className="max-h-60 overflow-y-auto">
                  {routeInfo.steps.map((step, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStepIndex(index)}
                      className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                        index === currentStepIndex ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      } ${index < currentStepIndex ? 'opacity-50' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        index === currentStepIndex ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {getManeuverIcon(step.maneuver, step.instruction)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-medium ${index === currentStepIndex ? 'text-blue-800' : 'text-gray-700'}`}>
                          {step.instruction}
                        </p>
                        <p className="text-sm text-gray-500">{step.distance} • {step.duration}</p>
                      </div>
                      {index === currentStepIndex && (
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Bottom bar */}
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">ไป</span>
              <span className="font-bold text-gray-800">{navigationTarget?.name}</span>
              <span className="text-gray-400">•</span>
              <span className="text-blue-600 font-medium">{routeInfo.distance}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{routeInfo.duration}</span>
            </div>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={stopNavigation}
              className="bg-red-500 hover:bg-red-600"
            >
              <X className="w-4 h-4 mr-1" />
              สิ้นสุด
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PerformanceMetrics {
  renderTime: number;
  lastRenderTime: number;
  averageRenderTime: number;
  renderCount: number;
  memoryUsage?: number;
  componentName: string;
}

export interface PerformanceConfig {
  enabled?: boolean;
  sampleRate?: number; // 0-1, fraction of renders to measure
  warningThreshold?: number; // ms
  logToConsole?: boolean;
}

const DEFAULT_CONFIG: Required<PerformanceConfig> = {
  enabled: process.env.NODE_ENV === 'development',
  sampleRate: 0.1, // Measure 10% of renders
  warningThreshold: 16, // 60fps = 16.67ms per frame
  logToConsole: false,
};

/**
 * Performance monitoring hook for React components
 * Tracks render times and provides optimization insights
 */
export function usePerformanceMonitor(
  componentName: string,
  config: PerformanceConfig = {}
): PerformanceMetrics {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const renderStartTime = useRef<number>(0);
  const renderTimes = useRef<number[]>([]);
  const renderCount = useRef<number>(0);
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    renderCount: 0,
    componentName,
  });

  // Start timing before render
  if (finalConfig.enabled && Math.random() < finalConfig.sampleRate) {
    renderStartTime.current = performance.now();
  }

  // Measure render completion
  useEffect(() => {
    if (!finalConfig.enabled || renderStartTime.current === 0) return;

    const renderTime = performance.now() - renderStartTime.current;
    renderCount.current += 1;
    renderTimes.current.push(renderTime);

    // Keep only last 100 render times for rolling average
    if (renderTimes.current.length > 100) {
      renderTimes.current = renderTimes.current.slice(-100);
    }

    const averageRenderTime = 
      renderTimes.current.reduce((sum, time) => sum + time, 0) / 
      renderTimes.current.length;

    const newMetrics: PerformanceMetrics = {
      renderTime,
      lastRenderTime: renderTime,
      averageRenderTime,
      renderCount: renderCount.current,
      componentName,
    };

    // Add memory usage if available
    if ('memory' in performance) {
      newMetrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    setMetrics(newMetrics);

    // Log performance warnings
    if (finalConfig.logToConsole && renderTime > finalConfig.warningThreshold) {
      console.warn(
        `Performance Warning: ${componentName} render took ${renderTime.toFixed(2)}ms ` +
        `(threshold: ${finalConfig.warningThreshold}ms)`
      );
    }

    // Reset timing
    renderStartTime.current = 0;
  });

  return metrics;
}

/**
 * Hook for measuring specific operations within a component
 */
export function useOperationTimer() {
  const measureOperation = useCallback(<T>(
    operationName: string,
    operation: () => T
  ): T => {
    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Operation "${operationName}" took ${(endTime - startTime).toFixed(2)}ms`);
    }
    
    return result;
  }, []);

  const measureAsyncOperation = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Async operation "${operationName}" took ${(endTime - startTime).toFixed(2)}ms`);
    }
    
    return result;
  }, []);

  return { measureOperation, measureAsyncOperation };
}

/**
 * Hook for monitoring scroll performance
 */
export function useScrollPerformance(elementRef: React.RefObject<HTMLElement | HTMLDivElement>) {
  const lastScrollTime = useRef<number>(0);
  const scrollTimes = useRef<number[]>([]);
  
  const [scrollMetrics, setScrollMetrics] = useState({
    averageScrollTime: 0,
    lastScrollTime: 0,
    scrollCount: 0,
    isScrolling: false,
  });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      const scrollTime = performance.now();
      const timeSinceLastScroll = scrollTime - lastScrollTime.current;
      
      if (lastScrollTime.current > 0) {
        scrollTimes.current.push(timeSinceLastScroll);
        
        // Keep only last 50 scroll measurements
        if (scrollTimes.current.length > 50) {
          scrollTimes.current = scrollTimes.current.slice(-50);
        }
        
        const averageScrollTime = 
          scrollTimes.current.reduce((sum, time) => sum + time, 0) / 
          scrollTimes.current.length;
        
        setScrollMetrics(prev => ({
          averageScrollTime,
          lastScrollTime: timeSinceLastScroll,
          scrollCount: prev.scrollCount + 1,
          isScrolling: true,
        }));
      }
      
      lastScrollTime.current = scrollTime;
      
      // Clear scrolling state after inactivity
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setScrollMetrics(prev => ({ ...prev, isScrolling: false }));
      }, 150);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [elementRef]);

  return scrollMetrics;
} 
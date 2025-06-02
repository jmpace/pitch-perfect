'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { TimelineEvent } from '@/lib/timeline-types';

interface SlideThumbnailProps {
  event: TimelineEvent;
  size?: 'small' | 'medium' | 'large';
  orientation?: 'horizontal' | 'vertical';
  showSlideNumber?: boolean;
  showTimestamp?: boolean;
  isActive?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  isLoading?: boolean;
  onClick?: (event: TimelineEvent) => void;
  className?: string;
}

const THUMBNAIL_SIZES = {
  small: {
    horizontal: { width: 64, height: 48 }, // w-16 h-12
    vertical: { width: 48, height: 36 }    // w-12 h-9
  },
  medium: {
    horizontal: { width: 96, height: 72 }, // w-24 h-18
    vertical: { width: 72, height: 54 }    // w-18 h-[54px]
  },
  large: {
    horizontal: { width: 128, height: 96 }, // w-32 h-24
    vertical: { width: 96, height: 72 }     // w-24 h-18
  }
} as const;

export function SlideThumbnail({
  event,
  size = 'small',
  orientation = 'horizontal',
  showSlideNumber = true,
  showTimestamp = false,
  isActive = false,
  isSelected = false,
  isFocused = false,
  isLoading = false,
  onClick,
  className
}: SlideThumbnailProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Get thumbnail dimensions based on size and orientation
  const dimensions = THUMBNAIL_SIZES[size][orientation];
  
  // Format timestamp for display
  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle thumbnail click
  const handleClick = () => {
    if (onClick && !isLoading) {
      onClick(event);
    }
  };

  // Handle keyboard interactions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleClick();
    }
  };

  // Handle image load success
  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  // Handle image load error
  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  // Don't render if no slide data or thumbnail
  if (!event.slide?.thumbnail) {
    return null;
  }

  const { thumbnail, index } = event.slide;

  return (
    <div 
      className={cn(
        "relative group cursor-pointer transition-all duration-200",
        "bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden",
        "hover:scale-105 hover:shadow-lg",
        // State-based styling
        isSelected && "ring-2 ring-blue-500 shadow-lg scale-105 bg-blue-50 dark:bg-blue-950/20",
        isActive && !isSelected && "ring-2 ring-blue-400 shadow-md bg-blue-25 dark:bg-blue-950/10",
        isFocused && !isSelected && "ring-2 ring-purple-500 shadow-md bg-purple-25 dark:bg-purple-950/10",
        isLoading && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Slide ${index} at ${formatTimestamp(event.timestamp)}${isSelected ? ' (selected)' : ''}${isActive ? ' (current)' : ''}${isFocused ? ' (focused)' : ''}`}
      aria-pressed={isSelected}
    >
      {/* Loading state */}
      {(imageLoading || isLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {imageError && !imageLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          <div className="text-lg">🖼️</div>
          <div className="text-xs mt-1">Failed to load</div>
        </div>
      )}

      {/* Thumbnail image */}
      {!imageError && (
        <Image
          src={thumbnail.url}
          alt={`Slide ${index}`}
          width={dimensions.width}
          height={dimensions.height}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200",
            imageLoading && "opacity-0"
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
          priority={isActive || isSelected} // Prioritize loading for active/selected slides
          sizes={`${dimensions.width}px`}
        />
      )}

      {/* Slide number overlay */}
      {showSlideNumber && (
        <div className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent",
          isSelected && "from-blue-900/70"
        )}>
          <div className={cn(
            "text-white text-xs font-medium p-1 text-center",
            isSelected && "text-blue-100"
          )}>
            {index}
          </div>
        </div>
      )}

      {/* Timestamp overlay */}
      {showTimestamp && (
        <div className={cn(
          "absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent",
          isSelected && "from-blue-900/70"
        )}>
          <div className={cn(
            "text-white text-xs font-medium p-1 text-center",
            isSelected && "text-blue-100"
          )}>
            {formatTimestamp(event.timestamp)}
          </div>
        </div>
      )}

      {/* State indicators */}
      <div className="absolute top-1 right-1 flex space-x-1">
        {isSelected && (
          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-lg border border-white" />
        )}
        {isActive && !isSelected && (
          <div className="w-2 h-2 bg-blue-400 rounded-full shadow-lg border border-white" />
        )}
        {isFocused && !isSelected && !isActive && (
          <div className="w-2 h-2 bg-purple-500 rounded-full shadow-lg border border-white" />
        )}
      </div>

      {/* Hover overlay */}
      <div className={cn(
        "absolute inset-0 transition-colors duration-200",
        isSelected 
          ? "bg-blue-500/10" 
          : "bg-black/0 group-hover:bg-black/10"
      )} />

      {/* Selection border animation */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-lg animate-pulse" />
      )}
    </div>
  );
}

// Enhanced thumbnail grid component for displaying multiple thumbnails
interface SlideThumbnailGridProps {
  events: TimelineEvent[];
  activeEventId?: string;
  selectedEventId?: string;
  focusedEventId?: string;
  size?: SlideThumbnailProps['size'];
  orientation?: SlideThumbnailProps['orientation'];
  showSlideNumbers?: boolean;
  showTimestamps?: boolean;
  onThumbnailClick?: (event: TimelineEvent) => void;
  className?: string;
  maxItems?: number;
}

export function SlideThumbnailGrid({
  events,
  activeEventId,
  selectedEventId,
  focusedEventId,
  size = 'small',
  orientation = 'horizontal',
  showSlideNumbers = true,
  showTimestamps = false,
  onThumbnailClick,
  className,
  maxItems
}: SlideThumbnailGridProps) {
  // Filter events that have slide thumbnails
  const slideEvents = events.filter(event => event.slide?.thumbnail);
  
  // Limit items if maxItems is specified
  const displayEvents = maxItems ? slideEvents.slice(0, maxItems) : slideEvents;

  if (displayEvents.length === 0) {
    return (
      <div className={cn("text-center text-gray-500 dark:text-gray-400 py-4", className)}>
        No slide thumbnails available
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-2",
      orientation === 'horizontal' 
        ? "grid-flow-col auto-cols-max overflow-x-auto" 
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
      className
    )}>
      {displayEvents.map((event) => (
        <SlideThumbnail
          key={event.id}
          event={event}
          size={size}
          orientation={orientation}
          showSlideNumber={showSlideNumbers}
          showTimestamp={showTimestamps}
          isActive={event.id === activeEventId}
          isSelected={event.id === selectedEventId}
          isFocused={event.id === focusedEventId}
          onClick={onThumbnailClick}
        />
      ))}
      
      {/* Show more indicator if items were limited */}
      {maxItems && slideEvents.length > maxItems && (
        <div className={cn(
          "flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs",
          "bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"
        )}
        style={{
          width: THUMBNAIL_SIZES[size][orientation].width,
          height: THUMBNAIL_SIZES[size][orientation].height
        }}>
          +{slideEvents.length - maxItems} more
        </div>
      )}
    </div>
  );
} 
import React from 'react';
import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-[#1D1F26] animate-pulse rounded-2xl relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
    </div>
  );
}

export default function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center py-2">
        <SkeletonBlock className="h-8 w-1/3" />
        <div className="flex space-x-2">
          <SkeletonBlock className="h-8 w-8 rounded-full" />
          <SkeletonBlock className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Hero Card Skeleton */}
      <SkeletonBlock className="h-44 w-full" />

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SkeletonBlock className="h-24 rounded-2xl" />
        <SkeletonBlock className="h-24 rounded-2xl" />
        <SkeletonBlock className="h-24 rounded-2xl" />
        <SkeletonBlock className="h-24 rounded-2xl" />
      </div>

      {/* List Skeleton */}
      <div className="space-y-3">
        <SkeletonBlock className="h-12 w-1/4" />
        <SkeletonBlock className="h-16 w-full" />
        <SkeletonBlock className="h-16 w-full" />
      </div>
    </div>
  );
}

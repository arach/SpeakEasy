"use client"

import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudioWaveformPlayerProps {
  audioUrl: string
  className?: string
}

export default function AudioWaveformPlayer({ audioUrl, className = '' }: AudioWaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#e2e8f0',
      progressColor: '#10b981',
      cursorColor: '#6366f1',
      barWidth: 2,
      barRadius: 1,
      barGap: 1,
      height: 40,
      normalize: true,
      backend: 'WebAudio',
      responsive: true
    })

    wavesurferRef.current = wavesurfer

    // Load audio
    wavesurfer.load(audioUrl)

    // Event listeners
    wavesurfer.on('ready', () => {
      setIsLoading(false)
      setDuration(wavesurfer.getDuration())
    })

    wavesurfer.on('play', () => {
      setIsPlaying(true)
    })

    wavesurfer.on('pause', () => {
      setIsPlaying(false)
    })

    wavesurfer.on('finish', () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime())
    })

    wavesurfer.on('seek', () => {
      setCurrentTime(wavesurfer.getCurrentTime())
    })

    return () => {
      try {
        if (wavesurfer && typeof wavesurfer.destroy === 'function') {
          wavesurfer.destroy()
        }
      } catch (error) {
        // Ignore cleanup errors - component is unmounting anyway
        console.debug('WaveSurfer cleanup error (safe to ignore):', error)
      }
      wavesurferRef.current = null
    }
  }, [audioUrl])

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className={`bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/50 shadow-sm ${className}`}>
      {/* Controls and Waveform in one row */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          onClick={togglePlayPause}
          disabled={isLoading}
          size="sm"
          className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white p-0"
        >
          {isLoading ? (
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
          ) : (
            <Play className="w-3 h-3 sm:w-4 sm:h-4 ml-0.5" />
          )}
        </Button>
        
        {/* Waveform */}
        <div className="flex-1">
          <div 
            ref={containerRef} 
            className="w-full cursor-pointer rounded-lg overflow-hidden bg-slate-100/30"
            style={{ minHeight: '40px' }}
          />
          
          {isLoading && (
            <div className="flex items-center justify-center h-10 text-xs sm:text-sm text-slate-500">
              Loading waveform...
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-600 flex-shrink-0">
          <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
          <span className="font-medium">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
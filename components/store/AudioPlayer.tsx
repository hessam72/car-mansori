'use client'
import { useState, useRef, useEffect } from 'react'
import { HiVolumeUp, HiVolumeOff } from 'react-icons/hi'

export function AudioPlayer() {
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {
        // Auto-play blocked, will play on user interaction
      })
    }
  }, [])

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  return (
    <>
      <audio ref={audioRef} loop>
        <source src="/audio/background.mp3" type="audio/mpeg" />
      </audio>

      <button
        onClick={toggleMute}
        aria-pressed={!isMuted}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-md transition-colors duration-200 hover:border-white/30 hover:text-white"
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        {isMuted ? <HiVolumeOff size={18} /> : <HiVolumeUp size={18} />}
      </button>
    </>
  )
}

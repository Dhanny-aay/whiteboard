'use client'

import { useState, useEffect } from 'react'
import { supabase, getCurrentUser } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'
import Dashboard from '@/components/Dashboard'
import Whiteboard from '@/components/Whiteboard'

export default function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedWhiteboard, setSelectedWhiteboard] = useState(null)

  useEffect(() => {
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          setUser(session?.user || null)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setSelectedWhiteboard(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm onAuth={setUser} />
  }

  if (selectedWhiteboard) {
    return (
      <Whiteboard
        whiteboard={selectedWhiteboard}
        user={user}
        onBack={() => setSelectedWhiteboard(null)}
      />
    )
  }

  return (
    <Dashboard
      user={user}
      onSelectWhiteboard={setSelectedWhiteboard}
    />
  )
}
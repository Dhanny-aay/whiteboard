'use client'

import { useState, useEffect } from 'react'
import { supabase, signOut } from '@/lib/supabase'
import { Plus, Users, Calendar, LogOut } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

export default function Dashboard({ user, onSelectWhiteboard }) {
  const [whiteboards, setWhiteboards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState('')

  useEffect(() => {
    fetchWhiteboards()
  }, [user])

  const fetchWhiteboards = async () => {
    try {
      // Fetch whiteboards created by user
      const { data: ownedBoards, error: ownedError } = await supabase
        .from('whiteboards')
        .select('*')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false })

      if (ownedError) throw ownedError

      // Fetch whiteboards shared with user
      const { data: sharedBoards, error: sharedError } = await supabase
        .from('whiteboard_permissions')
        .select(`
          whiteboard_id,
          permission,
          whiteboards (
            id,
            title,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)

      if (sharedError) throw sharedError

      const allBoards = [
        ...ownedBoards.map(board => ({ ...board, isOwner: true })),
        ...sharedBoards.map(item => ({ 
          ...item.whiteboards, 
          isOwner: false, 
          permission: item.permission 
        }))
      ]

      setWhiteboards(allBoards)
    } catch (error) {
      console.error('Error fetching whiteboards:', error)
    } finally {
      setLoading(false)
    }
  }

  const createWhiteboard = async () => {
    if (!newBoardTitle.trim()) return

    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .insert([
          {
            id: uuidv4(),
            title: newBoardTitle,
            created_by: user.id,
          }
        ])
        .select()
        .single()

      if (error) throw error

      setWhiteboards(prev => [{ ...data, isOwner: true }, ...prev])
      setNewBoardTitle('')
      setShowCreateModal(false)
    } catch (error) {
      console.error('Error creating whiteboard:', error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Whiteboards</h1>
              <p className="text-gray-600">Welcome back, {user.email}</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Board</span>
              </button>
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900 flex items-center space-x-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {whiteboards.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No whiteboards yet</h3>
              <p className="text-gray-600 mb-4">Create your first whiteboard to get started</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Whiteboard
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whiteboards.map((board) => (
              <div
                key={board.id}
                onClick={() => onSelectWhiteboard(board)}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {board.title}
                    </h3>
                    <div className="flex items-center space-x-1">
                      {board.isOwner ? (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Owner
                        </span>
                      ) : (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {board.permission}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(board.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>Collaborative</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New Whiteboard</h2>
            <input
              type="text"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              placeholder="Enter whiteboard title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && createWhiteboard()}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createWhiteboard}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
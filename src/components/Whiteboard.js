'use client'

import { useState, useEffect, useRef } from 'react'
import { Stage, Layer, Line, Rect, Circle, Text } from 'react-konva'
import { supabase } from '@/lib/supabase'
import { 
  Pen, 
  Square, 
  Circle as CircleIcon, 
  Type, 
  Eraser, 
  Users, 
  ArrowLeft,
  Trash2,
  Share
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

const TOOLS = {
  PEN: 'pen',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TEXT: 'text',
  ERASER: 'eraser'
}

export default function Whiteboard({ whiteboard, user, onBack }) {
  const [tool, setTool] = useState(TOOLS.PEN)
  const [elements, setElements] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState([])
  const [activeUsers, setActiveUsers] = useState([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState('edit')
  
  const stageRef = useRef()
  const channelRef = useRef()

  useEffect(() => {
    loadElements()
    setupRealtimeSubscription()
    joinPresence()

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [whiteboard.id])

  const loadElements = async () => {
    try {
      const { data, error } = await supabase
        .from('whiteboard_elements')
        .select('*')
        .eq('whiteboard_id', whiteboard.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setElements(data || [])
    } catch (error) {
      console.error('Error loading elements:', error)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel(`whiteboard:${whiteboard.id}`)
    
    channel
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'whiteboard_elements',
          filter: `whiteboard_id=eq.${whiteboard.id}`
        }, 
        (payload) => {
          setElements(prev => [...prev, payload.new])
        }
      )
      .on('postgres_changes', 
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'whiteboard_elements',
          filter: `whiteboard_id=eq.${whiteboard.id}`
        }, 
        (payload) => {
          setElements(prev => prev.filter(el => el.id !== payload.old.id))
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flat()
        setActiveUsers(users)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setActiveUsers(prev => [...prev, ...newPresences])
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        setActiveUsers(prev => 
          prev.filter(user => !leftPresences.find(left => left.user_id === user.user_id))
        )
      })
      .subscribe()

    channelRef.current = channel
  }

  const joinPresence = async () => {
    if (channelRef.current) {
      await channelRef.current.track({
        user_id: user.id,
        email: user.email,
        online_at: new Date().toISOString(),
      })
    }
  }

  const saveElement = async (element) => {
    try {
      const { error } = await supabase
        .from('whiteboard_elements')
        .insert([{
          id: element.id,
          whiteboard_id: whiteboard.id,
          type: element.type,
          data: element.data,
          created_by: user.id
        }])

      if (error) throw error
    } catch (error) {
      console.error('Error saving element:', error)
    }
  }

  const deleteElement = async (elementId) => {
    try {
      const { error } = await supabase
        .from('whiteboard_elements')
        .delete()
        .eq('id', elementId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting element:', error)
    }
  }

  const handleMouseDown = (e) => {
    if (tool === TOOLS.ERASER) return

    setIsDrawing(true)
    const pos = e.target.getStage().getPointerPosition()

    if (tool === TOOLS.PEN) {
      setCurrentPath([pos.x, pos.y])
    } else if (tool === TOOLS.RECTANGLE || tool === TOOLS.CIRCLE) {
      const newElement = {
        id: uuidv4(),
        type: tool,
        data: {
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: '#000000',
          strokeWidth: 2
        }
      }
      setElements(prev => [...prev, newElement])
    } else if (tool === TOOLS.TEXT) {
      const text = prompt('Enter text:')
      if (text) {
        const newElement = {
          id: uuidv4(),
          type: 'text',
          data: {
            x: pos.x,
            y: pos.y,
            text: text,
            fontSize: 16,
            fill: '#000000'
          }
        }
        setElements(prev => [...prev, newElement])
        saveElement(newElement)
      }
    }
  }

  const handleMouseMove = (e) => {
    if (!isDrawing) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

    if (tool === TOOLS.PEN) {
      setCurrentPath(prev => [...prev, point.x, point.y])
    } else if (tool === TOOLS.RECTANGLE || tool === TOOLS.CIRCLE) {
      setElements(prev => {
        const newElements = [...prev]
        const lastElement = newElements[newElements.length - 1]
        if (lastElement) {
          lastElement.data.width = point.x - lastElement.data.x
          lastElement.data.height = point.y - lastElement.data.y
        }
        return newElements
      })
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing) return

    setIsDrawing(false)

    if (tool === TOOLS.PEN && currentPath.length > 0) {
      const newElement = {
        id: uuidv4(),
        type: 'line',
        data: {
          points: currentPath,
          stroke: '#000000',
          strokeWidth: 2
        }
      }
      setElements(prev => [...prev, newElement])
      saveElement(newElement)
      setCurrentPath([])
    } else if (tool === TOOLS.RECTANGLE || tool === TOOLS.CIRCLE) {
      const lastElement = elements[elements.length - 1]
      if (lastElement && (lastElement.data.width !== 0 || lastElement.data.height !== 0)) {
        saveElement(lastElement)
      }
    }
  }

  const handleElementClick = (elementId) => {
    if (tool === TOOLS.ERASER) {
      deleteElement(elementId)
    }
  }

  const clearBoard = async () => {
    if (confirm('Are you sure you want to clear the entire board?')) {
      try {
        const { error } = await supabase
          .from('whiteboard_elements')
          .delete()
          .eq('whiteboard_id', whiteboard.id)

        if (error) throw error
      } catch (error) {
        console.error('Error clearing board:', error)
      }
    }
  }

  const shareWhiteboard = async () => {
    if (!shareEmail.trim()) return

    try {
      // First, check if user exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', shareEmail)
        .single()

      if (userError) {
        alert('User not found. They need to sign up first.')
        return
      }

      const { error } = await supabase
        .from('whiteboard_permissions')
        .insert([{
          whiteboard_id: whiteboard.id,
          user_id: userData.id,
          permission: sharePermission
        }])

      if (error) throw error

      setShowShareModal(false)
      setShareEmail('')
      alert('Whiteboard shared successfully!')
    } catch (error) {
      console.error('Error sharing whiteboard:', error)
      alert('Error sharing whiteboard')
    }
  }

  const renderElement = (element) => {
    const { id, type, data } = element

    switch (type) {
      case 'line':
        return (
          <Line
            key={id}
            points={data.points}
            stroke={data.stroke}
            strokeWidth={data.strokeWidth}
            onClick={() => handleElementClick(id)}
          />
        )
      case 'rectangle':
        return (
          <Rect
            key={id}
            x={data.x}
            y={data.y}
            width={data.width}
            height={data.height}
            stroke={data.stroke}
            strokeWidth={data.strokeWidth}
            fill="transparent"
            onClick={() => handleElementClick(id)}
          />
        )
      case 'circle':
        return (
          <Circle
            key={id}
            x={data.x + data.width / 2}
            y={data.y + data.height / 2}
            radius={Math.abs(data.width) / 2}
            stroke={data.stroke}
            strokeWidth={data.strokeWidth}
            fill="transparent"
            onClick={() => handleElementClick(id)}
          />
        )
      case 'text':
        return (
          <Text
            key={id}
            x={data.x}
            y={data.y}
            text={data.text}
            fontSize={data.fontSize}
            fill={data.fill}
            onClick={() => handleElementClick(id)}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h1 className="text-xl font-semibold text-gray-900">{whiteboard.title}</h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Active Users */}
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600">
                {activeUsers.length} online
              </span>
              <div className="flex -space-x-2">
                {activeUsers.slice(0, 3).map((activeUser, index) => (
                  <div
                    key={activeUser.user_id}
                    className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                    title={activeUser.email}
                  >
                    {activeUser.email.charAt(0).toUpperCase()}
                  </div>
                ))}
                {activeUsers.length > 3 && (
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                    +{activeUsers.length - 3}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Share className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTool(TOOLS.PEN)}
              className={`p-2 rounded-lg transition-colors ${
                tool === TOOLS.PEN 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Pen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool(TOOLS.RECTANGLE)}
              className={`p-2 rounded-lg transition-colors ${
                tool === TOOLS.RECTANGLE 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Square className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool(TOOLS.CIRCLE)}
              className={`p-2 rounded-lg transition-colors ${
                tool === TOOLS.CIRCLE 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <CircleIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool(TOOLS.TEXT)}
              className={`p-2 rounded-lg transition-colors ${
                tool === TOOLS.TEXT 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Type className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool(TOOLS.ERASER)}
              className={`p-2 rounded-lg transition-colors ${
                tool === TOOLS.ERASER 
                  ? 'bg-red-100 text-red-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eraser className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={clearBoard}
            className="flex items-center space-x-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Board</span>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <Stage
          width={window.innerWidth}
          height={window.innerHeight - 120}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          ref={stageRef}
        >
          <Layer>
            {elements.map(renderElement)}
            {isDrawing && tool === TOOLS.PEN && currentPath.length > 0 && (
              <Line
                points={currentPath}
                stroke="#000000"
                strokeWidth={2}
              />
            )}
          </Layer>
        </Stage>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Share Whiteboard</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission
                </label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="edit">Can Edit</option>
                  <option value="read">Read Only</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={shareWhiteboard}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
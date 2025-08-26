# Real-Time Collaborative Whiteboard

A modern, real-time collaborative whiteboard application built with Next.js, Tailwind CSS, and Supabase.

## Features

- **User Authentication**: Secure sign-up and sign-in with Supabase Auth
- **Real-time Collaboration**: Multiple users can draw simultaneously with instant synchronization
- **Drawing Tools**: Pen, shapes (rectangle, circle), text, and eraser
- **Whiteboard Management**: Create, view, and manage multiple whiteboards
- **User Presence**: See who's currently active on each whiteboard
- **Permissions System**: Share whiteboards with read-only or edit access
- **Persistent Storage**: All drawings are saved to Supabase database

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Canvas**: React Konva for drawing functionality
- **Backend**: Supabase (Database, Auth, Realtime)
- **Real-time**: Supabase Realtime Engine
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Supabase account and project

### Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Supabase**:
   - Create a new Supabase project
   - Copy your project URL and anon key
   - Update `.env.local` with your Supabase credentials

3. **Run the database migration**:
   - In your Supabase dashboard, go to the SQL Editor
   - Run the migration script from `supabase/migrations/create_whiteboard_schema.sql`

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:3000`

## Usage

1. **Sign up** for a new account or **sign in** with existing credentials
2. **Create a new whiteboard** from the dashboard
3. **Use the drawing tools** to create content:
   - Pen: Draw freehand lines
   - Rectangle: Draw rectangular shapes
   - Circle: Draw circular shapes
   - Text: Add text annotations
   - Eraser: Remove elements by clicking on them
4. **Share your whiteboard** by clicking the Share button and entering collaborator emails
5. **Collaborate in real-time** with other users

## Database Schema

The application uses the following main tables:

- `profiles`: User profile information
- `whiteboards`: Whiteboard metadata
- `whiteboard_elements`: Individual drawing elements
- `whiteboard_permissions`: Sharing and permission settings

## Real-time Features

- **Live Drawing**: See other users' drawings appear in real-time
- **User Presence**: View active users with avatars
- **Instant Sync**: All changes are immediately broadcasted to connected clients
- **Conflict Resolution**: Supabase handles concurrent updates gracefully

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only access whiteboards they own or have been granted permission to
- Authentication required for all operations
- Secure real-time subscriptions with user context

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for learning and development.
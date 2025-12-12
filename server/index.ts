import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import { Server, LobbyRoom } from 'colyseus'
import { monitor } from '@colyseus/monitor'
import { RoomType } from '../types/Rooms'
import { GoogleGenerativeAI } from '@google/generative-ai'

// import socialRoutes from "@colyseus/social/express"

import { SkyOffice } from './rooms/SkyOffice'

const port = Number(process.env.PORT || 3005)
const app = express()

app.use(cors())
app.use(express.json())
// app.use(express.static('dist'))

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Build chat history for context
    const chatHistory = history?.map((msg: { sender: string; text: string }) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })) || []

    const chat = model.startChat({
      history: chatHistory,
    })

    const result = await chat.sendMessage(message)
    const response = await result.response
    const text = response.text()

    res.json({ response: text })
  } catch (error: any) {
    console.error('Error calling Gemini API:', error)
    res.status(500).json({ error: error.message || 'Failed to get AI response' })
  }
})

const server = http.createServer(app)
const gameServer = new Server({
  server,
})

// register room handlers
gameServer.define(RoomType.LOBBY, LobbyRoom)
gameServer.define(RoomType.PUBLIC, SkyOffice, {
  name: 'Public Lobby',
  description: 'For making friends and familiarizing yourself with the controls',
  password: null,
  autoDispose: false,
})
gameServer.define(RoomType.CUSTOM, SkyOffice).enableRealtimeListing()

/**
 * Register @colyseus/social routes
 *
 * - uncomment if you want to use default authentication (https://docs.colyseus.io/server/authentication/)
 * - also uncomment the import statement
 */
// app.use("/", socialRoutes);

// register colyseus monitor AFTER registering your room handlers
app.use('/colyseus', monitor())

gameServer.listen(port,"0.0.0.0")
console.log(`Listening on ws://localhost:${port}`)

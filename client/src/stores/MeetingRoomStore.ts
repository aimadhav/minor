import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

interface MeetingRoomState {
  meetingRoomDialogOpen: boolean
  meetingRoomId: string | null
  isPresenting: boolean
  presenterId: string | null
  presenterStream: MediaStream | null
  myStream: MediaStream | null
  attendeeCount: number
  inMeetingRoomZone: boolean
  currentZoneMeetingRoomId: string | null
}

const initialState: MeetingRoomState = {
  meetingRoomDialogOpen: false,
  meetingRoomId: null,
  isPresenting: false,
  presenterId: null,
  presenterStream: null,
  myStream: null,
  attendeeCount: 0,
  inMeetingRoomZone: false,
  currentZoneMeetingRoomId: null,
}

export const meetingRoomSlice = createSlice({
  name: 'meetingRoom',
  initialState,
  reducers: {
    openMeetingRoomDialog: (state, action: PayloadAction<{ meetingRoomId: string }>) => {
      const game = phaserGame.scene.keys.game as Game
      game.disableKeys()
      state.meetingRoomDialogOpen = true
      state.meetingRoomId = action.payload.meetingRoomId
    },
    closeMeetingRoomDialog: (state) => {
      const game = phaserGame.scene.keys.game as Game
      game.enableKeys()
      
      // Clean up streams
      if (state.myStream) {
        state.myStream.getTracks().forEach(track => track.stop())
      }
      
      state.meetingRoomDialogOpen = false
      state.meetingRoomId = null
      state.isPresenting = false
      state.presenterId = null
      state.presenterStream = null
      state.myStream = null
    },
    startPresenting: (state) => {
      state.isPresenting = true
    },
    stopPresenting: (state) => {
      if (state.myStream) {
        state.myStream.getTracks().forEach(track => track.stop())
      }
      state.isPresenting = false
      state.myStream = null
    },
    setMyStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.myStream = action.payload
    },
    setPresenterStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.presenterStream = action.payload
    },
    setPresenterId: (state, action: PayloadAction<string | null>) => {
      state.presenterId = action.payload
      if (!action.payload) {
        state.presenterStream = null
      }
    },
    setAttendeeCount: (state, action: PayloadAction<number>) => {
      state.attendeeCount = action.payload
    },
    presentationStarted: (state, action: PayloadAction<{ presenterId: string; meetingRoomId?: string }>) => {
      state.presenterId = action.payload.presenterId
      // Auto-open dialog if user is in the meeting room zone and not already open
      if (state.inMeetingRoomZone && !state.meetingRoomDialogOpen) {
        const game = phaserGame.scene.keys.game as Game
        game.disableKeys()
        state.meetingRoomDialogOpen = true
        // Use the current zone's meeting room ID if not provided
        state.meetingRoomId = action.payload.meetingRoomId || state.currentZoneMeetingRoomId
      }
    },
    presentationStopped: (state) => {
      state.presenterId = null
      state.presenterStream = null
    },
    enterMeetingRoomZone: (state, action: PayloadAction<{ meetingRoomId: string }>) => {
      state.inMeetingRoomZone = true
      state.currentZoneMeetingRoomId = action.payload.meetingRoomId
      // If there's an active presentation and dialog is not open, auto-open it
      if (state.presenterId && !state.meetingRoomDialogOpen) {
        const game = phaserGame.scene.keys.game as Game
        game.disableKeys()
        state.meetingRoomDialogOpen = true
        state.meetingRoomId = action.payload.meetingRoomId
      }
    },
    leaveMeetingRoomZone: (state) => {
      state.inMeetingRoomZone = false
      state.currentZoneMeetingRoomId = null
    },
  },
})

export const {
  openMeetingRoomDialog,
  closeMeetingRoomDialog,
  startPresenting,
  stopPresenting,
  setMyStream,
  setPresenterStream,
  setPresenterId,
  setAttendeeCount,
  presentationStarted,
  presentationStopped,
  enterMeetingRoomZone,
  leaveMeetingRoomZone,
} = meetingRoomSlice.actions

export default meetingRoomSlice.reducer

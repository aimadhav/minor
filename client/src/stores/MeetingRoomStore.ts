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
}

const initialState: MeetingRoomState = {
  meetingRoomDialogOpen: false,
  meetingRoomId: null,
  isPresenting: false,
  presenterId: null,
  presenterStream: null,
  myStream: null,
  attendeeCount: 0,
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
    presentationStarted: (state, action: PayloadAction<{ presenterId: string }>) => {
      state.presenterId = action.payload.presenterId
    },
    presentationStopped: (state) => {
      state.presenterId = null
      state.presenterStream = null
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
} = meetingRoomSlice.actions

export default meetingRoomSlice.reducer

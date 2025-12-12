import Peer from 'peerjs'
import store from '../stores'
import {
  setMyStream,
  setPresenterStream,
  startPresenting,
  stopPresenting,
} from '../stores/MeetingRoomStore'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import { phaserEvents, Event } from '../events/EventCenter'

export default class MeetingRoomManager {
  private myPeer: Peer
  private myStream?: MediaStream
  private peerConnections: Map<string, Peer.MediaConnection> = new Map()
  private isPresenter: boolean = false

  constructor(private myUserId: string, private meetingRoomId: string) {
    const sanitizedId = this.makeId(myUserId)
    this.myPeer = new Peer(sanitizedId)
    
    this.myPeer.on('error', (err) => {
      console.log('MeetingRoomManager err.type', err.type)
      console.error('MeetingRoomManager', err)
    })

    // Handle incoming calls (for attendees receiving presenter stream)
    this.myPeer.on('call', (call) => {
      console.log(`Received incoming call from: ${call.peer}`)
      call.answer()
      call.on('stream', (presenterVideoStream) => {
        console.log(`Received presenter stream from: ${call.peer}`)
        store.dispatch(setPresenterStream(presenterVideoStream))
      })
      call.on('close', () => {
        console.log(`Call closed from: ${call.peer}`)
        store.dispatch(setPresenterStream(null))
      })
      call.on('error', (err) => {
        console.error(`Call error from ${call.peer}:`, err)
      })
    })
    
    this.myPeer.on('open', (id) => {
      console.log(`PeerJS connection opened with ID: ${id}`)
    })

    // Listen for new attendees joining (for presenter to call them)
    phaserEvents.on(Event.MEETING_ROOM_ATTENDEE_ADDED, this.onAttendeeAdded, this)
    phaserEvents.on(Event.MEETING_ROOM_ATTENDEE_REMOVED, this.onAttendeeRemoved, this)
    
    // Listen for presentation started (for attendees joining an ongoing presentation)
    phaserEvents.on(Event.PRESENTATION_STARTED, this.onPresentationStarted, this)
  }

  // PeerJS throws invalid_id error if it contains some characters such as that colyseus generates.
  // Also for meeting room ID add a `-mr` at the end.
  private makeId(id: string) {
    return `${id.replace(/[^0-9a-z]/gi, 'G')}-mr`
  }

  onOpen() {
    if (this.myPeer.disconnected) {
      this.myPeer.reconnect()
    }
  }

  onClose() {
    if (this.isPresenter) {
      this.stopPresentation(false)
    }
    this.peerConnections.forEach((call) => call.close())
    this.peerConnections.clear()
    this.myPeer.disconnect()
    phaserEvents.off(Event.MEETING_ROOM_ATTENDEE_ADDED, this.onAttendeeAdded, this)
    phaserEvents.off(Event.MEETING_ROOM_ATTENDEE_REMOVED, this.onAttendeeRemoved, this)
    phaserEvents.off(Event.PRESENTATION_STARTED, this.onPresentationStarted, this)
  }

  async startPresentation() {
    try {
      // Get screen share with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      // Add microphone audio if available
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micStream.getAudioTracks().forEach((track) => {
          stream.addTrack(track)
        })
      } catch (micErr) {
        console.log('Microphone access denied, continuing with screen audio only')
      }

      // Detect when user clicks "Stop sharing" outside of our UI
      const track = stream.getVideoTracks()[0]
      if (track) {
        track.onended = () => {
          this.stopPresentation()
        }
      }

      this.myStream = stream
      this.isPresenter = true
      store.dispatch(setMyStream(stream))
      store.dispatch(startPresenting())

      // Notify server that we're starting presentation
      // The server will respond with the list of attendees via PRESENTATION_STARTED event
      const game = phaserGame.scene.keys.game as Game
      game.network.startPresentation(this.meetingRoomId)
      
      console.log('Presentation started, waiting for attendee list from server...')
      // Note: callAllAttendees will be triggered by onPresentationStarted when server responds with attendee list
    } catch (err) {
      console.error('Failed to start screen share:', err)
    }
  }

  stopPresentation(shouldDispatch = true) {
    this.myStream?.getTracks().forEach((track) => track.stop())
    this.myStream = undefined
    this.isPresenter = false

    // Close all peer connections
    this.peerConnections.forEach((call) => call.close())
    this.peerConnections.clear()

    if (shouldDispatch) {
      store.dispatch(stopPresenting())
      store.dispatch(setMyStream(null))

      // Notify server that presentation stopped
      const game = phaserGame.scene.keys.game as Game
      game.network.stopPresentation(this.meetingRoomId)
    }
  }

  private callAllAttendees() {
    if (!this.myStream) return

    // Get the meeting room state from the game
    const meetingRoomState = store.getState().meetingRoom
    const game = phaserGame.scene.keys.game as Game
    
    // Get list of attendees from the room state via game.network
    // For each attendee that's not the presenter, initiate a call
    game.meetingRoomItems?.forEach((meetingRoom) => {
      if (meetingRoom.id === this.meetingRoomId) {
        meetingRoom.currentUsers.forEach((userId) => {
          if (userId !== this.myUserId) {
            this.callUser(userId)
          }
        })
      }
    })
  }

  private callUser(userId: string) {
    if (!this.myStream || userId === this.myUserId) {
      console.log(`callUser skipped: myStream=${!!this.myStream}, userId=${userId}, myUserId=${this.myUserId}`)
      return
    }

    const sanitizedId = this.makeId(userId)
    console.log(`Calling user ${userId} with peer ID: ${sanitizedId}`)
    
    try {
      const call = this.myPeer.call(sanitizedId, this.myStream)
      
      if (call) {
        console.log(`Call initiated to ${sanitizedId}`)
        this.peerConnections.set(userId, call)
        call.on('close', () => {
          console.log(`Call closed with ${userId}`)
          this.peerConnections.delete(userId)
        })
        call.on('error', (err) => {
          console.error(`Call error with ${userId}:`, err)
        })
      } else {
        console.log(`Call to ${sanitizedId} returned null`)
      }
    } catch (err) {
      console.error(`Error calling ${userId}:`, err)
    }
  }

  private onAttendeeAdded(meetingRoomId: string) {
    // If I'm the presenter and someone joins my room, call them
    if (this.isPresenter && meetingRoomId === this.meetingRoomId) {
      this.callAllAttendees()
    }
  }

  private onAttendeeRemoved(meetingRoomId: string) {
    // Handle attendee removal if needed
  }

  // Called when a presentation starts and I'm an attendee (not the presenter)
  // The presenter will call me, so I just need to be ready to receive
  private onPresentationStarted(meetingRoomId: string, presenterId: string, attendees?: string[]) {
    console.log(`onPresentationStarted: roomId=${meetingRoomId}, presenterId=${presenterId}, myUserId=${this.myUserId}, attendees=`, attendees)
    
    if (meetingRoomId !== this.meetingRoomId) {
      console.log('Ignoring - different meeting room')
      return
    }
    
    // If I'm the presenter and received attendee list, call all of them
    if (presenterId === this.myUserId && attendees && attendees.length > 0) {
      console.log(`I'm the presenter, calling ${attendees.length} attendees:`, attendees)
      // Wait a bit for peer connections to be ready
      setTimeout(() => {
        attendees.forEach((attendeeId) => {
          console.log(`Calling attendee: ${attendeeId}`)
          this.callUser(attendeeId)
        })
      }, 500)
      return
    }
    
    if (presenterId === this.myUserId) {
      console.log('I am the presenter but no attendees in list')
      return
    }
    
    console.log(`Presentation started by ${presenterId}, I'm an attendee waiting for incoming call...`)
    // The presenter will call all attendees, we just need to be ready (handled in constructor's myPeer.on('call'))
  }

  getMyStream(): MediaStream | undefined {
    return this.myStream
  }

  isCurrentlyPresenting(): boolean {
    return this.isPresenter
  }
}

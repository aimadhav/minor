import { Client, Room } from 'colyseus.js'
import { IComputer, IOfficeState, IPlayer, IWhiteboard, IMeetingRoom, IChatMessage } from '../../../types/IOfficeState'
import { Message } from '../../../types/Messages'
import { IRoomData, RoomType } from '../../../types/Rooms'
import { ItemType } from '../../../types/Items'
import WebRTC from '../web/WebRTC'
import { phaserEvents, Event } from '../events/EventCenter'
import store from '../stores'
import { setSessionId, setPlayerNameMap, removePlayerNameMap } from '../stores/UserStore'
import {
  setLobbyJoined,
  setJoinedRoomData,
  setAvailableRooms,
  addAvailableRooms,
  removeAvailableRooms,
} from '../stores/RoomStore'
import {
  pushChatMessage,
  pushPlayerJoinedMessage,
  pushPlayerLeftMessage,
} from '../stores/ChatStore'
import { setWhiteboardUrls } from '../stores/WhiteboardStore'
import {
  presentationStarted,
  presentationStopped,
  setAttendeeCount,
} from '../stores/MeetingRoomStore'

export default class Network {
  private client: Client
  private room?: Room<IOfficeState>
  private lobby!: Room
  webRTC?: WebRTC

  mySessionId!: string

  constructor() {
    // Force endpoint to use the server's IPv4 address directly
    const endpoint = 'ws://192.168.0.100:3005'; // <-- Replace with your server's actual IPv4 if different
    this.client = new Client(endpoint)
    this.joinLobbyRoom().then(() => {
      store.dispatch(setLobbyJoined(true))
    })

    phaserEvents.on(Event.MY_PLAYER_NAME_CHANGE, this.updatePlayerName, this)
    phaserEvents.on(Event.MY_PLAYER_TEXTURE_CHANGE, this.updatePlayer, this)
    phaserEvents.on(Event.PLAYER_DISCONNECTED, this.playerStreamDisconnect, this)
  }

  /**
   * method to join Colyseus' built-in LobbyRoom, which automatically notifies
   * connected clients whenever rooms with "realtime listing" have updates
   */
  async joinLobbyRoom() {
    this.lobby = await this.client.joinOrCreate(RoomType.LOBBY)

    this.lobby.onMessage('rooms', (rooms) => {
      store.dispatch(setAvailableRooms(rooms))
    })

    this.lobby.onMessage('+', ([roomId, room]) => {
      store.dispatch(addAvailableRooms({ roomId, room }))
    })

    this.lobby.onMessage('-', (roomId) => {
      store.dispatch(removeAvailableRooms(roomId))
    })
  }

  // method to join the public lobby
  async joinOrCreatePublic() {
    this.room = await this.client.joinOrCreate(RoomType.PUBLIC)
    this.initialize()
  }

  // method to join a custom room
  async joinCustomById(roomId: string, password: string | null) {
    this.room = await this.client.joinById(roomId, { password })
    this.initialize()
  }

  // method to create a custom room
  async createCustom(roomData: IRoomData) {
    const { name, description, password, autoDispose } = roomData
    this.room = await this.client.create(RoomType.CUSTOM, {
      name,
      description,
      password,
      autoDispose,
    })
    this.initialize()
  }

  // set up all network listeners before the game starts
  initialize() {
    if (!this.room) return

    this.lobby.leave()
    this.mySessionId = this.room.sessionId
    store.dispatch(setSessionId(this.room.sessionId))
    this.webRTC = new WebRTC(this.mySessionId, this)

    // new instance added to the players MapSchema
    this.room.state.players.onAdd = (player: IPlayer, key: string) => {
      if (key === this.mySessionId) return

      // track changes on every child object inside the players MapSchema
      player.onChange = (changes) => {
        changes.forEach((change) => {
          const { field, value } = change
          phaserEvents.emit(Event.PLAYER_UPDATED, field, value, key)

          // when a new player finished setting up player name
          if (field === 'name' && value !== '') {
            phaserEvents.emit(Event.PLAYER_JOINED, player, key)
            store.dispatch(setPlayerNameMap({ id: key, name: value }))
            store.dispatch(pushPlayerJoinedMessage(value))
          }
        })
      }
    }

    // an instance removed from the players MapSchema
    this.room.state.players.onRemove = (player: IPlayer, key: string) => {
      phaserEvents.emit(Event.PLAYER_LEFT, key)
      this.webRTC?.deleteVideoStream(key)
      this.webRTC?.deleteOnCalledVideoStream(key)
      store.dispatch(pushPlayerLeftMessage(player.name))
      store.dispatch(removePlayerNameMap(key))
    }

    // new instance added to the computers MapSchema
    this.room.state.computers.onAdd = (computer: IComputer, key: string) => {
      // track changes on every child object's connectedUser
      computer.connectedUser.onAdd = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_ADDED, item, key, ItemType.COMPUTER)
      }
      computer.connectedUser.onRemove = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_REMOVED, item, key, ItemType.COMPUTER)
      }
    }

    // new instance added to the whiteboards MapSchema
    this.room.state.whiteboards.onAdd = (whiteboard: IWhiteboard, key: string) => {
      store.dispatch(
        setWhiteboardUrls({
          whiteboardId: key,
          roomId: whiteboard.roomId,
        })
      )
      // track changes on every child object's connectedUser
      whiteboard.connectedUser.onAdd = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_ADDED, item, key, ItemType.WHITEBOARD)
      }
      whiteboard.connectedUser.onRemove = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_REMOVED, item, key, ItemType.WHITEBOARD)
      }
    }

    // new instance added to the chatMessages ArraySchema
    this.room.state.chatMessages.onAdd = (item, index) => {
      store.dispatch(pushChatMessage(item))
    }

    // when the server sends room data
    this.room.onMessage(Message.SEND_ROOM_DATA, (content) => {
      store.dispatch(setJoinedRoomData(content))
    })

    // when a user sends a message
    this.room.onMessage(Message.ADD_CHAT_MESSAGE, ({ clientId, content }) => {
      phaserEvents.emit(Event.UPDATE_DIALOG_BUBBLE, clientId, content)
    })

    // when a peer disconnects with myPeer
    this.room.onMessage(Message.DISCONNECT_STREAM, (clientId: string) => {
      this.webRTC?.deleteOnCalledVideoStream(clientId)
    })

    // when a computer user stops sharing screen
    this.room.onMessage(Message.STOP_SCREEN_SHARE, (clientId: string) => {
      const computerState = store.getState().computer
      computerState.shareScreenManager?.onUserLeft(clientId)
    })

    // Meeting Room message handlers
    // when a presentation starts
    this.room.onMessage(
      Message.START_PRESENTATION,
      (data: { meetingRoomId: string; presenterId: string; attendees?: string[] }) => {
        store.dispatch(presentationStarted({ presenterId: data.presenterId, meetingRoomId: data.meetingRoomId }))
        phaserEvents.emit(Event.PRESENTATION_STARTED, data.meetingRoomId, data.presenterId, data.attendees)
        
        // Add chat notification for presentation start (for attendees only)
        if (data.presenterId !== this.mySessionId) {
          const playerNameMap = store.getState().user.playerNameMap
          const presenterName = playerNameMap.get(data.presenterId) || 'Someone'
          store.dispatch(pushChatMessage({
            author: 'System',
            content: `📺 ${presenterName} started a presentation in the meeting room!`,
            createdAt: Date.now(),
          } as IChatMessage))
        }
      }
    )

    // when a presentation stops
    this.room.onMessage(Message.STOP_PRESENTATION, (data: { meetingRoomId: string }) => {
      store.dispatch(presentationStopped())
      phaserEvents.emit(Event.PRESENTATION_STOPPED, data.meetingRoomId)
      
      // Add chat notification for presentation stop
      store.dispatch(pushChatMessage({
        author: 'System',
        content: `📺 The presentation has ended.`,
        createdAt: Date.now(),
      } as IChatMessage))
    })

    // when presenter is told to call a specific attendee (late joiner)
    this.room.onMessage(
      Message.CALL_ATTENDEE,
      (data: { meetingRoomId: string; attendeeId: string }) => {
        phaserEvents.emit(Event.CALL_ATTENDEE, data.meetingRoomId, data.attendeeId)
      }
    )

    // WebRTC signaling - receive offer from presenter
    this.room.onMessage(
      Message.PRESENTER_OFFER,
      (data: { meetingRoomId: string; presenterId: string; offer: any }) => {
        phaserEvents.emit(Event.PRESENTER_OFFER_RECEIVED, data)
      }
    )

    // WebRTC signaling - receive answer from attendee
    this.room.onMessage(
      Message.PRESENTER_ANSWER,
      (data: { meetingRoomId: string; attendeeId: string; answer: any }) => {
        phaserEvents.emit(Event.PRESENTER_ANSWER_RECEIVED, data)
      }
    )

    // WebRTC signaling - receive ICE candidate
    this.room.onMessage(
      Message.PRESENTER_ICE_CANDIDATE,
      (data: { meetingRoomId: string; senderId: string; candidate: any }) => {
        phaserEvents.emit(Event.PRESENTER_ICE_CANDIDATE_RECEIVED, data)
      }
    )

    // Track meeting room attendees
    this.room.state.meetingRooms.onAdd = (meetingRoom: IMeetingRoom, key: string) => {
      meetingRoom.attendees.onAdd = () => {
        store.dispatch(setAttendeeCount(meetingRoom.attendees.size))
        phaserEvents.emit(Event.MEETING_ROOM_ATTENDEE_ADDED, key)
      }
      meetingRoom.attendees.onRemove = () => {
        store.dispatch(setAttendeeCount(meetingRoom.attendees.size))
        phaserEvents.emit(Event.MEETING_ROOM_ATTENDEE_REMOVED, key)
      }
    }
  }

  // method to register event listener and call back function when a item user added
  onChatMessageAdded(callback: (playerId: string, content: string) => void, context?: any) {
    phaserEvents.on(Event.UPDATE_DIALOG_BUBBLE, callback, context)
  }

  // method to register event listener and call back function when a item user added
  onItemUserAdded(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_ADDED, callback, context)
  }

  // method to register event listener and call back function when a item user removed
  onItemUserRemoved(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_REMOVED, callback, context)
  }

  // method to register event listener and call back function when a player joined
  onPlayerJoined(callback: (Player: IPlayer, key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_JOINED, callback, context)
  }

  // method to register event listener and call back function when a player left
  onPlayerLeft(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_LEFT, callback, context)
  }

  // method to register event listener and call back function when myPlayer is ready to connect
  onMyPlayerReady(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_READY, callback, context)
  }

  // method to register event listener and call back function when my video is connected
  onMyPlayerVideoConnected(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_VIDEO_CONNECTED, callback, context)
  }

  // method to register event listener and call back function when a player updated
  onPlayerUpdated(
    callback: (field: string, value: number | string, key: string) => void,
    context?: any
  ) {
    phaserEvents.on(Event.PLAYER_UPDATED, callback, context)
  }

  // method to send player updates to Colyseus server
  updatePlayer(currentX: number, currentY: number, currentAnim: string) {
    this.room?.send(Message.UPDATE_PLAYER, { x: currentX, y: currentY, anim: currentAnim })
  }

  // method to send player name to Colyseus server
  updatePlayerName(currentName: string) {
    this.room?.send(Message.UPDATE_PLAYER_NAME, { name: currentName })
  }

  // method to send ready-to-connect signal to Colyseus server
  readyToConnect() {
    this.room?.send(Message.READY_TO_CONNECT)
    phaserEvents.emit(Event.MY_PLAYER_READY)
  }

  // method to send ready-to-connect signal to Colyseus server
  videoConnected() {
    this.room?.send(Message.VIDEO_CONNECTED)
    phaserEvents.emit(Event.MY_PLAYER_VIDEO_CONNECTED)
  }

  // method to send stream-disconnection signal to Colyseus server
  playerStreamDisconnect(id: string) {
    this.room?.send(Message.DISCONNECT_STREAM, { clientId: id })
    this.webRTC?.deleteVideoStream(id)
  }

  connectToComputer(id: string) {
    this.room?.send(Message.CONNECT_TO_COMPUTER, { computerId: id })
  }

  disconnectFromComputer(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_COMPUTER, { computerId: id })
  }

  connectToWhiteboard(id: string) {
    this.room?.send(Message.CONNECT_TO_WHITEBOARD, { whiteboardId: id })
  }

  disconnectFromWhiteboard(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_WHITEBOARD, { whiteboardId: id })
  }

  onStopScreenShare(id: string) {
    this.room?.send(Message.STOP_SCREEN_SHARE, { computerId: id })
  }

  addChatMessage(content: string) {
    this.room?.send(Message.ADD_CHAT_MESSAGE, { content: content })
  }

  // Meeting Room methods
  joinMeetingRoom(meetingRoomId: string) {
    this.room?.send(Message.JOIN_MEETING_ROOM, { meetingRoomId })
  }

  leaveMeetingRoom(meetingRoomId: string) {
    this.room?.send(Message.LEAVE_MEETING_ROOM, { meetingRoomId })
  }

  startPresentation(meetingRoomId: string) {
    this.room?.send(Message.START_PRESENTATION, { meetingRoomId })
  }

  stopPresentation(meetingRoomId: string) {
    this.room?.send(Message.STOP_PRESENTATION, { meetingRoomId })
  }

  attendeeReady(meetingRoomId: string) {
    this.room?.send(Message.ATTENDEE_READY, { meetingRoomId })
  }

  sendPresenterOffer(meetingRoomId: string, targetId: string, offer: any) {
    this.room?.send(Message.PRESENTER_OFFER, { meetingRoomId, targetId, offer })
  }

  sendPresenterAnswer(meetingRoomId: string, presenterId: string, answer: any) {
    this.room?.send(Message.PRESENTER_ANSWER, { meetingRoomId, presenterId, answer })
  }

  sendPresenterIceCandidate(meetingRoomId: string, targetId: string, candidate: any) {
    this.room?.send(Message.PRESENTER_ICE_CANDIDATE, { meetingRoomId, targetId, candidate })
  }
}

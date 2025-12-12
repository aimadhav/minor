import bcrypt from 'bcrypt'
import { Room, Client, ServerError } from 'colyseus'
import { Dispatcher } from '@colyseus/command'
import { Player, OfficeState, Computer, Whiteboard, MeetingRoom } from './schema/OfficeState'
import { Message } from '../../types/Messages'
import { IRoomData } from '../../types/Rooms'
import { whiteboardRoomIds } from './schema/OfficeState'
import PlayerUpdateCommand from './commands/PlayerUpdateCommand'
import PlayerUpdateNameCommand from './commands/PlayerUpdateNameCommand'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from './commands/ComputerUpdateArrayCommand'
import {
  WhiteboardAddUserCommand,
  WhiteboardRemoveUserCommand,
} from './commands/WhiteboardUpdateArrayCommand'
import ChatMessageUpdateCommand from './commands/ChatMessageUpdateCommand'

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private name: string
  private description: string
  private password: string | null = null

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    let hasPassword = false
    if (password) {
      const salt = await bcrypt.genSalt(10)
      this.password = await bcrypt.hash(password, salt)
      hasPassword = true
    }
    this.setMetadata({ name, description, hasPassword })

    this.setState(new OfficeState())

    // HARD-CODED: Add 5 computers in a room
    for (let i = 0; i < 5; i++) {
      this.state.computers.set(String(i), new Computer())
    }

    // HARD-CODED: Add 3 whiteboards in a room
    for (let i = 0; i < 3; i++) {
      this.state.whiteboards.set(String(i), new Whiteboard())
    }

    // HARD-CODED: Add 2 meeting rooms
    for (let i = 0; i < 2; i++) {
      this.state.meetingRooms.set(String(i), new MeetingRoom())
    }

    // when a player connect to a computer, add to the computer connectedUser array
    this.onMessage(Message.CONNECT_TO_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerAddUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player disconnect from a computer, remove from the computer connectedUser array
    this.onMessage(Message.DISCONNECT_FROM_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player stop sharing screen
    this.onMessage(Message.STOP_SCREEN_SHARE, (client, message: { computerId: string }) => {
      const computer = this.state.computers.get(message.computerId)
      computer.connectedUser.forEach((id) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === id && cli.sessionId !== client.sessionId) {
            cli.send(Message.STOP_SCREEN_SHARE, client.sessionId)
          }
        })
      })
    })

    // when a player connect to a whiteboard, add to the whiteboard connectedUser array
    this.onMessage(Message.CONNECT_TO_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), {
        client,
        whiteboardId: message.whiteboardId,
      })
    })

    // when a player disconnect from a whiteboard, remove from the whiteboard connectedUser array
    this.onMessage(
      Message.DISCONNECT_FROM_WHITEBOARD,
      (client, message: { whiteboardId: string }) => {
        this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), {
          client,
          whiteboardId: message.whiteboardId,
        })
      }
    )

    // when receiving updatePlayer message, call the PlayerUpdateCommand
    this.onMessage(
      Message.UPDATE_PLAYER,
      (client, message: { x: number; y: number; anim: string }) => {
        this.dispatcher.dispatch(new PlayerUpdateCommand(), {
          client,
          x: message.x,
          y: message.y,
          anim: message.anim,
        })
      }
    )

    // when receiving updatePlayerName message, call the PlayerUpdateNameCommand
    this.onMessage(Message.UPDATE_PLAYER_NAME, (client, message: { name: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), {
        client,
        name: message.name,
      })
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.READY_TO_CONNECT, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.readyToConnect = true
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.VIDEO_CONNECTED, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = true
    })

    // when a player disconnect a stream, broadcast the signal to the other player connected to the stream
    this.onMessage(Message.DISCONNECT_STREAM, (client, message: { clientId: string }) => {
      this.clients.forEach((cli) => {
        if (cli.sessionId === message.clientId) {
          cli.send(Message.DISCONNECT_STREAM, client.sessionId)
        }
      })
    })

    // when a player send a chat message, update the message array and broadcast to all connected clients except the sender
    this.onMessage(Message.ADD_CHAT_MESSAGE, (client, message: { content: string }) => {
      // update the message array (so that players join later can also see the message)
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), {
        client,
        content: message.content,
      })

      // broadcast to all currently connected clients except the sender (to render in-game dialog on top of the character)
      this.broadcast(
        Message.ADD_CHAT_MESSAGE,
        { clientId: client.sessionId, content: message.content },
        { except: client }
      )
    })

    // Meeting Room Handlers
    // when a player joins a meeting room
    this.onMessage(Message.JOIN_MEETING_ROOM, (client, message: { meetingRoomId: string }) => {
      const meetingRoom = this.state.meetingRooms.get(message.meetingRoomId)
      if (meetingRoom && !meetingRoom.attendees.has(client.sessionId)) {
        meetingRoom.attendees.add(client.sessionId)
        // If there's an active presenter, notify the new attendee
        if (meetingRoom.isActive && meetingRoom.presenterId) {
          client.send(Message.START_PRESENTATION, {
            meetingRoomId: message.meetingRoomId,
            presenterId: meetingRoom.presenterId,
          })
        }
      }
    })

    // when a player leaves a meeting room
    this.onMessage(Message.LEAVE_MEETING_ROOM, (client, message: { meetingRoomId: string }) => {
      const meetingRoom = this.state.meetingRooms.get(message.meetingRoomId)
      if (meetingRoom) {
        meetingRoom.attendees.delete(client.sessionId)
        // If the presenter leaves, stop the presentation
        if (meetingRoom.presenterId === client.sessionId) {
          meetingRoom.presenterId = ''
          meetingRoom.isActive = false
          // Notify all attendees that presentation stopped
          meetingRoom.attendees.forEach((attendeeId) => {
            this.clients.forEach((cli) => {
              if (cli.sessionId === attendeeId) {
                cli.send(Message.STOP_PRESENTATION, { meetingRoomId: message.meetingRoomId })
              }
            })
          })
        }
      }
    })

    // when a player starts a presentation
    this.onMessage(Message.START_PRESENTATION, (client, message: { meetingRoomId: string }) => {
      const meetingRoom = this.state.meetingRooms.get(message.meetingRoomId)
      if (meetingRoom && !meetingRoom.isActive) {
        meetingRoom.presenterId = client.sessionId
        meetingRoom.isActive = true
        
        // Get list of all attendee IDs to send to presenter
        const attendeeIds: string[] = []
        meetingRoom.attendees.forEach((attendeeId) => {
          if (attendeeId !== client.sessionId) {
            attendeeIds.push(attendeeId)
          }
        })
        
        // Send attendee list back to presenter so they can call everyone
        client.send(Message.START_PRESENTATION, {
          meetingRoomId: message.meetingRoomId,
          presenterId: client.sessionId,
          attendees: attendeeIds,
        })
        
        // Notify all attendees about the new presenter
        meetingRoom.attendees.forEach((attendeeId) => {
          if (attendeeId !== client.sessionId) {
            this.clients.forEach((cli) => {
              if (cli.sessionId === attendeeId) {
                cli.send(Message.START_PRESENTATION, {
                  meetingRoomId: message.meetingRoomId,
                  presenterId: client.sessionId,
                })
              }
            })
          }
        })
      }
    })

    // when a presenter stops presenting
    this.onMessage(Message.STOP_PRESENTATION, (client, message: { meetingRoomId: string }) => {
      const meetingRoom = this.state.meetingRooms.get(message.meetingRoomId)
      if (meetingRoom && meetingRoom.presenterId === client.sessionId) {
        meetingRoom.presenterId = ''
        meetingRoom.isActive = false
        // Notify all attendees that presentation stopped
        meetingRoom.attendees.forEach((attendeeId) => {
          if (attendeeId !== client.sessionId) {
            this.clients.forEach((cli) => {
              if (cli.sessionId === attendeeId) {
                cli.send(Message.STOP_PRESENTATION, { meetingRoomId: message.meetingRoomId })
              }
            })
          }
        })
      }
    })

    // WebRTC signaling for presentation - forward offer from presenter to attendee
    this.onMessage(
      Message.PRESENTER_OFFER,
      (client, message: { meetingRoomId: string; targetId: string; offer: any }) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === message.targetId) {
            cli.send(Message.PRESENTER_OFFER, {
              meetingRoomId: message.meetingRoomId,
              presenterId: client.sessionId,
              offer: message.offer,
            })
          }
        })
      }
    )

    // WebRTC signaling for presentation - forward answer from attendee to presenter
    this.onMessage(
      Message.PRESENTER_ANSWER,
      (client, message: { meetingRoomId: string; presenterId: string; answer: any }) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === message.presenterId) {
            cli.send(Message.PRESENTER_ANSWER, {
              meetingRoomId: message.meetingRoomId,
              attendeeId: client.sessionId,
              answer: message.answer,
            })
          }
        })
      }
    )

    // WebRTC signaling for presentation - forward ICE candidates
    this.onMessage(
      Message.PRESENTER_ICE_CANDIDATE,
      (client, message: { meetingRoomId: string; targetId: string; candidate: any }) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === message.targetId) {
            cli.send(Message.PRESENTER_ICE_CANDIDATE, {
              meetingRoomId: message.meetingRoomId,
              senderId: client.sessionId,
              candidate: message.candidate,
            })
          }
        })
      }
    )
  }

  async onAuth(client: Client, options: { password: string | null }) {
    if (this.password) {
      const validPassword = await bcrypt.compare(options.password, this.password)
      if (!validPassword) {
        throw new ServerError(403, 'Password is incorrect!')
      }
    }
    return true
  }

  onJoin(client: Client, options: any) {
    this.state.players.set(client.sessionId, new Player())
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this.name,
      description: this.description,
    })
  }

  onLeave(client: Client, consented: boolean) {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
    this.state.computers.forEach((computer) => {
      if (computer.connectedUser.has(client.sessionId)) {
        computer.connectedUser.delete(client.sessionId)
      }
    })
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboard.connectedUser.has(client.sessionId)) {
        whiteboard.connectedUser.delete(client.sessionId)
      }
    })
    // Clean up meeting room state
    this.state.meetingRooms.forEach((meetingRoom, meetingRoomId) => {
      if (meetingRoom.attendees.has(client.sessionId)) {
        meetingRoom.attendees.delete(client.sessionId)
      }
      // If the presenter leaves, stop the presentation
      if (meetingRoom.presenterId === client.sessionId) {
        meetingRoom.presenterId = ''
        meetingRoom.isActive = false
        // Notify all attendees that presentation stopped
        meetingRoom.attendees.forEach((attendeeId) => {
          this.clients.forEach((cli) => {
            if (cli.sessionId === attendeeId) {
              cli.send(Message.STOP_PRESENTATION, { meetingRoomId })
            }
          })
        })
      }
    })
  }

  onDispose() {
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboardRoomIds.has(whiteboard.roomId)) whiteboardRoomIds.delete(whiteboard.roomId)
    })

    console.log('room', this.roomId, 'disposing...')
    this.dispatcher.stop()
  }
}

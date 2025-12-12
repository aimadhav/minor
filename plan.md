# Conference/Presentation Feature - Implementation Plan

## Status: ✅ IMPLEMENTED

## Overview

This document outlines the plan to implement a **Conference/Presentation feature** in SyncSpace (formerly SkyOffice). The feature allows one person to share their screen and speak while all other users in a meeting room can view and listen, regardless of their distance from the presenter.

---

## Current Architecture Analysis

### Existing Components

#### 1. **Server (Colyseus-based)**
- `server/index.ts` - Express + Colyseus server with rooms
- `server/rooms/SkyOffice.ts` - Main room handler with player, computer, whiteboard management
- `server/rooms/schema/OfficeState.ts` - State schemas for players, computers, whiteboards

#### 2. **Client Services**
- `client/src/services/Network.ts` - Colyseus client, handles all server communication
- `client/src/web/WebRTC.ts` - Peer-to-peer video/audio calls (proximity-based)
- `client/src/web/ShareScreenManager.ts` - Screen sharing for computer items

#### 3. **Existing Screen Sharing Flow**
1. Player walks to a Computer item and presses R
2. `Computer.openDialog()` dispatches `openComputerDialog` action
3. `ShareScreenManager` initializes PeerJS connection
4. Presenter clicks "Share Screen" → calls `navigator.mediaDevices.getDisplayMedia()`
5. All users connected to that computer receive the stream via PeerJS

#### 4. **Current Proximity-Based Video**
- `WebRTC.ts` handles player-to-player video calls
- Triggered when players physically overlap in the game
- Each player maintains their own peer connections

---

## Feature Requirements

### Must Have
1. **Presentation Mode in Meeting Room**
   - One presenter can share screen + audio/video
   - All users in the meeting room receive the stream
   - Works regardless of distance within the room

2. **Meeting Room Zones**
   - Define specific areas on the map as "Meeting Rooms"
   - Players entering a meeting room join that room's conference

3. **Presenter Controls**
   - Start/Stop presenting
   - Only one presenter at a time per meeting room
   - Presenter indicator (visual badge)

4. **Audience View**
   - See presenter's shared screen
   - Hear presenter's audio
   - Minimize/maximize presentation view

### Nice to Have
- Raise hand feature
- Q&A chat specific to meeting room
- Recording capability
- Multiple presenters (panel mode)

---

## Technical Implementation Plan

### Phase 1: Backend - Meeting Room Schema & Messages

#### 1.1 Create MeetingRoom Schema
```typescript
// types/IOfficeState.ts
export interface IMeetingRoom extends Schema {
  roomId: string
  presenterId: string | null  // sessionId of current presenter
  participants: SetSchema<string>  // all users in this meeting room
  isActive: boolean
}
```

#### 1.2 Add New Message Types
```typescript
// types/Messages.ts
export enum Message {
  // ... existing messages
  JOIN_MEETING_ROOM,
  LEAVE_MEETING_ROOM,
  START_PRESENTATION,
  STOP_PRESENTATION,
  MEETING_ROOM_UPDATE,
}
```

#### 1.3 Update Server Room Handler
```typescript
// server/rooms/SkyOffice.ts
// Add meetingRooms MapSchema
// Handle JOIN_MEETING_ROOM, LEAVE_MEETING_ROOM messages
// Handle START_PRESENTATION, STOP_PRESENTATION
// Broadcast presenter stream info to all participants
```

### Phase 2: Map - Define Meeting Room Zones

#### 2.1 Add Meeting Room Layer in Tiled Map
- Open `client/public/assets/map/map.tmx` in Tiled
- Create new Object Layer called "MeetingRoom"
- Add rectangle objects defining meeting room boundaries
- Add custom property `roomId` to each zone

#### 2.2 Detect Player Zone Entry/Exit
```typescript
// client/src/scenes/Game.ts
// Add zone detection for meeting rooms
// Emit events when player enters/leaves a meeting room zone
```

### Phase 3: Client - Meeting Room Manager

#### 3.1 Create MeetingRoomManager
```typescript
// client/src/web/MeetingRoomManager.ts
export default class MeetingRoomManager {
  private myPeer: Peer
  private roomId: string
  private isPresentor: boolean
  private presenterStream?: MediaStream
  
  // Join a meeting room
  joinRoom(roomId: string)
  
  // Leave meeting room
  leaveRoom()
  
  // Start presenting (screen + audio)
  startPresenting()
  
  // Stop presenting
  stopPresenting()
  
  // Receive presenter stream
  onPresenterStream(stream: MediaStream)
}
```

#### 3.2 Create Redux Store for Meeting Room
```typescript
// client/src/stores/MeetingRoomStore.ts
interface MeetingRoomState {
  currentRoomId: string | null
  isPresenting: boolean
  presenterId: string | null
  presenterStream: MediaStream | null
  participants: string[]
  showPresentationView: boolean
}
```

### Phase 4: Client - UI Components

#### 4.1 Meeting Room Indicator
- Show when player is in a meeting room
- Display room name and participant count

#### 4.2 Presentation Controls
- "Start Presenting" button (if no current presenter)
- "Stop Presenting" button (if user is presenter)
- Screen share selection

#### 4.3 Presentation View
- Full-screen or picture-in-picture view of presentation
- Presenter name display
- Minimize/maximize controls
- Audio controls (mute/unmute)

### Phase 5: WebRTC - One-to-Many Broadcasting

#### 5.1 Presenter → Server → Participants Flow
```
Presenter                    Server                    Participants
    |                           |                           |
    |--[Start Presentation]---->|                           |
    |                           |--[Presenter Info]-------->|
    |                           |                           |
    |<--------[Request Stream]--|<--------[Connect to Peer]-|
    |                           |                           |
    |--[Stream via PeerJS]------|-------------------------->|
```

#### 5.2 Implementation Approach
- Presenter creates PeerJS stream
- Server broadcasts presenter's peer ID to all meeting room participants
- Participants call the presenter's peer to receive stream
- When new participant joins, server sends current presenter info

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `client/src/web/MeetingRoomManager.ts` | Handle meeting room WebRTC logic |
| `client/src/stores/MeetingRoomStore.ts` | Redux state for meeting rooms |
| `client/src/components/MeetingRoomDialog.tsx` | UI for meeting room controls |
| `client/src/components/PresentationView.tsx` | Display presenter's screen |
| `client/src/items/MeetingRoom.ts` | Meeting room zone item |

### Modified Files
| File | Changes |
|------|---------|
| `types/Messages.ts` | Add meeting room message types |
| `types/IOfficeState.ts` | Add IMeetingRoom interface |
| `server/rooms/SkyOffice.ts` | Handle meeting room logic |
| `server/rooms/schema/OfficeState.ts` | Add MeetingRoom schema |
| `client/src/services/Network.ts` | Add meeting room network methods |
| `client/src/scenes/Game.ts` | Detect meeting room zones |
| `client/src/App.tsx` | Add meeting room components |
| `client/public/assets/map/map.tmx` | Add meeting room zones |

---

## Implementation Order

### Sprint 1: Foundation (Backend + Schema)
1. ✅ Add IMeetingRoom to types
2. ✅ Add MeetingRoom schema to server
3. ✅ Add message types
4. ✅ Implement server message handlers

### Sprint 2: Zone Detection
1. Add MeetingRoom layer to Tiled map
2. Create meeting room zone detection in Game.ts
3. Network communication for join/leave

### Sprint 3: WebRTC Broadcasting
1. Create MeetingRoomManager
2. Implement one-to-many streaming
3. Handle presenter changes

### Sprint 4: UI Components
1. Create MeetingRoomStore
2. Build MeetingRoomDialog
3. Build PresentationView
4. Polish and test

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                   │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │  Game.ts     │  │ Network.ts    │  │ MeetingRoomManager   │  │
│  │  (Zone       │──│ (Colyseus     │──│ (PeerJS WebRTC)      │  │
│  │  Detection)  │  │  Messages)    │  │                      │  │
│  └──────────────┘  └───────────────┘  └──────────────────────┘  │
│         │                 │                     │                │
│         ▼                 ▼                     ▼                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  MeetingRoomStore (Redux)                   ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────┐  ┌────────────────────────────────────┐   │
│  │ MeetingRoomDialog│  │       PresentationView             │   │
│  │ (Controls)       │  │       (Video Display)              │   │
│  └──────────────────┘  └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (Colyseus)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SkyOffice.ts                             ││
│  │  - Handle JOIN_MEETING_ROOM                                 ││
│  │  - Handle START_PRESENTATION                                ││
│  │  - Broadcast presenter info                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    OfficeState                              ││
│  │  - players: MapSchema<Player>                               ││
│  │  - meetingRooms: MapSchema<MeetingRoom>  ← NEW              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Streaming Architecture

### Option A: Mesh Network (Current approach for computers)
- Each participant connects directly to presenter
- ✅ Low latency
- ❌ Doesn't scale well (presenter uploads N times)

### Option B: SFU (Selective Forwarding Unit)
- Use a media server (e.g., mediasoup, Janus, Jitsi)
- ✅ Scales well
- ❌ More complex setup, requires additional server

### Recommendation
Start with **Option A (Mesh)** for simplicity, same as existing computer screen share. If scaling becomes an issue, consider migrating to SFU.

---

## Testing Plan

1. **Unit Tests**
   - MeetingRoom schema serialization
   - Message handlers

2. **Integration Tests**
   - Zone entry/exit detection
   - Network message flow

3. **E2E Tests**
   - Full presentation flow
   - Multiple participants joining
   - Presenter handoff

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Backend | 2-3 days | None |
| Phase 2: Map Zones | 1-2 days | Phase 1 |
| Phase 3: WebRTC | 3-4 days | Phase 1, 2 |
| Phase 4: UI | 2-3 days | Phase 3 |
| Testing & Polish | 2 days | All |

**Total: ~10-14 days**

---

## Next Steps

1. Start with Phase 1 - Add backend schema and message types
2. Define meeting room zones in the Tiled map
3. Implement MeetingRoomManager for WebRTC handling
4. Build UI components
5. Test and iterate

import Phaser from 'phaser'

export const phaserEvents = new Phaser.Events.EventEmitter()

export enum Event {
  PLAYER_JOINED = 'player-joined',
  PLAYER_UPDATED = 'player-updated',
  PLAYER_LEFT = 'player-left',
  PLAYER_DISCONNECTED = 'player-disconnected',
  MY_PLAYER_READY = 'my-player-ready',
  MY_PLAYER_NAME_CHANGE = 'my-player-name-change',
  MY_PLAYER_TEXTURE_CHANGE = 'my-player-texture-change',
  MY_PLAYER_VIDEO_CONNECTED = 'my-player-video-connected',
  ITEM_USER_ADDED = 'item-user-added',
  ITEM_USER_REMOVED = 'item-user-removed',
  UPDATE_DIALOG_BUBBLE = 'update-dialog-bubble',
  // Meeting Room Events
  PRESENTATION_STARTED = 'presentation-started',
  PRESENTATION_STOPPED = 'presentation-stopped',
  PRESENTER_OFFER_RECEIVED = 'presenter-offer-received',
  PRESENTER_ANSWER_RECEIVED = 'presenter-answer-received',
  PRESENTER_ICE_CANDIDATE_RECEIVED = 'presenter-ice-candidate-received',
  MEETING_ROOM_ATTENDEE_ADDED = 'meeting-room-attendee-added',
  MEETING_ROOM_ATTENDEE_REMOVED = 'meeting-room-attendee-removed',
}

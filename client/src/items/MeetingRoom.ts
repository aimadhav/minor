import { ItemType } from '../../../types/Items'
import store from '../stores'
import Item from './Item'
import Network from '../services/Network'
import { openMeetingRoomDialog } from '../stores/MeetingRoomStore'

export default class MeetingRoom extends Item {
  id?: string
  currentUsers = new Set<string>()

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame)

    this.itemType = ItemType.MEETINGROOM
  }

  private updateStatus() {
    if (!this.currentUsers) return
    const numberOfUsers = this.currentUsers.size
    this.clearStatusBox()
    if (numberOfUsers === 1) {
      this.setStatusBox(`${numberOfUsers} attendee`)
    } else if (numberOfUsers > 1) {
      this.setStatusBox(`${numberOfUsers} attendees`)
    }
  }

  onOverlapDialog() {
    if (this.currentUsers.size === 0) {
      this.setDialogBox('Press R to enter meeting room')
    } else {
      this.setDialogBox('Press R to join meeting')
    }
  }

  addCurrentUser(userId: string) {
    if (!this.currentUsers || this.currentUsers.has(userId)) return
    this.currentUsers.add(userId)
    this.updateStatus()
  }

  removeCurrentUser(userId: string) {
    if (!this.currentUsers || !this.currentUsers.has(userId)) return
    this.currentUsers.delete(userId)
    this.updateStatus()
  }

  openDialog(playerId: string, network: Network) {
    if (!this.id) return
    store.dispatch(openMeetingRoomDialog({ meetingRoomId: this.id }))
    network.joinMeetingRoom(this.id)
  }
}

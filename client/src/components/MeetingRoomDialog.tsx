import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import PresentToAllIcon from '@mui/icons-material/PresentToAll'
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation'
import PeopleIcon from '@mui/icons-material/People'

import { useAppSelector, useAppDispatch } from '../hooks'
import {
  closeMeetingRoomDialog,
  setMyStream,
  setPresenterStream,
  startPresenting,
  stopPresenting,
} from '../stores/MeetingRoomStore'

import Video from './Video'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import MeetingRoomManager from '../web/MeetingRoomManager'

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 16px 180px 16px 16px;
`

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #1a1d2e 0%, #222639 50%, #1a1d2e 100%);
  border-radius: 16px;
  padding: 16px;
  color: #eee;
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: 0px 0px 15px rgba(0, 0, 0, 0.5);

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
  }
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .attendee-count {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.1);
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
  }
`

const ToolBar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
`

const VideoContainer = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  position: relative;

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .presenter-label {
    position: absolute;
    top: 16px;
    left: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .no-presentation {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    gap: 16px;

    svg {
      font-size: 64px;
      opacity: 0.3;
    }

    p {
      font-size: 1.1rem;
      margin: 0;
    }
  }
`

const StyledButton = styled(Button)`
  && {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 10px 24px;
    border-radius: 8px;
    font-weight: 500;
    text-transform: none;

    &:hover {
      background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
    }

    &.stop {
      background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);

      &:hover {
        background: linear-gradient(135deg, #e04a5e 0%, #e080e8 100%);
      }
    }
  }
`

export default function MeetingRoomDialog() {
  const dispatch = useAppDispatch()
  const meetingRoomId = useAppSelector((state) => state.meetingRoom.meetingRoomId)
  const isPresenting = useAppSelector((state) => state.meetingRoom.isPresenting)
  const presenterId = useAppSelector((state) => state.meetingRoom.presenterId)
  const presenterStream = useAppSelector((state) => state.meetingRoom.presenterStream)
  const myStream = useAppSelector((state) => state.meetingRoom.myStream)
  const attendeeCount = useAppSelector((state) => state.meetingRoom.attendeeCount)
  const mySessionId = useAppSelector((state) => state.user.sessionId)
  const playerNameMap = useAppSelector((state) => state.user.playerNameMap)

  const [meetingRoomManager, setMeetingRoomManager] = useState<MeetingRoomManager | null>(null)

  const isMyPresentation = presenterId === mySessionId

  useEffect(() => {
    if (meetingRoomId && mySessionId) {
      // Join the meeting room on the server
      const game = phaserGame.scene.keys.game as Game
      game.network.joinMeetingRoom(meetingRoomId)
      
      // Create the MeetingRoomManager for WebRTC
      const manager = new MeetingRoomManager(mySessionId, meetingRoomId)
      manager.onOpen()
      setMeetingRoomManager(manager)

      return () => {
        manager.onClose()
      }
    }
  }, [meetingRoomId, mySessionId])

  const handleClose = () => {
    if (meetingRoomManager) {
      meetingRoomManager.onClose()
    }
    const game = phaserGame.scene.keys.game as Game
    if (meetingRoomId) {
      game.network.leaveMeetingRoom(meetingRoomId)
    }
    dispatch(closeMeetingRoomDialog())
  }

  const handleStartPresentation = async () => {
    if (meetingRoomManager) {
      await meetingRoomManager.startPresentation()
    }
  }

  const handleStopPresentation = () => {
    if (meetingRoomManager) {
      meetingRoomManager.stopPresentation()
    }
  }

  const presenterName = presenterId ? playerNameMap.get(presenterId) || 'Unknown' : null

  return (
    <Backdrop>
      <Wrapper>
        <IconButton
          aria-label="close dialog"
          className="close"
          onClick={handleClose}
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>

        <Header>
          <h2>
            <PresentToAllIcon /> Meeting Room
          </h2>
          <div className="attendee-count">
            <PeopleIcon fontSize="small" />
            {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
          </div>
        </Header>

        <ToolBar>
          {!presenterId && !isPresenting && (
            <StyledButton
              variant="contained"
              startIcon={<PresentToAllIcon />}
              onClick={handleStartPresentation}
            >
              Start Presentation
            </StyledButton>
          )}
          {isMyPresentation && (
            <StyledButton
              variant="contained"
              className="stop"
              startIcon={<CancelPresentationIcon />}
              onClick={handleStopPresentation}
            >
              Stop Presentation
            </StyledButton>
          )}
        </ToolBar>

        <VideoContainer>
          {isMyPresentation && myStream ? (
            <>
              <Video srcObject={myStream} autoPlay muted />
              <div className="presenter-label">You are presenting</div>
            </>
          ) : presenterStream ? (
            <>
              <Video srcObject={presenterStream} autoPlay />
              <div className="presenter-label">{presenterName} is presenting</div>
            </>
          ) : (
            <div className="no-presentation">
              <PresentToAllIcon />
              <p>No active presentation</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                Click "Start Presentation" to share your screen
              </p>
            </div>
          )}
        </VideoContainer>
      </Wrapper>
    </Backdrop>
  )
}

import { useEffect, useState } from 'react'
import { setCustomQuestions, setPlayerTeam, setTeamMode } from './api'
import { EVENING_PACK_IDS, eveningPack, type EveningPackId } from './eveningPacks'
import type { UiStrings } from './i18n'
import type { PublicCustomQuestion, PublicRoom, QuizLanguage, TeamId } from './types'

type Ui = UiStrings

function emptyCustom(lang: QuizLanguage): PublicCustomQuestion {
  return {
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    category: lang === 'en' ? 'Custom' : 'Egna',
  }
}

const PACK_LABEL: Record<EveningPackId, keyof Ui> = {
  birthday: 'packBirthday',
  office: 'packOffice',
  family: 'packFamily',
  partyNight: 'packPartyNight',
}

export function LobbyTeamAndCustoms({
  room,
  isHost,
  ui,
  onError,
  onFlash,
}: {
  room: PublicRoom
  isHost: boolean
  ui: Ui
  onError: (msg: string) => void
  onFlash: (msg: string) => void
}) {
  const [customs, setCustoms] = useState<PublicCustomQuestion[]>(
    () => room.customQuestions?.length ? room.customQuestions : [emptyCustom(room.language)],
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (room.customQuestions && room.customQuestions.length > 0) {
      setCustoms(room.customQuestions)
    }
  }, [room.customQuestions])

  if (!isHost) return null

  async function toggleTeams(enabled: boolean) {
    const res = await setTeamMode(enabled)
    if (res.error) onError(res.error)
  }

  async function assign(targetId: string, teamId: TeamId) {
    const res = await setPlayerTeam(targetId, teamId)
    if (res.error) onError(res.error)
  }

  async function saveCustoms() {
    setBusy(true)
    const cleaned = customs.filter(
      (q) => q.text.trim().length >= 3 && q.options.every((o) => o.trim().length > 0),
    )
    const res = await setCustomQuestions(cleaned)
    setBusy(false)
    if (res.error) onError(res.error)
    else onFlash(ui.customSaved)
  }

  function loadPack(id: EveningPackId) {
    setCustoms(eveningPack(id, room.language))
  }

  return (
    <>
      <div>
        <label style={{ marginBottom: '0.4rem' }}>{ui.teamMode}</label>
        <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            type="button"
            className={`choice ${room.teamMode ? 'selected' : ''}`}
            onClick={() => void toggleTeams(true)}
          >
            {ui.teamOn}
          </button>
          <button
            type="button"
            className={`choice ${!room.teamMode ? 'selected' : ''}`}
            onClick={() => void toggleTeams(false)}
          >
            {ui.teamOff}
          </button>
        </div>
      </div>

      {room.teamMode && (
        <div className="team-assign">
          <p className="section-title">{ui.assignTeam}</p>
          <ul className="players team-players">
            {room.players
              .filter((p) => p.playing)
              .map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className="team-btns">
                    <button
                      type="button"
                      className={`btn-tiny ${p.teamId === 'a' ? 'selected' : ''}`}
                      onClick={() => void assign(p.id, 'a')}
                    >
                      {ui.teamA}
                    </button>
                    <button
                      type="button"
                      className={`btn-tiny ${p.teamId === 'b' ? 'selected' : ''}`}
                      onClick={() => void assign(p.id, 'b')}
                    >
                      {ui.teamB}
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="custom-block">
        <p className="section-title">{ui.customQuestions}</p>
        <p className="footer-note" style={{ marginTop: 0 }}>
          {ui.eveningPacks}
        </p>
        <div className="choice-row pack-row">
          {EVENING_PACK_IDS.map((id) => (
            <button key={id} type="button" className="choice" onClick={() => loadPack(id)}>
              {ui[PACK_LABEL[id]]}
            </button>
          ))}
        </div>
        {customs.map((q, qi) => (
          <div key={qi} className="custom-q">
            <input
              type="text"
              placeholder={ui.questionText}
              value={q.text}
              onChange={(e) => {
                const next = [...customs]
                next[qi] = { ...q, text: e.target.value }
                setCustoms(next)
              }}
            />
            <div className="custom-opts">
              {q.options.map((opt, oi) => (
                <label key={oi} className="custom-opt">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={q.correctIndex === oi}
                    onChange={() => {
                      const next = [...customs]
                      next[qi] = { ...q, correctIndex: oi }
                      setCustoms(next)
                    }}
                  />
                  <input
                    type="text"
                    placeholder={`${ui.option} ${oi + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const opts = [...q.options] as [string, string, string, string]
                      opts[oi] = e.target.value
                      const next = [...customs]
                      next[qi] = { ...q, options: opts }
                      setCustoms(next)
                    }}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn-tiny"
              onClick={() => setCustoms(customs.filter((_, i) => i !== qi))}
            >
              {ui.removeQuestion}
            </button>
          </div>
        ))}
        <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCustoms([...customs, emptyCustom(room.language)])}
          >
            {ui.addQuestion}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void saveCustoms()}
          >
            {ui.saveQuestions}
          </button>
        </div>
      </div>
    </>
  )
}

export function TeamStandings({
  room,
  ui,
}: {
  room: PublicRoom
  ui: Ui
}) {
  if (!room.teamMode || !room.teamScores) return null
  const { a, b } = room.teamScores
  return (
    <div className="team-standings">
      <p className="section-title">{ui.teamScoreTitle}</p>
      <div className="team-score-row">
        <div className={`team-card ${a >= b ? 'leading' : ''}`}>
          <strong>{ui.teamA}</strong>
          <span>{a}</span>
        </div>
        <div className={`team-card ${b >= a ? 'leading' : ''}`}>
          <strong>{ui.teamB}</strong>
          <span>{b}</span>
        </div>
      </div>
    </div>
  )
}

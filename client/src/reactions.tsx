import { sendReaction, type ReactionEvent } from './api'

const EMOJIS = ['👏', '🔥', '😂', '😮', '❤️', '🎉']

export function ReactionBar({ label }: { label: string }) {
  return (
    <div className="reaction-bar">
      <span className="reaction-label">{label}</span>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-btn"
          onClick={() => void sendReaction(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

export function ReactionOverlay({
  reactions,
}: {
  reactions: ReactionEvent[]
}) {
  return (
    <div className="reaction-overlay" aria-hidden>
      {reactions.map((r) => (
        <span
          key={`${r.at}-${r.from}-${r.emoji}`}
          className="reaction-float"
          style={{ left: `${20 + ((r.at / 17) % 60)}%` }}
        >
          <span>{r.emoji}</span>
          <em>{r.from}</em>
        </span>
      ))}
    </div>
  )
}

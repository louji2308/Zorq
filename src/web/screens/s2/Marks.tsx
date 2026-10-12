import type { S2MemberModel } from "./s2Model.js";

export interface OverIndexSquareProps {
  overIndexes: boolean;
  measured: boolean;
}

export function OverIndexSquare({ overIndexes, measured }: OverIndexSquareProps) {
  if (!measured) {
    return (
      <svg
        className="s2-overindex is-unmeasured"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        role="img"
        aria-label="Not measured"
        focusable="false"
      >
        <rect x="1" y="1" width="10" height="10" strokeDasharray="2 2" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg
      className={overIndexes ? "s2-overindex is-filled" : "s2-overindex"}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      role="img"
      aria-label={overIndexes ? "Over-indexes locally" : "Does not over-index locally"}
      focusable="false"
    >
      <rect x="1" y="1" width="10" height="10" fill={overIndexes ? "currentColor" : "none"} strokeWidth="1.5" />
    </svg>
  );
}

export interface BreakMarkProps {
  hidden?: boolean;
}

export function BreakMark({ hidden = false }: BreakMarkProps) {
  if (hidden) {
    return null;
  }
  return (
    <svg
      className="s2-breakmark"
      width="18"
      height="12"
      viewBox="0 0 18 12"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 6 L7 6 L9 2 L11 10 L13 6 L17 6" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

export interface MemberRowProps {
  member: S2MemberModel;
  role: string;
  showRole: boolean;
}

export function MemberRow({ member, role, showRole }: MemberRowProps) {
  return (
    <li className="s2-member">
      <span className="s2-member-role">{showRole ? role : ""}</span>
      <span className="s2-member-name">{member.name}</span>
      <OverIndexSquare overIndexes={member.overIndexes} measured={member.measured} />
    </li>
  );
}

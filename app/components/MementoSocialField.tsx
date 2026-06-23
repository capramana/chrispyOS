import type { CSSProperties } from "react";
import {
  MEMENTO_SOCIAL_HANDLE_PLACEHOLDER,
  MEMENTO_SOCIAL_OPTIONS,
  type SocialType,
} from "./mementoColors";

type MementoSocialFieldProps = {
  socialType: SocialType;
  handle: string;
  error: string;
  onSocialTypeChange: (type: SocialType) => void;
  onHandleChange: (value: string) => void;
};

export default function MementoSocialField({
  socialType,
  handle,
  error,
  onSocialTypeChange,
  onHandleChange,
}: MementoSocialFieldProps) {
  return (
    <div className="field">
      <div className="social-field-row">
        <div className="toggle-row" role="group" aria-label="Find you on">
          {MEMENTO_SOCIAL_OPTIONS.map(({ id, label, favicon, color }) => (
            <button
              key={id}
              type="button"
              className={`toggle-btn toggle-btn-${id}${socialType === id ? " active" : ""}`}
              style={{ "--c": color } as CSSProperties}
              onClick={() => onSocialTypeChange(id)}
              aria-label={label}
            >
              <img src={favicon} alt="" width={20} height={20} draggable={false} />
            </button>
          ))}
        </div>
        <input
          type="text"
          id="handleInput"
          placeholder={MEMENTO_SOCIAL_HANDLE_PLACEHOLDER[socialType]}
          aria-label="Social profile"
          value={handle}
          onChange={(event) => onHandleChange(event.target.value)}
        />
      </div>
      <p className="field-error">{error}</p>
    </div>
  );
}
